// const mongoose = require("mongoose");
const { Notification } = require("../models/notification");

// const fetchNotification = async (req, res) => {
//   try {
//     const { userId } = req.params;

//     console.log("Fetching notifications for userId:", userId);

//     // Ensure userId is converted to a MongoDB ObjectId
//     const notifications = await Notification.aggregate([
//       { $match: { userId:new mongoose.Types.ObjectId(userId) } }, // Convert userId to ObjectId
//       { $sort: { createdAt: -1 } }, // Sort notifications by newest first
//       {
//         $group: {
//           _id: "$postId", // Group by postId
//           likers: {
//             $push: {
//               name: "$likerName", // Collect liker names
//               photo: "$likerPhoto", // Collect liker photos
//             },
//           },
//           count: { $sum: 1 }, // Count total likes
//         },
//       },
//       { $limit: 10 }, // Limit to the most recent 10 groups (optional)
//     ]);

//     console.log("Raw notifications from aggregation:", notifications);

//     // Format the response
//     const formattedNotifications = notifications.map((notification) => {
//       const { likers, count } = notification;
//       let message = "";

//       if (count === 1) {
//         message = `${likers[0].name} liked your post.`;
//       } else if (count === 2) {
//         message = `${likers[0].name} and ${likers[1].name} liked your post.`;
//       } else {
//         message = `${likers[0].name}, ${likers[1].name}, and ${
//           count - 2
//         } others liked your post.`;
//       }

//       return {
//         postId: notification._id,
//         message,
//         likers, // Include liker details (names and photos)
//       };
//     });

//     res.status(200).json(formattedNotifications);
//   } catch (error) {
//     console.error("Error fetching notifications:", error);
//     res.status(500).json({ message: "Failed to fetch notifications", error: error.message });
//   }
// };


  
const fetchNotification = async (req, res) => {
    try {
      const { userId } = req.params;
  
      // Fetch notifications for the user, sorted by creation date
      const notifications = await Notification.find({ userId }).sort({
        createdAt: -1, // Sort by newest first
      });
  
      if (!notifications || notifications.length === 0) {
        return res.status(200).json({ message: "No notifications found" });
      }
  
      // Group notifications by postId
      const groupedNotifications = notifications.reduce((acc, notification) => {
        if (!notification.postId) {
          console.warn(
            `Notification with ID ${notification._id} is missing a postId`
          );
          return acc; // Skip notifications without a postId
        }
  
        const postId = notification.postId.toString();
        if (!acc[postId]) {
          acc[postId] = {
            postId: notification.postId,
            title: notification.title,
            body: notification.body,
            createdAt: notification.createdAt,
            likers: [], // Array to store liker details
          };
        }
        acc[postId].likers.push({
          name: notification.likerName,
          photo: notification.likerPhoto,
        });
        return acc;
      }, {});
  
      // Format grouped notifications
      const formattedNotifications = Object.values(groupedNotifications).map(
        (group) => {
          const likersCount = group.likers.length;
  
          // Construct the notification message
          let message;
          if (likersCount === 1) {
            message = `${group.likers[0].name} liked your post`;
          } else if (likersCount === 2) {
            message = `${group.likers[0].name} and ${group.likers[1].name} liked your post`;
          } else {
            message = `${group.likers[0].name}, ${group.likers[1].name} and ${
              likersCount - 2
            } others liked your post`;
          }
  
          // Prepare photos for the response
          const likersPhotos = group.likers.slice(0, 2).map((liker) => liker.photo);
          const extraCount = likersCount > 2 ? `+${likersCount - 2}` : null;
  
          return {
            postId: group.postId,
            title: group.title,
            body: group.body,
            likersCount, // Total number of likers
            likersPhotos, // Photos of the first two likers
            extraCount, // Number of additional likers
            message,
            createdAt: group.createdAt,
          };
        }
      );
  
      res.status(200).json(formattedNotifications);
    } catch (error) {
      console.error("Error fetching notifications:", error.message);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  };
  
  module.exports = fetchNotification;
  
  
  

module.exports = fetchNotification;
