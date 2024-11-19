const { Server } = require('socket.io');
const corsOptions = {
    origin: [
      "http://localhost:5173", 
      "https://school-plug.vercel.app", 
    ],
    methods: ["GET", "POST", "PUT", "DELETE"], 
    allowedHeaders: ["Content-Type", "Authorization"], 
    credentials: true, 
  };
let io; 
function initWebSocketServer(server) {
    io = new Server(server, {
        cors: {
            origin: corsOptions, 
        },
    });
// Handle new connections
    io.on('connection', (socket) => {
        const userId = socket.handshake.query.userId;
        if (userId) {
            socket.join(userId);
            console.log(`User ${userId} joined the room`);
        }
       socket.on('disconnect', () => {
            console.log(`User ${userId} disconnected`);
            socket.leave(userId);
        });
    });
}
function sendNotification(userId, message) {
    try {
        io.to(userId).emit('notification', message);
    } catch (error) {
        console.error(`Error sending notification to user ${userId}:`, error);
    }
}

module.exports = { initWebSocketServer, sendNotification };





// const WebSocket = require('ws');

// let wss;
// const connectedClients = new Map();  

// function initWebSocketServer(server) {
//     wss = new WebSocket.Server({ server });

//     wss.on('connection', (ws, req) => {
//         const userId = req.url.split('=')[1];  
//         if (userId) {
//             connectedClients.set(userId, ws);  
//         }

//         ws.on('close', () => {
//             connectedClients.delete(userId);  
//         });
//     });
// }

// function sendNotification(userId, message) {
//     const client = connectedClients.get(userId);
//     if (client && client.readyState === WebSocket.OPEN) {
//         client.send(JSON.stringify(message));
//     }
// }

// module.exports = { initWebSocketServer, sendNotification };
