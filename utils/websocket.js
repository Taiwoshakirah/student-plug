const admin = require('../app')

const sendNotification = async (deviceToken, title, body) => {
  console.log("sendNotification called with:", { deviceToken, title, body });
  const message = {
    notification: {
      title,
      body,
    },
    token: deviceToken,
  };

  try {
    console.log("Sending notification with message:", message);
    const response = await admin.messaging().send(message);
    console.log("Notification sent successfully:", response);
  } catch (error) {
    console.error("Error sending notification:", error.message);
  }
};




// const { Server } = require("socket.io");

// let io;

// function initWebSocketServer(server) {
//   if (!io) {
//     io = new Server(server, {
//       cors: {
//         origin: [
//           "http://localhost:5173",
//           "https://school-plug.vercel.app",
//         ],
//         methods: ["GET", "POST", "PUT", "DELETE"],
//         credentials: true,
//       },
//     });

//     io.on("connection", (socket) => {
//       const userId = socket.handshake.query.userId;
//       if (userId) {
//         socket.join(userId);
//         console.log(`User ${userId} joined the room`);
//       }

//       socket.on("disconnect", () => {
//         console.log(`User ${userId} disconnected`);
//         socket.leave(userId);
//       });
//     });

//     console.log("WebSocket server initialized");
//   } else {
//     console.log("WebSocket server already initialized");
//   }

//   return { io };
// }

// function sendNotification(userId, message) {
//     try {
//         io.to(userId).emit("notification", message); 
//     } catch (error) {
//         console.error(`Error sending notification to user ${userId}:`, error);
//     }
// }

module.exports = { sendNotification };







