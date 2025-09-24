const net = require('net');
const dgram = require('dgram');

const MS_HOST = '127.0.0.1';
const MS_PORT = 28900;

// Heartbeat UDP
const udpClient = dgram.createSocket('udp4');
const heartbeatMsg = '\\heartbeat\\gamename\\netpanzer\\port\\1234\\protocol\\1\\final\\';
udpClient.send(heartbeatMsg, MS_PORT, MS_HOST, err => {
  if (!err) console.log('✅ Heartbeat UDP enviado');
  udpClient.close();
});

// List query TCP
const tcpClient = net.connect(MS_PORT, MS_HOST, () => {
  console.log('✅ Conectado via TCP ao masterserver');
  tcpClient.write('\\list\\gamename\\netpanzer\\final\\');
});

tcpClient.on('data', data => {
  console.log('📄 Resposta TCP (lista de servidores):');
  console.log(data.toString());
  tcpClient.end();
});

tcpClient.on('error', err => console.error(err));
tcpClient.on('end', () => console.log('TCP encerrado'));
