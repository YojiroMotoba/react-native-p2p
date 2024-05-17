const WebSocket = require('ws');

const wss = new WebSocket.Server({port: 8080});

const clients = {};

wss.on('connection', ws => {
  ws.on('message', message => {
    const data = JSON.parse(message);
    console.log(data.type + '+++++');
    console.log(data);
    if (data.type === 'register') {
      clients[data.id] = ws;
      ws.id = data.id;
    } else if (
      data.type === 'offer' ||
      data.type === 'answer' ||
      data.type === 'candidate'
    ) {
      const target = clients[data.target];
      if (target) {
        target.send(JSON.stringify(data));
      }
    }
  });

  ws.on('close', () => {
    console.log('close-----');
    console.log(ws);
    delete clients[ws.id];
  });
});

console.log('Signaling server is running on ws://localhost:8080');
