



// const clients = new Map(); // Map of userId (string) to WebSocket connection

// Function to send unread notifications to the user
// const sendUnreadNotifications = async (userId, ws) => {
//   try {
//     const notifications = await Notification.find({ userId, read: false });

//     if (notifications.length > 0) {
//       notifications.forEach(notification => {
//         ws.send(JSON.stringify(notification)); // Send via WebSocket
//         console.log(`Sent unread notification to ${userId}:`, notification);
//       });

//       // Mark notifications as read once sent
//       await Notification.updateMany(
//         { userId, read: false },
//         { $set: { read: true } }
//       );
//       console.log(`Marked notifications as read for ${userId}`);
//     }
//   } catch (error) {
//     console.error('Error sending unread notifications:', error);
//   }
// };

// // Function to initialize WebSocket server
// const setupWebSocket = (server) => {
//   const wss = new WebSocket.Server({ server }); // Attach WebSocket server to existing HTTP server

//   wss.on("connection", (ws) => {
//     console.log("New WebSocket client connected!");

//     // Handle initial message to map userId to WebSocket
//     ws.on("message", async (message) => {
//       try {
//         const parsedMessage = JSON.parse(message);
//         const userId = parsedMessage.userId; // Extract userId from client message

//         if (userId) {
//           clients.set(userId, ws); // Map userId to WebSocket
//           console.log(`Mapped userId ${userId} to WebSocket. Current clients:`, [...clients.keys()]);

//           // Send unread notifications if available
//           await sendUnreadNotifications(userId, ws);
//         }
//       } catch (error) {
//         console.error("Error parsing message:", error.message);
//       }
//     });

//     // Handle WebSocket disconnection
//     ws.on("close", () => {
//       for (const [userId, client] of clients.entries()) {
//         if (client === ws) {
//           clients.delete(userId); // Remove userId from Map on disconnection
//           console.log(`Client ${userId} disconnected.`);
//           break;
//         }
//       }
//     });
//   });

//   console.log("WebSocket server is running.");
// };

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

const WebSocket = require("ws");
const { Notification } = require('../models/notification'); 
const jwt = require("jsonwebtoken"); 
const clients = new Map(); 

const sendUnreadNotifications = async (userId, ws) => {
  try {
    const notifications = await Notification.find({ userId, read: false });
    if (notifications.length > 0) {
      notifications.forEach((notification) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(notification));
          console.log(`Sent unread notification to ${userId}:`, notification);
        }
      });

      await Notification.updateMany(
        { userId, read: false },
        { $set: { read: true } }
      );
      console.log(`Marked notifications as read for ${userId}`);
    }
  } catch (error) {
    console.error("Error sending unread notifications:", error.message);
  }
};

const setupWebSocket = (server) => {
  const wss = new WebSocket.Server({ server });

  wss.on("connection", (ws) => {
    console.log("New WebSocket client connected!");

    // Send a periodic ping to keep the connection alive
    const interval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, 30000);

    ws.on("pong", () => {
      console.log("Pong received from client");
    });

    ws.on("message", async (message) => {
      try {
        const parsedMessage = JSON.parse(message);
        const { userId, token } = parsedMessage;

        if (!userId || !token) {
          ws.close(4000, "Missing credentials");
          console.warn("Connection closed: Missing credentials");
          return;
        }

        let decoded;
        try {
          decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
          ws.close(4001, "Invalid token");
          console.warn("Connection closed: Invalid token");
          return;
        }

        if (decoded.userId !== userId) {
          ws.close(4002, "Token mismatch");
          console.warn("Connection closed: Token mismatch");
          return;
        }

        // Add or update the client mapping without closing existing WebSocket
        const existingClient = clients.get(userId);
        if (existingClient && existingClient !== ws) {
          console.log(`User ${userId} already connected. Updating connection.`);
          clients.set(userId, ws); // Update to new WebSocket
        } else if (!existingClient) {
          clients.set(userId, ws);
        }

        console.log(`Mapped userId ${userId} to WebSocket. Current clients:`, [...clients.keys()]);

        // Send unread notifications
        await sendUnreadNotifications(userId, ws);
      } catch (error) {
        console.error("Error handling message:", error.message);
      }
    });

    ws.on("close", () => {
      clearInterval(interval);
      for (const [userId, client] of clients.entries()) {
        if (client === ws) {
          clients.delete(userId);
          console.log(`Client ${userId} disconnected. Current clients:`, [...clients.keys()]);
          break;
        }
      }
    });

    ws.on("error", (error) => {
      clearInterval(interval);
      console.error("WebSocket error:", error.message);
      for (const [userId, client] of clients.entries()) {
        if (client === ws) {
          clients.delete(userId);
          console.log(`Removed faulty WebSocket for user ${userId}`);
          break;
        }
      }
    });
  });

  console.log("WebSocket server is running.");
};
const userLikeTracking = new Map();

const sendNotificationToPostOwner = (postOwnerId, notification) => {
  const client = clients.get(postOwnerId.toString());
  if (client && client.readyState === WebSocket.OPEN) {
    try {
      const { type, userId, postId } = notification; // Assuming notification has these fields
      
      if (type === "like") {
        const userLikes = userLikeTracking.get(userId) || new Set();
        
        if (notification.action === "unlike") {
          // Remove postId from the user's "likes" tracking if they unlike
          userLikes.delete(postId);
          userLikeTracking.set(userId, userLikes);
          console.log(`"Unlike" action processed for post ${postId} by user ${userId}`);
        } else if (!userLikes.has(postId)) {
          // Send "like" notification only if not sent before
          userLikes.add(postId);
          userLikeTracking.set(userId, userLikes);
          
          client.send(JSON.stringify(notification));
          console.log(`"Like" notification sent to post owner ${postOwnerId}:`, notification);
        } else {
          console.log(`"Like" notification for post ${postId} already sent to user ${userId}`);
        }
      } else if (type === "comment") {
        // Always send "comment" notifications
        client.send(JSON.stringify(notification));
        console.log(`"Comment" notification sent to post owner ${postOwnerId}:`, notification);
      }
    } catch (error) {
      console.error(`Failed to send notification to ${postOwnerId}:`, error.message);
    }
  } else {
    console.warn(`Post owner ${postOwnerId} is not connected.`);
  }
};



module.exports = { setupWebSocket, sendNotificationToPostOwner, clients };























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







