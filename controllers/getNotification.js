// const mongoose = require("mongoose");
const { Notification } = require("../models/notification");
const UserPost = require('../models/post')
const SugPost = require('../models/sugPost')


  
// const fetchNotification = async (req, res) => {
//     try {
//       const { userId } = req.params;
  
//       // Fetch notifications for the user, sorted by creation date
//       const notifications = await Notification.find({ userId }).sort({
//         createdAt: -1, // Sort by newest first
//       });
  
//       if (!notifications || notifications.length === 0) {
//         return res.status(200).json({ message: "No notifications found" });
//       }
  
//       // Fetch related posts to include the text
//       const postIds = notifications.map((notification) => notification.postId);
  
//       // Fetch posts from UserPost
//       const userPosts = await UserPost.find({ _id: { $in: postIds } }).select("text");
//       const userPostTextMap = userPosts.reduce((acc, post) => {
//         acc[post._id.toString()] = post.text;
//         return acc;
//       }, {});
  
//       // Identify missing postIds and fetch from SugPost
//       const missingPostIds = postIds.filter((postId) => !userPostTextMap[postId]);
//       const sugPosts = await SugPost.find({ _id: { $in: missingPostIds } }).select("text");
//       const sugPostTextMap = sugPosts.reduce((acc, post) => {
//         acc[post._id.toString()] = post.text;
//         return acc;
//       }, {});
  
//       // Combine the post text maps
//       const postTextMap = { ...userPostTextMap, ...sugPostTextMap };
  
//       // Group notifications by postId
//       const groupedNotifications = notifications.reduce((acc, notification) => {
//         if (!notification.postId) {
//           console.warn(
//             `Notification with ID ${notification._id} is missing a postId`
//           );
//           return acc; // Skip notifications without a postId
//         }
  
//         const postId = notification.postId.toString();
//         if (!acc[postId]) {
//           acc[postId] = {
//             postId: notification.postId,
//             title: notification.title,
//             body: notification.body, // Keep the notification body as it is
//             text: postTextMap[postId] || "", // Use the post's text from UserPost or SugPost
//             createdAt: notification.createdAt,
//             likers: [], // Array to store liker details
//           };
//         }
//         acc[postId].likers.push({
//           name: notification.likerName,
//           photo: notification.likerPhoto,
//         });
//         return acc;
//       }, {});
  
//       // Format grouped notifications
//       const formattedNotifications = Object.values(groupedNotifications).map(
//         (group) => {
//           const likersCount = group.likers.length;
  
//           // Construct the notification message
//           let message;
//           if (likersCount === 1) {
//             message = `${group.likers[0].name} liked your post`;
//           } else if (likersCount === 2) {
//             message = `${group.likers[0].name} and ${group.likers[1].name} liked your post`;
//           } else {
//             message = `${group.likers[0].name}, ${group.likers[1].name} and ${
//               likersCount - 2
//             } others liked your post`;
//           }
  
//           // Prepare photos for the response
//           const likersPhotos = group.likers.slice(0, 2).map((liker) => liker.photo);
//           const extraCount = likersCount > 2 ? `+${likersCount - 2}` : null;
  
//           return {
//             postId: group.postId,
//             title: group.title,
//             text: group.text, // Post's text
//             body: group.body, // Keep only the notification body
//             likersCount, // Total number of likers
//             likersPhotos, // Photos of the first two likers
//             extraCount, // Number of additional likers
//             message,
//             createdAt: group.createdAt,
//           };
//         }
//       );
  
//       res.status(200).json(formattedNotifications);
//     } catch (error) {
//       console.error("Error fetching notifications:", error.message);
//       res.status(500).json({ message: "Failed to fetch notifications" });
//     }
//   };

const fetchNotification = async (req, res) => {
    try {
      const { userId } = req.params;
      const { type } = req.query; // `type` can be 'likes', 'comments', or 'all'
  
      console.log("Fetching notifications for user:", userId);
      console.log("Notification type:", type);
  
      // Build the query to filter by userId and type
      const query = { userId };
      if (type && type !== "all") {
        query.type = type; // Only add the type condition if it's 'likes' or 'comments'
      }
  
      // Fetch notifications based on the query, sorted by creation date
      const notifications = await Notification.find(query).sort({ createdAt: -1 });
  
      console.log("Fetched notifications:", notifications);
  
      if (!notifications || notifications.length === 0) {
        return res.status(200).json({ message: "No notifications found" });
      }
  
      // Continue with the rest of your code...
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
  
      // Group notifications by postId
      const groupedNotifications = notifications.reduce((acc, notification) => {
        if (!notification.postId) return acc;
  
        const postId = notification.postId.toString();
        if (!acc[postId]) {
          acc[postId] = {
            postId: notification.postId,
            title: notification.title,
            body: notification.body,
            text: postTextMap[postId] || "",
            createdAt: notification.createdAt,
            likers: [],
            commenters: [],
          };
        }
  
        if (notification.type === "like") {
          acc[postId].likers.push({
            name: notification.likerName,
            photo: notification.likerPhoto,
          });
        } else if (notification.type === "comment") {
          acc[postId].commenters.push({
            name: notification.likerName,
            photo: notification.likerPhoto,
            comment: notification.body,
          });
        }
  
        return acc;
      }, {});
  
      // Format grouped notifications
      const formattedNotifications = Object.values(groupedNotifications).map((group) => {
        const likersCount = group.likers.length;
        const commentersCount = group.commenters.length;
      
        let likeMessage = "";
        if (likersCount === 1) {
          likeMessage = `${group.likers[0].name} liked your post`;
        } else if (likersCount === 2) {
          likeMessage = `${group.likers[0].name} and ${group.likers[1].name} liked your post`;
        } else if (likersCount > 2) {
          likeMessage = `${group.likers[0].name}, ${group.likers[1].name} and ${likersCount - 2} others liked your post`;
        }
      
        let commentMessage = "";
        if (commentersCount === 1) {
          commentMessage = `${group.commenters[0].name} commented on your post`;
        } else if (commentersCount > 1) {
          commentMessage = `${commentersCount} people commented on your post`;
        }
      
        // Filter fields based on type
        const notification = {
          postId: group.postId,
          title: group.title,
          text: group.text,
          body: group.body,
          createdAt: group.createdAt,
        };
      
        if (type === "like") {
          notification.likersCount = likersCount;
          notification.likersPhotos = group.likers.slice(0, 2).map((liker) => liker.photo);
          notification.likeMessage = likeMessage;
        } else if (type === "comment") {
          notification.commentersCount = commentersCount;
          notification.commentersPhotos = group.commenters.slice(0, 2).map((commenter) => commenter.photo);
          notification.commentMessage = commentMessage;
        } else {
          // Include all fields for type=all or no type specified
          notification.likersCount = likersCount;
          notification.commentersCount = commentersCount;
          notification.likersPhotos = group.likers.slice(0, 2).map((liker) => liker.photo);
          notification.commentersPhotos = group.commenters.slice(0, 2).map((commenter) => commenter.photo);
          notification.likeMessage = likeMessage;
          notification.commentMessage = commentMessage;
        }
      
        return notification;
      });
      
  
      res.status(200).json(formattedNotifications);
    } catch (error) {
      console.error("Error fetching notifications:", error.message);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  };
  
  
  
  

module.exports = fetchNotification;
