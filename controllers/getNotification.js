// const mongoose = require("mongoose");
const { Notification } = require("../models/notification");
const UserPost = require('../models/post')
const SugPost = require('../models/sugPost')



const fetchNotification = async (req, res) => {
    try {
      const { userId } = req.params;
      const { type } = req.query; // `type` can be 'like', 'comment', or 'all'
  
      console.log("Fetching notifications for user:", userId);
      console.log("Notification type:", type);
  
      const query = { userId };
      if (type && type !== "all") {
        query.type = type; // Filter notifications by type at the database level
      }
  
      const notifications = await Notification.find(query).sort({ createdAt: -1 });
      console.log("Fetched notifications:", notifications);
  
      if (!notifications || notifications.length === 0) {
        return res.status(200).json({ message: "No notifications found" });
      }
  
      const postIds = notifications.map((notification) => notification.postId);
      const userPosts = await UserPost.find({ _id: { $in: postIds } }).select("text");
      const userPostTextMap = userPosts.reduce((acc, post) => {
        acc[post._id.toString()] = post.text;
        return acc;
      }, {});
  
      const missingPostIds = postIds.filter((postId) => !userPostTextMap[postId]);
      const sugPosts = await SugPost.find({ _id: { $in: missingPostIds } }).select("text");
      const sugPostTextMap = sugPosts.reduce((acc, post) => {
        acc[post._id.toString()] = post.text;
        return acc;
      }, {});
  
      const postTextMap = { ...userPostTextMap, ...sugPostTextMap };
  
      const groupedNotifications = notifications.reduce((acc, notification) => {
        if (!notification.postId) return acc;
  
        const postId = notification.postId.toString();
  
        // Initialize a new group for this post if it doesn't exist
        if (!acc[postId]) {
          acc[postId] = {
            postId: notification.postId,
            title: notification.title,
            body: notification.body,
            text: postTextMap[postId] || "",
            createdAt: notification.createdAt,
            isRead: notification.read || false,
            notificationId: notification._id,
            likes: [],
            comments: [],
          };
        }
  
        // Handle "like" notifications
        if (notification.type === "like") {
          const likeExists = acc[postId].likes.some(
            (like) => like.name === notification.likerName
          );
          if (!likeExists) {
            acc[postId].likes.push({
              name: notification.likerName,
              photo: notification.likerPhoto,
            });
          }
        }
  
        // Handle "comment" notifications
        if (notification.type === "comment") {
          const commentExists = acc[postId].comments.some(
            (comment) => comment.commentId === notification.commentId
          );
          if (!commentExists) {
            acc[postId].comments.push({
              name: notification.likerName,
              photo: notification.likerPhoto,
              comment: notification.body,
              commentId: notification.commentId,
              notificationId: notification._id, // Ensure notificationId is added for comments
            });
          }
        }
  
        return acc;
      }, {});
  
      const filteredGroupedNotifications = Object.values(groupedNotifications).map((group) => {
        const likersCount = group.likes.length;
        const commentersCount = group.comments.length;
  
        let notificationsToReturn = [];
  
        if (!type || type === "like" || type === "all") {
          let likeMessage = "";
          if (likersCount === 1) {
            likeMessage = `${group.likes[0].name} liked your post`;
          } else if (likersCount === 2) {
            likeMessage = `${group.likes[0].name} and ${group.likes[1].name} liked your post`;
          } else if (likersCount > 2) {
            likeMessage = `${group.likes[0].name}, ${group.likes[1].name} and ${
              likersCount - 2
            } others liked your post`;
          }
  
          if (likersCount > 0) {
            notificationsToReturn.push({
              notificationId: group.notificationId,
              postId: group.postId,
              title: "Your post was liked",
              text: group.text,
              body: likeMessage,
              message: likeMessage,
              createdAt: group.createdAt,
              isRead: group.isRead,
              count: likersCount,
              photo: group.likes.slice(0, 2).map((liker) => liker.photo),
            });
          }
        }
  
        if (!type || type === "comment" || type === "all") {
          let commentMessage = "";
          if (commentersCount === 1) {
            commentMessage = `${group.comments[0].name} commented on your post`;
          } else if (commentersCount === 2) {
            commentMessage = `${group.comments[0].name} and ${group.comments[1].name} commented on your post`;
          } else if (commentersCount > 2) {
            commentMessage = `${group.comments[0].name}, ${group.comments[1].name} and ${
              commentersCount - 2
            } others commented on your post`;
          }
  
          if (commentersCount > 0) {
            notificationsToReturn.push({
              notificationId: group.comments[0].notificationId,  // Ensure comment notificationId is returned
              postId: group.postId,
              title: "Your post has new comments",
              text: group.text,
              body: commentMessage,
              message: commentMessage,
              createdAt: group.createdAt,
              isRead: group.isRead,
              count: commentersCount,
              photo: group.comments.slice(0, 2).map((commenter) => commenter.photo),
            });
          }
        }
  
        return notificationsToReturn;
      });
  
      const formattedNotifications = filteredGroupedNotifications.flat();
  
      res.status(200).json(formattedNotifications);
    } catch (error) {
      console.error("Error fetching notifications:", error.message);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  };
  
  
  
//   const fetchNotification = async (req, res) => {
//     try {
//       const { userId } = req.params;
//       const { type } = req.query; // `type` can be 'likes', 'comments', or 'all'
  
//       console.log("Fetching notifications for user:", userId);
//       console.log("Notification type:", type);
  
//       const query = { userId };
//       if (type && type !== "all") {
//         query.type = type;
//       }
  
//       const notifications = await Notification.find(query).sort({ createdAt: -1 });
//       console.log("Fetched notifications:", notifications);
  
//       if (!notifications || notifications.length === 0) {
//         return res.status(200).json({ message: "No notifications found" });
//       }
  
//       const postIds = notifications.map((notification) => notification.postId);
//       const userPosts = await UserPost.find({ _id: { $in: postIds } }).select("text");
//       const userPostTextMap = userPosts.reduce((acc, post) => {
//         acc[post._id.toString()] = post.text;
//         return acc;
//       }, {});
  
//       const missingPostIds = postIds.filter((postId) => !userPostTextMap[postId]);
//       const sugPosts = await SugPost.find({ _id: { $in: missingPostIds } }).select("text");
//       const sugPostTextMap = sugPosts.reduce((acc, post) => {
//         acc[post._id.toString()] = post.text;
//         return acc;
//       }, {});
  
//       const postTextMap = { ...userPostTextMap, ...sugPostTextMap };
  
//       const groupedNotifications = notifications.reduce((acc, notification) => {
//         if (!notification.postId) return acc;
  
//         const postId = notification.postId.toString();
  
//         // Initialize a new group for this post if it doesn't exist
//         if (!acc[postId]) {
//           acc[postId] = {
//             postId: notification.postId,
//             title: notification.title,
//             body: notification.body,
//             text: postTextMap[postId] || "",
//             createdAt: notification.createdAt,
//             likes: [],
//             comments: [],
//           };
//         }
  
//         // Handle "like" notifications
//         if (notification.type === "like") {
//           // Avoid duplicate likes for the same user
//           const likeExists = acc[postId].likes.some(
//             (like) => like.name === notification.likerName
//           );
//           if (!likeExists) {
//             acc[postId].likes.push({
//               name: notification.likerName,
//               photo: notification.likerPhoto,
//             });
//           }
//         }
  
//         // Handle "comment" notifications
//         if (notification.type === "comment") {
//           // Avoid duplicate comments based on `commentId`
//           const commentExists = acc[postId].comments.some(
//             (comment) => comment.commentId === notification.commentId
//           );
//           if (!commentExists) {
//             acc[postId].comments.push({
//               name: notification.likerName,
//               photo: notification.likerPhoto,
//               comment: notification.body,
//               commentId: notification.commentId, // Include the `commentId` for uniqueness
//             });
//           }
//         }
  
//         return acc;
//       }, {});
  
//       const formattedNotifications = Object.values(groupedNotifications).map((group) => {
//         const likersCount = group.likes.length;
//         const commentersCount = group.comments.length;
      
//         // Create like message
//         let likeMessage = "";
//         if (likersCount === 1) {
//           likeMessage = `${group.likes[0].name} liked your post`;
//         } else if (likersCount === 2) {
//           likeMessage = `${group.likes[0].name} and ${group.likes[1].name} liked your post`;
//         } else if (likersCount > 2) {
//           likeMessage = `${group.likes[0].name}, ${group.likes[1].name} and ${likersCount - 2} others liked your post`;
//         }
      
//         // Create comment message
//         let commentMessage = "";
//         if (commentersCount === 1) {
//           commentMessage = `${group.comments[0].name} commented on your post`;
//         } else if (commentersCount === 2) {
//           commentMessage = `${group.comments[0].name} and ${group.comments[1].name} commented on your post`;
//         } else if (commentersCount > 2) {
//           commentMessage = `${group.comments[0].name}, ${group.comments[1].name} and ${commentersCount - 2} others commented on your post`;
//         }

//         // Extract the read status
//   const likeRead = group.likes.some((like) => like.read) ? true : false;
//   const commentRead = group.comments.some((comment) => comment.read) ? true : false;

      
//         // Conditional assignment for title and body based on the notification type
//         const likeTitle = `Your post was liked`;
//         const likeBody = likeMessage;
      
//         const commentTitle = `Your post has new comments`;
//         const commentBody = commentMessage;
      
//         // Return two separate notifications: one for likes and one for comments
//         return [
//           {
//             postId: group.postId,
//             title: likeTitle,
//             text: group.text,
//             body: likeBody,
//             createdAt: group.createdAt,
//             count: likersCount,
//             message: likeMessage,
//             isRead: likeRead,
//             photo: group.likes.slice(0, 2).map((liker) => liker.photo).concat(
//               likersCount > 2 ? [`+${likersCount - 2} others`] : []
//             ),
//           },
//           {
//             postId: group.postId,
//             title: commentTitle,
//             text: group.text,
//             body: commentBody,
//             createdAt: group.createdAt,
//             count: commentersCount,
//             message: commentMessage,
//             isRead: commentRead,
//             photo: group.comments.slice(0, 2).map((commenter) => commenter.photo).concat(
//               commentersCount > 2 ? [`+${commentersCount - 2} others`] : []
//             ),
//           },
//         ];
//       }).flat(); // Flatten the array to combine the two notifications
      
//       res.status(200).json(formattedNotifications);
      
//         // res.status(200).json(formattedNotifications);
        
        
//     } catch (error) {
//       console.error("Error fetching notifications:", error.message);
//       res.status(500).json({ message: "Failed to fetch notifications" });
//     }
//   };
  

  


  
  
  
  

module.exports = fetchNotification;
