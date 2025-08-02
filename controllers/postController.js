const UserPost = require('../models/post')
// const UserComment = require('../models/comment')
const SugPost = require('../models/sugPost')
const {uploadToCloudinary} = require('../config/cloudinaryConfig')
const User = require('../models/signUp'); 
const StudentInfo = require('../models/studentInfo'); 
const mongoose = require('mongoose');
const { cloudinary } = require('../config/cloudinaryConfig');
const Roles = require('../middlewares/role');
const SugUser = require('../models/schoolSug')
const  sendNotification  = require('../utils/websocket');
const {extractHashtags} = require('./trendingController')
const admin = require('../app')
const {sendNotificationToPostOwner} = require('../utils/websocket')
const { Notification } = require('../models/notification');
const { clients } = require('../utils/websocket');
const websocket = require('ws')
const SchoolInfo = require('../models/schoolInfo')
const restrictedWords = [
    "abuse",
    "idiot",
    "stupid",
    "dumb",
    "hate",
    "kill",
    "darn",
    "shut up",
    "loser",
    "moron",
    "jerk",
    "fool",
    "racist",
    "terrorist",
    "scam",
    "fraud",
    "offend",
    "nonsense",
    "trash",
    "dirtbag",
    "lame",
    "pervert",
    "filth",
    "bastard",
    "threaten",
    "mock",
    "harass",
    "attack",
    "insult",
    "creep",
    "creepy",
    "sick",
    "weird",
    "pathetic",
    "crap",
    "spam",
    "bully",
    "toxic",
    "unacceptable",
    "disgusting",
    "rude",
    "unwanted",
    "sex",
    "dirty",
    "rape",
    "immoral",
    "nasty",
    "shame",
    "vulgar",
    "offensive",
    "disrespectful",
    "aggressive",
    "lousy",
    "annoying",
    "unpleasant",
    "disturb",
    "harassment",
    "mad"
];


const containsRestrictedWords = (text) => {
    return restrictedWords.some((word) => text.toLowerCase().includes(word));
};

const studentCreatePost = async (req, res) => {
    try {
        const { userId, text } = req.body;
        let imageUrls = [];

        // Validate for restricted words in text if present
        if (text && containsRestrictedWords(text)) {
            return res.status(400).json({ message: "Your post contains inappropriate content." });
        }

        // Handle image uploads if present
        if (req.files && req.files.image) {
            const images = Array.isArray(req.files.image) ? req.files.image : [req.files.image];
            for (const image of images) {
                const tempPath = `./tmp/${image.name}`;
                await image.mv(tempPath);
                const result = await uploadToCloudinary(tempPath);
                if (result && result.secure_url) {
                    imageUrls.push(result.secure_url);
                }
            }
        }

        // Validate that there is at least one of text or image
        if (!text && imageUrls.length === 0) {
            return res.status(400).json({ message: "Please provide either text or an image" });
        }

        // Check if the user exists and fetch the necessary info
        const user = await User.findById(userId)
            .populate('schoolInfoId')
            .populate({
                path: 'studentInfo',
                model: 'StudentInfo',
                select: 'faculty department'
            });
        
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Extract hashtags and check for trending hashtags (only if text is provided)
        const isTrending = text ? extractHashtags(text).some((hashtag) =>
            ["#trending", "#viral"].includes(hashtag.toLowerCase())
        ) : false;

        const schoolInfoId = user.schoolInfoId;
        if (!schoolInfoId) {
            return res.status(400).json({ message: "User is not associated with a school" });
        }

        // Create post
        const post = new UserPost({
            user: userId,
            text,
            images: imageUrls,
            schoolInfoId: user.schoolInfoId,
            trending: isTrending, 
        });
        await post.save();

// Emit an event for new posts
postEventEmitter.emit("newPost", {
    message: "New student post available!",
    post: {
        text: post.text,
        images: post.images,
        user: userId,
        schoolInfoId: user.schoolInfoId,
    }
});


        res.status(201).json({
            message: "Post created successfully",
            post: {
                ...post.toObject(),
                images: post.images
            },
            studentInfo: {
                faculty: user.studentInfo ? user.studentInfo.faculty : 'N/A',
                department: user.studentInfo ? user.studentInfo.department : 'N/A'
            },
            profilePicture: user.profilePhoto || null,
            schoolInfo: {
                id: schoolInfoId._id,
                university: schoolInfoId.university
            }
        });
        console.log('Post with populated studentInfo:', post);
    } catch (error) {
        console.error("Error creating post:", error);
        res.status(500).json({ message: "Failed to create post", error });
    }
};





const sharePost = async (req, res) => {
    try {
        const { userId } = req.body;
        const { postId } = req.params;

        const post = await UserPost.findById(postId);
        if (!post) return res.status(404).json({ message: "Post not found" });

        if (post.shares.includes(userId)) {
            return res.status(400).json({ message: "User has already shared this post" });
        }

        post.shares.push(userId);
        await post.save();

        res.status(200).json({ message: "Post shared", post });
    } catch (error) {
        console.error("Error sharing post:", error);
        res.status(500).json({ message: "Failed to share post", error });
    }
};

const likePost = async (req, res) => {
  try {
    const { userId, isAdminPost } = req.body;
    const { postId } = req.params;

    let post;
    if (isAdminPost) {
      post = await SugPost.findById(postId);
    } else {
      post = await UserPost.findById(postId);
    }

    if (!post) {
      console.error("Post not found for postId:", postId);
      return res.status(404).json({ message: "Post not found" });
    }

    if (!post.likes) post.likes = [];
    if (!post.likeCount && post.likeCount !== 0) post.likeCount = 0;

    const postOwnerId = isAdminPost ? post.adminId : post.user;
    if (!postOwnerId) {
      console.error("Post owner not found for post:", post);
      return res.status(400).json({ message: "Post owner not found" });
    }

    // Check if the user already liked the post
    const existingLikeIndex = post.likes.findIndex(
      (like) => like._id && like._id.toString() === userId
    );

    if (existingLikeIndex !== -1) {
      // Unlike the post
      post.likes.splice(existingLikeIndex, 1);
      post.likeCount = Math.max(0, post.likes.length); // Update likeCount to match likes array
      await post.save();

      console.log(`User ${userId} unliked the post`);
      return res.status(200).json({
        message: "Post unliked",
        post: { ...post.toObject(), likes: post.likes },
      });
    }

    // Like the post
    const liker = await User.findById(userId) ||await SugUser.findById(userId);

    if (!liker) {
      console.error("Liker not found for userId:", userId);
      return res.status(404).json({ message: "User not found" });
    }
    
    
let fullName = liker.fullName || liker.sugFullName;
let likerPhoto = liker.profilePhoto;

if (!fullName || !likerPhoto) {
  console.log("User details not found, checking admin details...");

  const adminDetails = await SugUser.findById(userId);
  const adminSchoolInfo = await SchoolInfo.findOne({ userId: new mongoose.Types.ObjectId(userId) });

  if (adminDetails) {
    fullName = fullName || adminDetails.sugFullName;
  }

  if (adminSchoolInfo) {
    likerPhoto = likerPhoto || adminSchoolInfo.uniProfilePicture;
  }

  if (!fullName || !likerPhoto) {
    console.error("Unable to retrieve fullName or photo for liker:", userId);
    return res.status(404).json({ message: "Failed to retrieve liker details" });
  }
}


    
    post.likes.push({
      _id: liker._id.toString(),
      fullName,
      likerPhoto,
      createdAt: new Date(),
    });
    
    post.likeCount = post.likes.length; 
    await post.save();
    
    console.log("Post likes array after like:", post.likes);
    
    // Check if the same user already has a like notification for this post
    const existingLikeNotification = await Notification.findOne({
      userId: postOwnerId,
      postId: postId,
      type: "like",
      likerName: fullName,
    });
    
    if (!existingLikeNotification && postOwnerId.toString() !== userId) {
      const notification = {
        userId: postOwnerId,
        title: "Your post was liked",
        body: `${fullName} liked your post`,
        postId,
        likerPhoto,
        likerName: fullName,
        read: false,
        type: "like", 
      };
    
      sendNotificationToPostOwner(postOwnerId, notification);
    
      // Save the notification in the database
      const newNotification = new Notification(notification);
      await newNotification.save();
      console.log("Notification stored for post owner:", postOwnerId);
    } else {
      console.log("No new notification needed for this user and post.");
    }
    

    res.status(200).json({
      message: "Post liked",
      post: { ...post.toObject(), likes: post.likes },
    });
  } catch (error) {
    console.error("Error liking/unliking post:", error);
    res.status(500).json({ message: "Failed to like/unlike post", error: error.message });
  }
};








const fetchUserPost = async (req, res) => { 
    try {
      const userId = req.params.userId;
  
      const user = await User.findById(userId)
        .populate("schoolInfoId") 
        .lean();
  
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
  
      // Fetching user posts and sort by 'createdAt' in descending order(newest posts first)
      const posts = await UserPost.find({ user: userId })
        .sort({ createdAt: -1 })  
        .populate({
          path: "comments", 
          model: "UserComment", 
          populate: { path: "user", select: "fullName profilePhoto" },
        })
        .populate("likes", "fullName profilePhoto")
        .populate("shares", "fullName profilePhoto")
        .lean();
  
      res.status(200).json({
        message: "User posts and student information retrieved successfully",
        user: {
          fullName: user.fullName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          profilePhoto: user.profilePhoto,
          studentInfo: {
            university: user.schoolInfoId ? user.schoolInfoId.university : null,
            faculty: user.schoolInfoId ? user.schoolInfoId.faculty : null,
            department: user.schoolInfoId ? user.schoolInfoId.department : null,
            level: user.schoolInfoId ? user.schoolInfoId.level : null,
          },
        },
        posts,  
      });
    } catch (error) {
      console.error("Error fetching user's posts and student info:", error);
      res.status(500).json({ message: "Error retrieving user data" });
    }
  };
  
  const EventEmitter = require("events");
const postEventEmitter = new EventEmitter();


const postNotify = (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendEvent = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const notifyPost = (data) => {
      sendEvent(data); // Send the event to the client
  };

  postEventEmitter.on("newPost", notifyPost);

  req.on("close", () => {
      console.log("Client disconnected");
      postEventEmitter.off("newPost", notifyPost);
  });
};



// module.exports = { postNotify };

  
const markNotificationAsRead = async (req, res) => { 
  try {
    const { notificationId } = req.params;
    console.log("Notification ID from request:", notificationId);

    // Check if the ID is a valid ObjectID
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      console.error("Invalid Notification ID format");
      return res.status(400).json({ message: "Invalid notification ID format" });
    }

    const result = await Notification.updateOne(
      { _id: notificationId }, // Match the notification by its ID
      { $set: { read: true } } // Set 'read' to true
    );

    console.log("Update Result:", result);

    // Check if the update was successful
    if (result.modifiedCount === 0) {
      console.warn("No document was updated. It might not exist or already be read.");
      return res.status(404).json({ message: "Notification not found or already read" });
    }

    res.status(200).json({ message: "Notification marked as read" });
  } catch (error) {
    console.error("Error marking notification as read:", error.message);
    res.status(500).json({ message: "Failed to mark notification as read" });
  }
};







    module.exports = {studentCreatePost,likePost,sharePost,fetchUserPost,postNotify,markNotificationAsRead}
    
