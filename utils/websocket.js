// websocket.js
const WebSocket = require('ws');

let wss;
const connectedClients = new Map();  // Store clients by user ID for targeted messaging

function initWebSocketServer(server) {
    wss = new WebSocket.Server({ server });

    wss.on('connection', (ws, req) => {
        const userId = req.url.split('=')[1];  // Assuming user ID is in query string like ?userId=123
        if (userId) {
            connectedClients.set(userId, ws);  // Store client connection by user ID
        }

        ws.on('close', () => {
            connectedClients.delete(userId);  // Remove user on disconnect
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
// // websocket.js
// const WebSocket = require('ws');

// const clients = {}; // Store clients by userId or adminId

// function initWebSocketServer(server) {
//   const wss = new WebSocket.Server({ server });

//   wss.on('connection', (ws, req) => {
//     const userId = req.headers['user-id']; // Get user ID from headers
//     const adminId = req.headers['admin-id']; // Get admin ID from headers

//     // Save connection to clients object
//     if (userId) clients[userId] = ws;
//     if (adminId) clients[adminId] = ws;

//     console.log(`Client connected: ${userId || adminId}`);

//     // Handle client disconnect
//     ws.on('close', () => {
//       if (userId) delete clients[userId];
//       if (adminId) delete clients[adminId];
//       console.log(`Client disconnected: ${userId || adminId}`);
//     });
//   });
// }

// // Send notification to a specific user or admin
// function sendNotification(id, notification) {
//   const client = clients[id];
//   if (client && client.readyState === WebSocket.OPEN) {
//     client.send(JSON.stringify(notification));
//   }
// }

// module.exports = { initWebSocketServer, sendNotification };
