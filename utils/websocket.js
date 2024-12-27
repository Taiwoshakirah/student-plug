// const WebSocket = require("ws");

// // Create a WebSocket server on port 8080
// const wss = new WebSocket.Server({ port: 8080 });
// const clients = new Map(); // Map of userId (string) to WebSocket connection

// // Handle incoming WebSocket connections
// wss.on("connection", (ws) => {
//   console.log("New client connected!");

//   // Handle initial message to map userId to WebSocket
//   ws.on("message", (message) => {
//     try {
//       const parsedMessage = JSON.parse(message);
//       const userId = parsedMessage.userId; // Extract userId from client message
  
//       if (userId) {
//         clients.set(userId, ws); // Map userId to WebSocket
//         console.log(`Mapped userId ${userId} to WebSocket. Current clients:`, [...clients.keys()]);
//       }
//     } catch (error) {
//       console.error("Error parsing message:", error.message);
//     }
//   });
  

//   // Handle WebSocket disconnection
//   ws.on("close", () => {
//     for (const [userId, client] of clients.entries()) {
//       if (client === ws) {
//         clients.delete(userId); // Remove userId from Map on disconnection
//         console.log(`Client ${userId} disconnected.`);
//         break;
//       }
//     }
//   });
// });

// // Function to send a notification to the post owner
// const sendNotificationToPostOwner = (postOwnerId, notification) => {
//   const client = clients.get(postOwnerId.toString()); // Convert postOwnerId to string
//   if (client && client.readyState === WebSocket.OPEN) {
//     client.send(JSON.stringify(notification)); // Send notification
//     console.log(`Notification sent to post owner ${postOwnerId}:`, notification);
//   } else {
//     console.warn(
//       `Post owner ${postOwnerId} is not connected. Current clients:`,
//       [...clients.keys()]
//     );
//   }
// };

// // Example usage: Call this when a post is liked
// const onPostLiked = (postOwnerId, notification) => {
//   sendNotificationToPostOwner(postOwnerId, notification);
// };

// console.log("WebSocket server is running on ws://localhost:8080");

// module.exports = { onPostLiked };

const WebSocket = require("ws");
const { Notification } = require('../models/notification'); // Notification model

const clients = new Map(); // Map of userId (string) to WebSocket connection

// Function to send unread notifications to the user
const sendUnreadNotifications = async (userId, ws) => {
  try {
    const notifications = await Notification.find({ userId, read: false });

    if (notifications.length > 0) {
      notifications.forEach(notification => {
        ws.send(JSON.stringify(notification)); // Send via WebSocket
        console.log(`Sent unread notification to ${userId}:`, notification);
      });

      // Mark notifications as read once sent
      await Notification.updateMany(
        { userId, read: false },
        { $set: { read: true } }
      );
      console.log(`Marked notifications as read for ${userId}`);
    }
  } catch (error) {
    console.error('Error sending unread notifications:', error);
  }
};

// Function to initialize WebSocket server
const setupWebSocket = (server) => {
  const wss = new WebSocket.Server({ server }); // Attach WebSocket server to existing HTTP server

  wss.on("connection", (ws) => {
    console.log("New WebSocket client connected!");

    // Handle initial message to map userId to WebSocket
    ws.on("message", async (message) => {
      try {
        const parsedMessage = JSON.parse(message);
        const userId = parsedMessage.userId; // Extract userId from client message

        if (userId) {
          clients.set(userId, ws); // Map userId to WebSocket
          console.log(`Mapped userId ${userId} to WebSocket. Current clients:`, [...clients.keys()]);

          // Send unread notifications if available
          await sendUnreadNotifications(userId, ws);
        }
      } catch (error) {
        console.error("Error parsing message:", error.message);
      }
    });

    // Handle WebSocket disconnection
    ws.on("close", () => {
      for (const [userId, client] of clients.entries()) {
        if (client === ws) {
          clients.delete(userId); // Remove userId from Map on disconnection
          console.log(`Client ${userId} disconnected.`);
          break;
        }
      }
    });
  });

  console.log("WebSocket server is running.");
};

// Function to send a notification to the post owner
const sendNotificationToPostOwner = (postOwnerId, notification) => {
  const client = clients.get(postOwnerId.toString()); // Convert postOwnerId to string
  if (client && client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify(notification)); // Send notification
    console.log(`Notification sent to post owner ${postOwnerId}:`, notification);
  } else {
    console.warn(
      `Post owner ${postOwnerId} is not connected. Current clients:`,
      [...clients.keys()]
    );
  }
};

module.exports = { setupWebSocket, sendNotificationToPostOwner, clients };











// const http = require("http"); // Make sure this matches the main server's http import
// const WebSocket = require("ws");

// const setupWebSocket = (server) => {
//   if (!server || typeof server.listen !== "function") {
//     throw new Error("Invalid server passed to setupWebSocket. It must be an HTTP server.");
//   }

//   // Create WebSocket server using the HTTP server instance
//   const wss = new WebSocket.Server({ server });

//   // Map to store user connections
//   const clients = new Map();

//   wss.on("connection", (ws) => {
//     ws.on("message", (message) => {
//       try {
//         const { type, userId } = JSON.parse(message);
//         if (type === "register" && userId) {
//           clients.set(userId, ws);
//         }
//       } catch (err) {
//         console.error("Failed to parse WebSocket message:", err.message);
//       }
//     });

//     ws.on("close", () => {
//       for (const [userId, client] of clients.entries()) {
//         if (client === ws) {
//           clients.delete(userId);
//           break;
//         }
//       }
//     });
//   });

//   const sendNotification = (userId, message) => {
//     const client = clients.get(userId);
//     if (client && client.readyState === WebSocket.OPEN) {
//       client.send(JSON.stringify(message));
//     }
//   };

//   return { wss, sendNotification };
// };

// module.exports = setupWebSocket;










// const admin = require('../app')

// const sendNotification = async (deviceToken, title, body) => {
//   console.log("sendNotification called with:", { deviceToken, title, body });
//   const message = {
//     notification: {
//       title,
//       body,
//     },
//     token: deviceToken,
//   };

//   try {
//     console.log("Sending notification with message:", message);
//     const response = await admin.messaging().send(message);
//     console.log("Notification sent successfully:", response);
//   } catch (error) {
//     console.error("Error sending notification:", error.message);
//   }
// };



// module.exports = { sendNotification };







