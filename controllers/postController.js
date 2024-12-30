const UserPost = require('../models/post')
const UserComment = require('../models/comment')
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
            trending: isTrending, // Set trending based on hashtags
        });
        await post.save();

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




// const studentCreatePost = async (req, res) => {
//     console.log("Files received in request:", req.files);

//     try {
//         const { userId, text } = req.body;
//         let imageUrls = [];

//         if (text && containsRestrictedWords(text)) {
//             return res.status(400).json({ message: "Your post contains inappropriate content." });
//         }

//         // Handling of the image upload and stores in URLs
//         if (req.files && req.files.image) {
//             const images = Array.isArray(req.files.image) ? req.files.image : [req.files.image];
//             for (const image of images) {
//                 if (!image.tempFilePath) {
//                     const tempPath = `./tmp/${image.name}`;
//                     await image.mv(tempPath);
//                     image.tempFilePath = tempPath;
//                 }
//                 const result = await uploadToCloudinary(image.tempFilePath);
//                 console.log("Cloudinary result:", result);
//                 if (result && result.secure_url) {
//                     imageUrls.push(result.secure_url);
//                 }
//             }
//         }

//         if (!text) {
//             return res.status(400).json({ message: "Please provide text" });
//         }
//         if (imageUrls.length === 0) {
//             return res.status(400).json({ message: "Please provide image" });
//         }

//         const user = await User.findById(userId)
//             .populate('schoolInfoId')  
//             .populate({
//                 path: 'studentInfo',  
//                 model: 'StudentInfo',  
//                 select: 'faculty department'  
//             });

//         console.log("Populated user:", user); 

//         if (!user) {
//             return res.status(404).json({ message: "User not found" });
//         }

//         const schoolInfoId = user.schoolInfoId;
//         if (!schoolInfoId) {
//             return res.status(400).json({ message: "User is not associated with a school" });
//         }

//         console.log("Student Info:", user.studentInfo);

//         const post = new UserPost({
//             user: userId,
//             text,
//             images: imageUrls, 
//             schoolInfoId 
//         });

//         await post.save();

//         res.status(201).json({
//             message: "Post created successfully",
//             post: {
//                 ...post.toObject(),
//                 images: post.images
//             },
//             studentInfo: {
//                 faculty: user.studentInfo ? user.studentInfo.faculty : 'N/A',  
//                 department: user.studentInfo ? user.studentInfo.department : 'N/A' 
//             },
//             profilePicture: user.profilePhoto || null, 
//             schoolInfo: {
//                 id: schoolInfoId._id,
//                 university: schoolInfoId.university
//             }
//         });
//         console.log('Post with populated studentInfo:', post);

//     } catch (error) {
//         console.error("Error creating post:", error);
//         res.status(500).json({ message: "Failed to create post", error: error.message });
//     }
// };


// const likePost = async (req, res) => {
//     try {
//         const { userId, isAdminPost } = req.body;
//         const { postId } = req.params;
//         let post;
  
//         // Fetch the correct post type
//         if (isAdminPost) {
//             post = await SugPost.findById(postId);
//         } else {
//             post = await UserPost.findById(postId);
//         }
  
//         if (!post) {
//             console.error("Post not found for postId:", postId);
//             return res.status(404).json({ message: "Post not found" });
//         }
  
//         if (!post.likes) {
//             post.likes = [];
//         }
//         if (!post.likeCount) {
//             post.likeCount = 0;
//         }
  
//         const postOwnerId = isAdminPost ? post.adminId : post.user;
//         if (!postOwnerId) {
//             console.error("Post owner not found for post:", post);
//             return res.status(400).json({ message: "Post owner not found" });
//         }
  
//         console.log("Post Owner ID:", postOwnerId);
  
//         const existingLikeIndex = post.likes.findIndex(like => like._id && like._id.toString() === userId);
//         if (existingLikeIndex !== -1) {
//             post.likes.splice(existingLikeIndex, 1);
//             post.likeCount -= 1;
//             await post.save();
  
//             console.log(`User ${userId} unliked the post`);
//             if (req.io) {
//                 req.io.to(postOwnerId.toString()).emit("post_unliked", { postId, userId });
//             } else {
//                 console.error("Socket.IO instance not found");
//             }
//             return res.status(200).json({ message: "Post unliked", post });
//         }
  
//         const liker = await User.findById(userId);
//         if (!liker) {
//             console.error("Liker not found for userId:", userId);
//             return res.status(404).json({ message: "User not found" });
//         }
  
//         post.likes.push({ _id: liker._id.toString(), fullName: liker.fullName, createdAt: new Date() });
//         post.likeCount += 1;
//         await post.save();
  
//         console.log(`User ${userId} liked the post`);
//         if (postOwnerId.toString() !== userId) {
//             await sendNotification(postOwnerId, {
//                 type: "like",
//                 message: "Your post was liked",
//                 postId: post._id,
//                 likerId: userId,
//             });
  
//             if (req.io) {
//                 console.log(`Emitting like event to admin room: ${postOwnerId}`);
//                 req.io.to(postOwnerId.toString()).emit("post_liked", {
//                     type: "like",
//                     postId,
//                     likerId: userId,
//                     likerName: liker.fullName,
//                 });
//             } else {
//                 console.error("Socket.IO instance not found");
//             }
//         }
  
//         res.status(200).json({
//             message: "Post liked",
//             post: {
//                 ...post.toObject(),
//                 likes: post.likes,
//             },
//         });
//     } catch (error) {
//         console.error("Error liking/unliking post:", error);
//         res.status(500).json({ message: "Failed to like/unlike post", error: error.message });
//     }
//   };

// const likePost = async (req, res) => {
//     try {
//         const { userId, isAdminPost } = req.body;
//         const { postId } = req.params;
//         let post;
  
//         post = isAdminPost ? await SugPost.findById(postId) : await UserPost.findById(postId);
//         if (!post) {
//             return res.status(404).json({ message: "Post not found" });
//         }
  
//         if (!post.likes) {
//             post.likes = [];
//         }
//         if (!post.likeCount) {
//             post.likeCount = 0;
//         }
  
//         const postOwnerId = isAdminPost ? post.adminId : post.user;
//         if (!postOwnerId) {
//             return res.status(400).json({ message: "Post owner not found" });
//         }
  
  
//         const existingLikeIndex = post.likes.findIndex(like => like._id && like._id.toString() === userId);
//         if (existingLikeIndex !== -1) {
//             post.likes.splice(existingLikeIndex, 1);
//             post.likeCount -= 1;
//             await post.save();
  
//             if (req.io) {
//                 req.io.to(postOwnerId.toString()).emit("post_unliked", { postId, userId });
//             }
//             return res.status(200).json({ message: "Post unliked", post });
//         }
  
//         const liker = await User.findById(userId);
//         if (!liker) {
//             return res.status(404).json({ message: "User not found" });
//         }
  
//         post.likes.push({ _id: liker._id.toString(), fullName: liker.fullName });
//         post.likeCount += 1;
//         await post.save();
  
//         if (postOwnerId.toString() !== userId) {
//             await sendNotification(postOwnerId, {
//                 type: "like",
//                 message: "Your post was liked",
//                 postId: post._id,
//                 likerId: userId,
//             });
  
//             if (req.io) {
//                 req.io.to(postOwnerId.toString()).emit("post_liked", {
//                     type: "like",
//                     postId,
//                     likerId: userId,
//                     likerName: liker.fullName,
//                 });
//             }
//         }
  
//         res.status(200).json({
//             message: "Post liked",
//             post: {
//                 ...post.toObject(),
//                 likes: post.likes,
//             },
//         });
//     } catch (error) {
//         console.error("Error liking/unliking post:", error);
//         res.status(500).json({ message: "Failed to like/unlike post", error: error.message });
//     }
//   };




// const likePost = async (req, res) => {
//     try {
//         const { userId } = req.body;  
//         const { postId } = req.params; 
//         const { isAdminPost } = req.body;  

//         let post;
//         // Query the correct post based on whether it's an admin post or user post
//         if (isAdminPost) {
//             post = await SugPost.findById(postId); 
//         } else {
//             post = await UserPost.findById(postId); 
//         }

//         if (!post) {
//             return res.status(404).json({ message: "Post not found" });
//         }
//         if (!Array.isArray(post.likes)) {
//             post.likes = [];
//         }

//         const postOwnerId = isAdminPost ? post.adminId : post.user;
//         if (!postOwnerId) {
//             return res.status(400).json({ message: "Post owner not found" });
//         }

//         // Checking if the user has already liked the post
//         const existingLikeIndex = post.likes.findIndex(like => like._id && like._id.toString() === userId);

//         if (existingLikeIndex !== -1) {
//             // User already liked the post, so remove the like (unlike it)
//             post.likes.splice(existingLikeIndex, 1);
//             post.likeCount -= 1;
//             await post.save();

//             // Emit a real-time event for unliking
//             req.io.to(postOwnerId.toString()).emit("post_unliked", { postId, userId });

//             return res.status(200).json({ message: "Post unliked", post });
//         }

//         // If the user hasn't liked the post yet, add a like
//         let liker = await User.findById(userId); 

//         if (!liker) {
//             return res.status(404).json({ message: "User not found" });
//         }

//         post.likes.push({
//             _id: liker._id.toString(),        
//             fullName: liker.fullName          
//         });

//         post.likeCount += 1;
//         await post.save();

//         // Send notification to the post owner if someone else liked their post
        
//         if (postOwnerId.toString() !== userId) {
//             sendNotification(postOwnerId, {
//                 type: "like",
//                 message: `Your post was liked`,
//                 postId: post._id,
//                 likerId: userId
//             });

//              // Emit a real-time event to the post owner
//              req.io.to(postOwnerId.toString()).emit("post_liked", {
//                 type: "like",
//                 postId,
//                 likerId: userId,
//                 likerName: liker.fullName
//             });
//         }
//         res.status(200).json({
//             message: "Post liked",
//             post: {
//                 ...post.toObject(),  
//                 likes: post.likes     
//             }
//         });

//     } catch (error) {
//         console.error("Error liking/unliking post:", error);
//         res.status(500).json({ message: "Failed to like/unlike post", error });
//     }
// };

// const likePost = async (req, res) => {
//     try {
//       const { userId, isAdminPost } = req.body;
//       const { postId } = req.params;
//       let post;
  
//       // Fetch the correct post type
//       if (isAdminPost) {
//         post = await SugPost.findById(postId);
//       } else {
//         post = await UserPost.findById(postId);
//       }
  
//       if (!post) {
//         console.error("Post not found for postId:", postId);
//         return res.status(404).json({ message: "Post not found" });
//       }
  
//       if (!post.likes) {
//         post.likes = [];
//       }
//       if (!post.likeCount) {
//         post.likeCount = 0;
//       }
  
//       const postOwnerId = isAdminPost ? post.adminId : post.user;
//       if (!postOwnerId) {
//         console.error("Post owner not found for post:", post);
//         return res.status(400).json({ message: "Post owner not found" });
//       }
  
//       console.log("Post Owner ID:", postOwnerId);
  
//       const existingLikeIndex = post.likes.findIndex(
//         (like) => like._id && like._id.toString() === userId
//       );
//       if (existingLikeIndex !== -1) {
//         post.likes.splice(existingLikeIndex, 1);
//         post.likeCount -= 1;
//         await post.save();
  
//         console.log(`User ${userId} unliked the post`);
//         return res.status(200).json({ message: "Post unliked", post });
//       }
  
//       const liker = await User.findById(userId);
//       if (!liker) {
//         console.error("Liker not found for userId:", userId);
//         return res.status(404).json({ message: "User not found" });
//       }
  
//       post.likes.push({
//         _id: liker._id.toString(),
//         fullName: liker.fullName,
//         createdAt: new Date(),
//       });
//       post.likeCount += 1;
//       await post.save();
  
//       console.log(`User ${userId} liked the post`);
  
//       if (postOwnerId.toString() !== userId) {
//         const postOwner = await User.findById(postOwnerId); // Fetch the post owner's details
//         if (postOwner) {
//           const title = "Your post was liked!";
//           const body = `${liker.fullName} liked your post.`;
//           console.log("Sending WebSocket notification with title and body:", { title, body });
  
//           // Send notification via WebSocket
//           sendNotification(postOwnerId.toString(), { title, body });
//           console.log("WebSocket notification sent successfully");
//         } else {
//           console.error("Post owner not found for post owner ID:", postOwnerId);
//         }
//       }
  
//       res.status(200).json({
//         message: "Post liked",
//         post: {
//           ...post.toObject(),
//           likes: post.likes,
//         },
//       });
//     } catch (error) {
//       console.error("Error liking/unliking post:", error);
//       res.status(500).json({ message: "Failed to like/unlike post", error: error.message });
//     }
//   };

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
    const liker = await User.findById(userId);
    if (!liker) {
      console.error("Liker not found for userId:", userId);
      return res.status(404).json({ message: "User not found" });
    }

    post.likes.push({
      _id: liker._id.toString(),
      fullName: liker.fullName,
      likerPhoto: liker.profilePhoto,
      createdAt: new Date(),
    });

    post.likeCount = post.likes.length; // Update likeCount to match likes array
    await post.save();

    console.log("Post likes array after like:", post.likes);

    // Notify the post owner if it's not the same user
    if (postOwnerId.toString() !== userId) {
      const postOwner = await User.findById(postOwnerId);

      if (postOwner) {
        const title = "Your post was liked!";
        const body = `${liker.fullName} liked your post`;

        // Check if a notification for this post and liker already exists
        const existingNotification = await Notification.findOne({
          userId: postOwnerId,
          postId,
          "likerName": liker.fullName,
        });

        if (!existingNotification) {
          const notification = {
            userId: postOwnerId,
            title,
            body,
            postId,
            likerPhoto: liker.profilePhoto,
            likerName: liker.fullName,
            read: false,
          };

          console.log("Notification data:", notification);

          const client = clients.get(postOwnerId.toString());
          if (client && client.readyState === websocket.OPEN) {
            client.send(JSON.stringify(notification));
            console.log("Notification sent to post owner:", notification);
          } else {
            const newNotification = new Notification(notification);
            await newNotification.save();
            console.log("Notification stored for post owner:", postOwnerId);
          }
        } else {
          console.log("Notification for this like already exists.");
        }
      } else {
        console.error("Post owner not found for post owner ID:", postOwnerId);
      }
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



// const commentOnPost = async (req, res) => {
//     try {
//         const { userId, text } = req.body;
//         const { postId } = req.params;

//         if (!text) {
//             return res.status(400).json({ message: "Comment text is required" });
//         }

//         const post = await UserPost.findById(postId);
//         if (!post) return res.status(404).json({ message: "Post not found" });

//         const comment = new UserComment({
//             user: userId,
//             post: postId,
//             text,
//         });

//         await comment.save();

//         // Add comment to post's comments array
//         post.comments.push(comment._id);
//         await post.save();

//         res.status(201).json({ message: "Comment added", comment });
//     } catch (error) {
//         console.error("Error commenting on post:", error);
//         res.status(500).json({ message: "Failed to add comment", error });
//     }
// };

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
  
  
  



    module.exports = {studentCreatePost,likePost,sharePost,fetchUserPost,}
    
