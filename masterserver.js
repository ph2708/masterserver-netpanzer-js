/**
 * npms.js - versão em Node.js do npms.c (NetPanzer masterserver)
 *
 * Comportamento:
 * - TCP e UDP na porta 28900
 * - Aceita heartbeat: \heartbeat\gamename\netpanzer\port\<port>\protocol\<p>\final\
 *   -> envia de volta "\final\" por TCP e dispara um desafio UDP "\echo\<key>" para
 *      o IP:port informado (se não estiver já listado)
 * - Aceita list query: \list\gamename\netpanzer\final\  -> responde lista: \ip\<ip>\port\<port>\... \final\
 * - Escuta UDP para comando "shutdown!" vindo de 127.0.0.1 para encerrar
 *
 * Limpeza de servidores com mais de 5 minutos (60*5s).
 */

const net = require('net');
const dgram = require('dgram');

const PORT = 28900;
const GS_MAX_NUM = 64;
const ECHO_QUERY_PREFIX = '\\echo\\';
const MS_LIST_QUERY_ANSWER = '\\final\\';
const SHUTDOWN_COM = 'shutdown!';
const ADMIN_ADDR = '127.0.0.1';
const TTL_REMOVE_SECONDS = 60 * 5;

const udpSocket = dgram.createSocket('udp4');

let gsArr = new Array(GS_MAX_NUM).fill(null).map(() => ({
  status: 0, addr: '', port: 0, protocol: 0, timestamp: 0, echokey: ''
}));

let serverRunning = true;

// Helper: parse '\' tokens similar ao strtok(c, "\\")
function parseBackslashTokens(s) {
  // strings vêm como e.g. "\heartbeat\gamename\netpanzer\port\123\protocol\1\final\"
  // split and filter empties
  return s.split('\\').filter(tok => tok.length > 0);
}

// Remove old entries periodically
setInterval(() => {
  const now = Date.now() / 1000;
  let removed = 0;
  gsArr.forEach((g, idx) => {
    if (g.status > 0 && (now - g.timestamp) > TTL_REMOVE_SECONDS) {
      console.log(`Deleting game server ${g.addr}:${g.port} - mais de 5 minutos.`);
      gsArr[idx] = { status: 0, addr: '', port: 0, protocol: 0, timestamp: 0, echokey: '' };
      removed++;
    }
  });
  if (removed) console.log(`Removed ${removed} stale entries`);
}, 30 * 1000);

// UDP handler: receive shutdown and re-arm event loop (not necessary in node)
udpSocket.on('message', (msgBuf, rinfo) => {
  const msg = msgBuf.toString();
  console.log(`UDP: got "${msg}" from ${rinfo.address}:${rinfo.port}`);

  if (msg === SHUTDOWN_COM && rinfo.address === ADMIN_ADDR) {
    console.log('Shutdown command received via UDP from admin. Shutting down.');
    shutdown();
  }
});

udpSocket.on('error', (err) => {
  console.error(`UDP socket error: ${err}`);
});

// open UDP socket (bind)
udpSocket.bind(PORT, () => {
  console.log(`UDP socket bound on port ${PORT}`);
});

// TCP server
const tcpServer = net.createServer((socket) => {
  socket.setEncoding('utf8');
  socket.setNoDelay(true);

  const remoteIP = socket.remoteAddress.replace(/^::ffff:/, ''); // normalize IPv4-mapped IPv6
  const remotePort = socket.remotePort;
  console.log(`TCP connection from ${remoteIP}:${remotePort}`);

  let dataBuf = '';

  socket.on('data', (chunk) => {
    dataBuf += chunk;
    // Many clients will send full message at once. We'll process on newline or directly.
    // The original C code used raw buffer; we assume each connection sends a single query then closes.
    processClientMessage(socket, dataBuf, remoteIP);
    dataBuf = '';
  });

  socket.on('close', () => {
    // nothing special
  });

  socket.on('error', (err) => {
    console.error('TCP socket error:', err.message);
    try { socket.destroy(); } catch(e){}
  });
});

tcpServer.on('error', (err) => {
  console.error('TCP server error:', err);
});

tcpServer.listen(PORT, () => {
  console.log(`TCP server listening on port ${PORT}`);
});

function processClientMessage(socket, msg, clientIp) {
  // trim possible trailing nulls/newlines
  msg = msg.replace(/\0/g, '').trim();
  if (!msg) {
    socket.end();
    return;
  }
  console.log(`Input from ${clientIp}: "${msg}"`);

  const tokens = parseBackslashTokens(msg);
  if (tokens.length === 0) {
    console.log('Malformed string');
    socket.end();
    return;
  }

  // Detect "list" query of form: list, gamename, netpanzer, final
  if (tokens[0] === 'list') {
    // quick validation
    if (tokens.length >= 4 && tokens[1] === 'gamename' && tokens[2] === 'netpanzer' && tokens[3] === 'final') {
      // respond with list
      const now = Date.now() / 1000;
      let resp = '';
      for (let g of gsArr) {
        if (g.status > 0) {
          if ((now - g.timestamp) > TTL_REMOVE_SECONDS) {
            // stale, skip (cleanup interval will remove)
            continue;
          }
          resp += `\\ip\\${g.addr}\\port\\${g.port}`;
        }
      }
      resp += '\\final\\';
      socket.write(resp, () => socket.end());
      console.log('Sent server list to client.');
      return;
    } else {
      socket.end();
      return;
    }
  }

  // Detect heartbeat sequence:
  // tokens example: [ 'heartbeat', 'gamename', 'netpanzer', 'port', '123', 'protocol', '1', 'final' ]
  if (tokens[0] === 'heartbeat') {
    // quick validation by checking positions and values
    let valid = false;
    try {
      if (tokens.length >= 8 &&
          tokens[1] === 'gamename' &&
          tokens[2] === 'netpanzer' &&
          tokens[3] === 'port' &&
          Number(tokens[4]) > 0 &&
          tokens[5] === 'protocol' &&
          Number(tokens[6]) > 0 &&
          tokens[7] === 'final') {
        valid = true;
      }
    } catch (e) { valid = false; }

    if (!valid) {
      console.log('Heartbeat malformed; closing.');
      socket.end();
      return;
    }

    const port_v = parseInt(tokens[4], 10);
    const protocol_v = parseInt(tokens[6], 10);

    console.log(`Heartbeat from ${clientIp}:${port_v} protocol ${protocol_v}`);

    // update list and possibly send UDP echo challenge when new
    let freeIndex = -1;
    let isInit = false;
    const now = Date.now() / 1000;

    for (let i = 0; i < GS_MAX_NUM; i++) {
      const g = gsArr[i];
      if (g.status === 0 && freeIndex === -1) freeIndex = i;
      if (g.status > 0) {
        if (g.addr === clientIp && g.port === port_v) {
          // refresh timestamp
          gsArr[i].timestamp = now;
          isInit = true;
        } else {
          // check expiry
          if ((now - g.timestamp) > TTL_REMOVE_SECONDS) {
            console.log(`Deleting game server ${g.addr} - more than 5 minutes old.`);
            gsArr[i] = { status: 0, addr: '', port: 0, protocol: 0, timestamp: 0, echokey: '' };
          }
        }
      }
    }

    if (!isInit && freeIndex !== -1) {
      // send UDP echo challenge
      const echoKey = Math.floor(Math.random() * 9000) + 1000;
      const echoMsg = `${ECHO_QUERY_PREFIX}${echoKey}`;
      udpSocket.send(echoMsg, 0, echoMsg.length, port_v, clientIp, (err) => {
        if (err) {
          console.error('sendto failed:', err.message);
        } else {
          console.log(`Sent UDP echo challenge "${echoMsg}" to ${clientIp}:${port_v}`);
        }
      });

      gsArr[freeIndex] = {
        status: 1,
        addr: clientIp,
        port: port_v,
        protocol: protocol_v,
        timestamp: now,
        echokey: String(echoKey)
      };
    }

    // reply with final
    socket.write(MS_LIST_QUERY_ANSWER, () => socket.end());
    return;
  }

  // else: unknown -> assume client asked for list (in original code result==0 lead to close)
  console.log('Unknown request, closing connection.');
  socket.end();
}

function shutdown() {
  if (!serverRunning) return;
  serverRunning = false;
  console.log('Shutting down servers...');
  try { tcpServer.close(); } catch (e) {}
  try { udpSocket.close(); } catch (e) {}
  // exit after short delay to flush logs
  setTimeout(() => process.exit(0), 200);
}

// graceful process signals
['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGQUIT'].forEach(sig => {
  process.on(sig, () => {
    console.log(`Signal ${sig} received, shutting down.`);
    shutdown();
  });
});