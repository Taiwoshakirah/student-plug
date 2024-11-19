const { Server } = require("socket.io");

const allowedOrigins = [
    "http://localhost:5173", 
    "https://school-plug.vercel.app"
];

let io; 

function initWebSocketServer(server) {
    io = new Server(server, {
        cors: {
            origin: allowedOrigins, // Use an array of strings directly here
            methods: ["GET", "POST", "PUT", "DELETE"], 
            allowedHeaders: ["Content-Type", "Authorization"], 
            credentials: true, // Allow credentials like cookies
        },
    });

    // Handle new connections
    io.on("connection", (socket) => {
        const userId = socket.handshake.query.userId; // Get userId from query parameters
        if (userId) {
            socket.join(userId); // Join a room for the user
            console.log(`User ${userId} joined the room`);
        }

        socket.on("disconnect", () => {
            console.log(`User ${userId} disconnected`);
            socket.leave(userId); // Leave the room on disconnect
        });
    });
}

function sendNotification(userId, message) {
    try {
        io.to(userId).emit("notification", message); // Emit a notification to a specific user
    } catch (error) {
        console.error(`Error sending notification to user ${userId}:`, error);
    }
}
// here is modu
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
