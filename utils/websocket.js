const WebSocket = require('ws');

let wss;
const connectedClients = new Map();  

function initWebSocketServer(server) {
    wss = new WebSocket.Server({ server });

    wss.on('connection', (ws, req) => {
        const userId = req.url.split('=')[1];  
        if (userId) {
            connectedClients.set(userId, ws);  
        }

        ws.on('close', () => {
            connectedClients.delete(userId);  
        });
    });
}

function sendNotification(userId, message) {
    const client = connectedClients.get(userId);
    if (client && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
    }
}

module.exports = { initWebSocketServer, sendNotification };
