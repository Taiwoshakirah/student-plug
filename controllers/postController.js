const UserPost = require('../models/post')
const UserComment = require('../models/comment')
const {uploadToCloudinary} = require('../config/cloudinaryConfig')
const User = require('../models/signUp'); // Import the User model
const StudentInfo = require('../models/studentInfo'); // Import the StudentInfo model
const mongoose = require('mongoose');
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
    try {
        const { userId, text } = req.body; // Only userId and text are needed
        let imageUrls = [];

        // Check for restricted words in text
        if (text && containsRestrictedWords(text)) {
            return res.status(400).json({ message: "Your post contains inappropriate content." });
        }

        // If images are provided, upload them to Cloudinary and get URLs
        if (req.files && req.files.image) {
            const images = Array.isArray(req.files.image) ? req.files.image : [req.files.image];
            for (const image of images) {
                if (!image.tempFilePath) {
                    const tempPath = `./tmp/${image.name}`;
                    await image.mv(tempPath);
                    image.tempFilePath = tempPath;
                }
                const result = await uploadToCloudinary(image.tempFilePath);
                if (result && result.secure_url) {
                    imageUrls.push(result.secure_url);
                }
            }
        }

        // Validate at least one of text or images is provided
        if (!text && imageUrls.length === 0) {
            return res.status(400).json({ message: "Post text or image is required" });
        }

        // Fetch the user document to get schoolInfoId
        const user = await User.findById(userId).populate('schoolInfoId');
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Extract schoolInfoId from the user's information
        const schoolInfoId = user.schoolInfoId;
        if (!schoolInfoId) {
            return res.status(400).json({ message: "User is not associated with a school" });
        }

        // Create the post with the schoolInfoId from the user's info
        const post = new UserPost({
            user: userId,
            text,
            image: imageUrls,
            schoolInfoId // Link the post to the user's school
        });

        await post.save();

        // Send response with post and student info
        res.status(201).json({
            message: "Post created successfully",
            post,
            studentInfo: schoolInfoId // Include the populated school info in the response
        });
    } catch (error) {
        console.error("Error creating post:", error);
        res.status(500).json({ message: "Failed to create post", error });
    }
};






const likePost = async (req, res) => {
    try {
        const { userId } = req.body;
        const { postId } = req.params;

        const post = await UserPost.findById(postId);
        if (!post) return res.status(404).json({ message: "Post not found" });

        // Check if the user already liked the post
        if (post.likes.includes(userId)) {
            return res.status(400).json({ message: "User has already liked this post" });
        }

        post.likes.push(userId);
        post.likeCount += 1;
        await post.save();

        res.status(200).json({ message: "Post liked", post });
    } catch (error) {
        console.error("Error liking post:", error);
        res.status(500).json({ message: "Failed to like post", error });
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
  
  
  
  
  
  
  






    module.exports = {studentCreatePost,likePost,sharePost,commentOnPost,fetchUserPost}
    
