// const { Server } = require("socket.io");

// let io;

// function initWebSocketServer(server) {
//     if (!io) {
//         io = new Server(server, {
//             cors: {
//                 origin: [
//                     "http://localhost:5173",
//                     "https://school-plug.vercel.app",
//                 ],
//                 methods: ["GET", "POST", "PUT", "DELETE"],
//                 credentials: true,
//             },
//         });

//         io.on("connection", (socket) => {
//             const userId = socket.handshake.query.userId;
//             if (userId) {
//                 socket.join(userId);
//                 console.log(`User ${userId} joined the room`);
//             } else {
//                 console.warn("Connection attempt without userId");
//             }

//             socket.on("disconnect", () => {
//                 if (userId) {
//                     console.log(`User ${userId}`, disconnected);
//                     socket.leave(userId);
//                 }
//             });
//         });

//         console.log("WebSocket server initialized");
//     } else {
//         console.log("WebSocket server already initialized");
//     }
// }

// function sendNotification(userId, message) {
//     if (!io) {
//         console.error("WebSocket server not initialized");
//         return;
//     }

//     try {
//         io.to(userId).emit("notification", message);
//     } catch (error) {
//         console.error(Error `sending notification to user ${userId}:`, error);
//     }
// }

// module.exports = { initWebSocketServer, sendNotification };


const { Server } = require("socket.io");

let io;

function initWebSocketServer(server) {
  if (!io) {
    io = new Server(server, {
      cors: {
        origin: [
          "http://localhost:5173",
          "https://school-plug.vercel.app",
        ],
        methods: ["GET", "POST", "PUT", "DELETE"],
        credentials: true,
      },
    });

    io.on("connection", (socket) => {
      const userId = socket.handshake.query.userId;
      if (userId) {
        socket.join(userId);
        console.log(`User ${userId} joined the room`);
      }

      socket.on("disconnect", () => {
        console.log(`User ${userId} disconnected`);
        socket.leave(userId);
      });
    });

    console.log("WebSocket server initialized");
  } else {
    console.log("WebSocket server already initialized");
  }

  return { io };
}

function sendNotification(userId, message) {
    try {
        io.to(userId).emit("notification", message); 
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
