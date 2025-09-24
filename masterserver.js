// masterserver_full.js

const net = require('net');
const dgram = require('dgram');
const crypto = require('crypto');

const PORT = 28900;
const MAX_SERVERS = 64;
const SERVER_TIMEOUT = 5 * 60 * 1000; // 5 minutos
const ECHO_PREFIX = '\\echo\\';
const FINAL = '\\final\\';
const ADMIN_ADDR = '127.0.0.1';
const SHUTDOWN_CMD = 'shutdown!';

const gsArr = []; // Lista de servidores

// UDP socket
const udpSocket = dgram.createSocket('udp4');

udpSocket.on('message', (msg, rinfo) => {
    const message = msg.toString();
    console.log(`UDP received: ${message} from ${rinfo.address}:${rinfo.port}`);

    if (message === SHUTDOWN_CMD && rinfo.address === ADMIN_ADDR) {
        console.log('Shutting down...');
        udpSocket.close();
        tcpServer.close();
        process.exit(0);
    }

    // Aqui podemos validar echo response, se necessário
});

udpSocket.bind(PORT, () => {
    console.log(`UDP listening on port ${PORT}`);
});

// Função para gerar chave aleatória do echo
function generateEchoKey() {
    return Math.floor(Math.random() * 9000) + 1000; // 1000-9999
}

// TCP server
const tcpServer = net.createServer(socket => {
    let clientIP = socket.remoteAddress.replace('::ffff:', '');
    console.log(`TCP connection from ${clientIP}:${socket.remotePort}`);

    socket.on('data', data => {
        const message = data.toString().trim();
        console.log(`TCP received: ${message} from ${clientIP}`);

        const tokens = message.split('\\').filter(t => t.length > 0);

        if (!tokens.length) return socket.end();

        // Heartbeat
        if (tokens[0] === 'heartbeat') {
            let port = 0;
            let protocol = 0;

            for (let i = 1; i < tokens.length; i += 2) {
                const key = tokens[i];
                const value = tokens[i + 1];
                if (key === 'port') port = parseInt(value);
                if (key === 'protocol') protocol = parseInt(value);
            }

            if (port > 1024 && port < 65535) {
                // Limpa servidores inativos
                const now = Date.now();
                for (let i = gsArr.length - 1; i >= 0; i--) {
                    if (now - gsArr[i].timestamp > SERVER_TIMEOUT) {
                        console.log(`Removing inactive server ${gsArr[i].addr}:${gsArr[i].port}`);
                        gsArr.splice(i, 1);
                    }
                }

                // Verifica se já existe
                let existing = gsArr.find(gs => gs.addr === clientIP && gs.port === port);
                if (existing) {
                    existing.timestamp = now;
                } else if (gsArr.length < MAX_SERVERS) {
                    const echoKey = generateEchoKey();
                    gsArr.push({ addr: clientIP, port, protocol, timestamp: now, echokey: echoKey });

                    // Envia echo challenge via UDP
                    const echoMsg = ECHO_PREFIX + echoKey;
                    udpSocket.send(echoMsg, port, clientIP, err => {
                        if (err) console.error(`UDP send error: ${err}`);
                        else console.log(`Sent UDP echo to ${clientIP}:${port} -> ${echoMsg}`);
                    });
                }

                socket.write(FINAL);
            } else {
                socket.end();
            }
            return;
        }

        // List request
        if (tokens[0] === 'list' &&
            tokens[1] === 'gamename' &&
            tokens[2] === 'netpanzer' &&
            tokens[3] === 'final') {

            // Monta resposta
            let response = '';
            const now = Date.now();
            for (let i = gsArr.length - 1; i >= 0; i--) {
                if (now - gsArr[i].timestamp > SERVER_TIMEOUT) {
                    console.log(`Removing inactive server ${gsArr[i].addr}:${gsArr[i].port}`);
                    gsArr.splice(i, 1);
                    continue;
                }
                response += `\\ip\\${gsArr[i].addr}\\port\\${gsArr[i].port}`;
            }
            response += '\\final\\';
            socket.write(response);
            return;
        }

        socket.end(); // Comando inválido
    });

    socket.on('close', () => {
        console.log(`TCP connection closed: ${clientIP}`);
    });

    socket.on('error', err => {
        console.log(`TCP error: ${err.message}`);
    });
});

tcpServer.listen(PORT, () => {
    console.log(`TCP listening on port ${PORT}`);
});
