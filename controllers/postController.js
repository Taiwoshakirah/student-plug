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
const { sendNotification } = require('../utils/websocket');
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
    console.log("Files received in request:", req.files);

    try {
        const { userId, text } = req.body;
        let imageUrls = [];

        if (text && containsRestrictedWords(text)) {
            return res.status(400).json({ message: "Your post contains inappropriate content." });
        }

        // Handling of the image upload and stores in URLs
        if (req.files && req.files.image) {
            const images = Array.isArray(req.files.image) ? req.files.image : [req.files.image];
            for (const image of images) {
                if (!image.tempFilePath) {
                    const tempPath = `./tmp/${image.name}`;
                    await image.mv(tempPath);
                    image.tempFilePath = tempPath;
                }
                const result = await uploadToCloudinary(image.tempFilePath);
                console.log("Cloudinary result:", result);
                if (result && result.secure_url) {
                    imageUrls.push(result.secure_url);
                }
            }
        }

        if (!text) {
            return res.status(400).json({ message: "Please provide text" });
        }
        if (imageUrls.length === 0) {
            return res.status(400).json({ message: "Please provide image" });
        }

        const user = await User.findById(userId)
            .populate('schoolInfoId')  
            .populate({
                path: 'studentInfo',  
                model: 'StudentInfo',  
                select: 'faculty department'  
            });

        console.log("Populated user:", user); 

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const schoolInfoId = user.schoolInfoId;
        if (!schoolInfoId) {
            return res.status(400).json({ message: "User is not associated with a school" });
        }

        console.log("Student Info:", user.studentInfo);

        const post = new UserPost({
            user: userId,
            text,
            images: imageUrls, 
            schoolInfoId 
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
        res.status(500).json({ message: "Failed to create post", error: error.message });
    }
};





const likePost = async (req, res) => {
    try {
        const { userId } = req.body;
        const { postId } = req.params;
        const { isAdminPost } = req.body;  

        console.log("isAdminPost:", isAdminPost);  
        console.log("postId:", postId);  

        let post;
        // If it's an admin post, query SugPost, otherwise query UserPost
        if (isAdminPost) {
            console.log("Fetching admin post from SugPost");  
            post = await SugPost.findById(postId);
        } else {
            console.log("Fetching user post from UserPost");  
            post = await UserPost.findById(postId);
        }

        if (!post) {
            console.error("Post not found in database"); 
            return res.status(404).json({ message: "Post not found" });
        }

        // Check if the user already liked the post
        const likeIndex = post.likes.indexOf(userId);

        if (likeIndex !== -1) {
            // User had already liked the post, so unlike it
            post.likes.splice(likeIndex, 1);
            post.likeCount -= 1;
            await post.save();
            return res.status(200).json({ message: "Post unliked", post });
        }

        // Otherwise, add a like
        post.likes.push(userId);
        post.likeCount += 1;
        await post.save();

        // Send notification to the post owner if someone else liked their post, this is where websocket is needed(i'm testing)
        const postOwnerId = post.adminId ? post.adminId._id.toString() : post.user._id.toString();
        if (postOwnerId !== userId) {
            sendNotification(postOwnerId, {
                type: "like",
                message: `Your post was liked`,
                postId: post._id,
                likerId: userId
            });
        }

        res.status(200).json({ message: "Post liked", post });
    } catch (error) {
        console.error("Error liking/unliking post:", error);
        res.status(500).json({ message: "Failed to like/unlike post", error });
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
    
