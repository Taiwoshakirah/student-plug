const UserPost = require('../models/post')
const UserComment = require('../models/comment')
const {uploadToCloudinary} = require('../config/cloudinaryConfig')
const User = require('../models/signUp'); // Import the User model
const StudentInfo = require('../models/studentInfo'); // Import the StudentInfo model
const mongoose = require('mongoose');
const { cloudinary } = require('../config/cloudinaryConfig');
const Roles = require('../middlewares/role');
const SugUser = require('../models/schoolSug')
const { sendNotification } = require('../utils/websocket');
//for student post creation with control
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

        // Check for restricted words in text
        if (text && containsRestrictedWords(text)) {
            return res.status(400).json({ message: "Your post contains inappropriate content." });
        }

        // Handle image upload and store URLs
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

        // Validation: Ensure text and image are provided
        if (!text) {
            return res.status(400).json({ message: "Please provide text" });
        }
        if (imageUrls.length === 0) {
            return res.status(400).json({ message: "Please provide image" });
        }

        // Fetch user and populate related data (schoolInfo and studentInfo)
        const user = await User.findById(userId)
            .populate('schoolInfoId')  // Populate school info
            .populate({
                path: 'studentInfo',  // Singular reference field in User model
                model: 'StudentInfo',  // Specify the model name explicitly
                select: 'faculty department'  // Select specific fields from studentInfo
            });

        console.log("Populated user:", user); // Verify populated user data

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const schoolInfoId = user.schoolInfoId;
        if (!schoolInfoId) {
            return res.status(400).json({ message: "User is not associated with a school" });
        }

        // Log the studentInfo to see if faculty/department are populated correctly
        console.log("Student Info:", user.studentInfo);

        // Create and save the post
        const post = new UserPost({
            user: userId,
            text,
            images: imageUrls, // Ensuring 'images' key is used consistently
            schoolInfoId 
        });

        await post.save();

        // Return the response with populated student info and school info
        res.status(201).json({
            message: "Post created successfully",
            post: {
                ...post.toObject(),
                images: post.images
            },
            studentInfo: {
                faculty: user.studentInfo ? user.studentInfo.faculty : 'N/A',  // Ensure faculty is populated
                department: user.studentInfo ? user.studentInfo.department : 'N/A' // Ensure department is populated
            },
            profilePicture: user.profilePhoto || null, // Return the profile picture (null if not uploaded)
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

        const post = await UserPost.findById(postId);
        if (!post) return res.status(404).json({ message: "Post not found" });

        // Check if the user already liked the post
        const likeIndex = post.likes.indexOf(userId);

        if (likeIndex !== -1) {
            // User has already liked the post, so unlike it
            post.likes.splice(likeIndex, 1);
            post.likeCount -= 1;
            await post.save();
            return res.status(200).json({ message: "Post unliked", post });
        }

        // Otherwise, add a like
        post.likes.push(userId);
        post.likeCount += 1;
        await post.save();

        // Send notification to the post owner if someone else liked their post
        const postOwnerId = post.user._id.toString();
        if (postOwnerId !== userId) {
            sendNotification(postOwnerId, {
                type: "like",
                message: `Your post was ${likeIndex !== -1 ? "unliked" : "liked"}`,
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

        // Check if the user has already shared the post
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

const commentOnPost = async (req, res) => {
    try {
        const { userId, text } = req.body;
        const { postId } = req.params;

        if (!text) {
            return res.status(400).json({ message: "Comment text is required" });
        }

        const post = await UserPost.findById(postId);
        if (!post) return res.status(404).json({ message: "Post not found" });

        // Create a new comment
        const comment = new UserComment({
            user: userId,
            post: postId,
            text,
        });

        await comment.save();

        // Add comment to post's comments array
        post.comments.push(comment._id);
        await post.save();

        res.status(201).json({ message: "Comment added", comment });
    } catch (error) {
        console.error("Error commenting on post:", error);
        res.status(500).json({ message: "Failed to add comment", error });
    }
};

const fetchUserPost = async (req, res) => { 
    try {
      const userId = req.params.userId;
  
      // Fetch user and populate student info
      const user = await User.findById(userId)
        .populate("schoolInfoId") // Assuming 'schoolInfoId' is used to reference 'StudentInfo'
        .lean();
  
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
  
      // Fetch user posts and sort by 'createdAt' in descending order
      const posts = await UserPost.find({ user: userId })
        .sort({ createdAt: -1 })  // Sort posts by createdAt in descending order (newest posts first)
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
        posts,  // Posts are now sorted in descending order
      });
    } catch (error) {
      console.error("Error fetching user's posts and student info:", error);
      res.status(500).json({ message: "Error retrieving user data" });
    }
  };
  
  
  



// Function to approve or decline a post
// const updatePostStatus = async (req, res) => {
//     const { postId } = req.params;
//     const { action } = req.body; // 'approve' or 'decline'
//     const { userId } = req.body; // the admin's user ID

//     try {
//         // Find the admin user making the request
//         const user = await User.findById(userId);
//         if (!user || user.role !== "admin") {
//             return res.status(403).json({ message: "Unauthorized: Only admins can approve or decline posts" });
//         }

//         // Find the post
//         const post = await UserPost.findById(postId);
//         if (!post) {
//             return res.status(404).json({ message: "Post not found" });
//         }

//         // Update the post status based on the action
//         if (action === "approve") {
//             post.status = "approved";
//         } else if (action === "decline") {
//             post.status = "declined";
//         } else {
//             return res.status(400).json({ message: "Invalid action. Use 'approve' or 'decline'." });
//         }

//         // Save the updated post
//         await post.save();

//         res.status(200).json({ message: `Post ${action}d successfully`, post });
//     } catch (error) {
//         console.error("Error updating post status:", error);
//         res.status(500).json({ message: "Failed to update post status", error });
//     }
// };

// Function to get all approved posts
// const getApprovedPosts = async (req, res) => {
//     try {
//         const posts = await UserPost.find({ status: "approved" });
//         res.status(200).json(posts);
//     } catch (error) {
//         console.error("Error fetching posts:", error);
//         res.status(500).json({ message: "Failed to fetch posts", error });
//     }
// };

  
  
  
  






    module.exports = {studentCreatePost,likePost,sharePost,commentOnPost,fetchUserPost,}
    
