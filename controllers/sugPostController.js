const SugPost = require('../models/sugPost')
const SugPostComment = require('../models/sugComment')
const { promisify } = require("util");
const cloudinary = require("cloudinary");
const { uploadToCloudinary } = require("../config/cloudinaryConfig"); // Correctly import the function
const fs = require("fs");;


const createSugPost = async (req, res) => {
    const { adminId, text } = req.body;
    if (!adminId || !text) {
        return res.status(400).json({ message: "Admin ID and text are required" });
    }

    try {
        let imageUrls = []; // Store all image URLs

        if (req.files && req.files.image) {
            const images = Array.isArray(req.files.image) ? req.files.image : [req.files.image];
            console.log("Images received in request:", images); // Check if images are correctly received

            for (const image of images) {
                const tempFilePath = `uploads/${image.name}`;

                // Move the file to the temporary directory
                await image.mv(tempFilePath);
                console.log(`File moved to temporary path: ${tempFilePath}`);

                // Upload to Cloudinary
                const result = await uploadToCloudinary(tempFilePath);
                console.log("Cloudinary upload result:", result); // Check Cloudinary response

                if (result && result.secure_url) {
                    imageUrls.push(result.secure_url);
                } else {
                    console.error("Failed to upload image to Cloudinary:", result);
                }

                // Delete the temporary file
                fs.unlink(tempFilePath, (unlinkErr) => {
                    if (unlinkErr) {
                        console.error("Error deleting temporary file:", unlinkErr);
                    }
                });
            }
        }

        console.log("Final image URLs to be saved:", imageUrls); // Verify image URLs before saving

        // Save post with all image URLs
        const post = new SugPost({ adminId, text, images: imageUrls });
        await post.save();
        res.status(201).json({ message: "Post created", post });
    } catch (error) {
        console.error("Error creating post:", error);
        res.status(500).json({ message: "Error creating post", error });
    }
};


const toggleLike = async (req, res) => {
    const { postId } = req.params;
    const { userId } = req.body;

    try {
        // Find the post by ID
        const post = await SugPost.findById(postId);
        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }

        // Check if the user has already liked the post
        const hasLiked = post.likes.includes(userId);

        // Add or remove like based on the current state
        if (hasLiked) {
            // User has liked the post, remove the like
            post.likes = post.likes.filter((id) => id.toString() !== userId);
        } else {
            // User has not liked the post, add the like
            post.likes.push(userId);
        }

        // Save the updated post
        await post.save();

        // Return the updated like count and status
        res.json({
            message: hasLiked ? "Post unliked" : "Post liked",
            likes: post.likes.length,
        });
    } catch (error) {
        console.error("Error toggling like:", error);
        res.status(500).json({ message: "Error liking post", error });
    }
};


const addComment = async (req, res) => {
    const { postId } = req.params;
  const { userId, text } = req.body;

  if (!text) {
    return res.status(400).json({ message: "Comment text is required" });
  }

  try {
    const comment = new SugPostComment({ postId, userId, text });
    await comment.save();
    res.status(201).json({ message: "Comment added", comment });
  } catch (error) {
    res.status(500).json({ message: "Error commenting on post", error });
  }
};

const fetchPostDetails = async (req, res) => {
    try {
        const { adminId } = req.params; // Get adminId from route parameters

        // Filter posts by adminId if provided
        const filter = adminId ? { adminId } : {};

        // Fetch posts with admin details and likes populated, filtered by adminId if specified
        const posts = await SugPost.find(filter)
            .populate("adminId", "sugFullName email") // Populate admin details
            .populate("likes", "fullName") // Populate names of users who liked the post
            .sort({ createdAt: -1 }) // Sort posts by createdAt in descending order
            .lean();

        // Get all comments for the posts in one query
        const postIds = posts.map(post => post._id);
        const comments = await SugPostComment.find({ postId: { $in: postIds } })
            .populate("userId", "fullName") // Populate user details for comments
            .lean();

        // Group comments by postId
        const commentsByPostId = comments.reduce((acc, comment) => {
            if (!acc[comment.postId]) acc[comment.postId] = [];
            acc[comment.postId].push(comment);
            return acc;
        }, {});

        // Attach comments and counts to each post
        for (const post of posts) {
            post.comments = commentsByPostId[post._id] || []; // Attach comments for the post
            post.commentsCount = post.comments.length; // Total number of comments
            post.likesCount = post.likes.length; // Total number of likes
        }

        res.json({ posts });
    } catch (error) {
        console.error("Error fetching posts:", error);
        res.status(500).json({ message: "Error fetching posts", error });
    }
};



module.exports = {createSugPost,toggleLike,addComment,fetchPostDetails}