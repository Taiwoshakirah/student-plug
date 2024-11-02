const SugPost = require('../models/sugPost')
const SugPostComment = require('../models/sugComment')
const { promisify } = require("util");
const cloudinary = require("cloudinary");
const { uploadToCloudinary } = require("../config/cloudinaryConfig"); // Correctly import the function
const fs = require("fs");;
const mongoose = require('mongoose');
const Roles = require('../middlewares/role');


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
    const { userId, adminId } = req.body; // Extract userId and adminId from the request body
    const likerId = userId || adminId; // Use userId if available, otherwise use adminId

    try {
        // Fetch the post to see its current state
        const post = await SugPost.findById(postId);
        if (!post) return res.status(404).json({ message: "Post not found" });

        // Check if the current user has already liked the post
        const alreadyLiked = post.likes.some(like => like.equals(likerId));

        // Determine whether to add or remove the like
        const update = alreadyLiked
            ? { $pull: { likes: likerId } } // Remove the like
            : { $addToSet: { likes: likerId } }; // Add the like

        // Perform the update
        await SugPost.findByIdAndUpdate(postId, update);

        // Fetch the updated post and populate likes to get full user information
        const updatedPost = await SugPost.findById(postId)
            .populate("likes", "_id sugFullName") // Populate likes with user information
            .exec();

        // Debugging logs to check userId and likes
        console.log("User ID:", userId);
        console.log("Likes Array:", updatedPost.likes.map(like => like._id.toString())); // Log each like ID

        // Determine userLiked status
        const userLiked = updatedPost.likes.some(like => like._id.equals(userId));
        console.log("User liked status:", userLiked); // Log the userLiked status

        res.json({
            message: alreadyLiked ? "Post unliked" : "Post liked",
            likesCount: updatedPost.likes.length, // Count of likes
            likesArray: updatedPost.likes.map(like => ({
                _id: like._id,
                fullName: like.sugFullName, // Include user information
            })),
            userLiked // Include the correct userLiked status
        });
    } catch (error) {
        console.error("Error toggling like:", error);
        res.status(500).json({ message: "Error liking post", error });
    }
};










const addComment = async (req, res) => {
    const { postId } = req.params;
    const text = req.body.text;

    const userId = req.user.userId; // Get user ID from authenticated user
    const role = req.user.role; // Get role from authenticated user

    // Check for required fields
    if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
    }
    if (!text) {
        return res.status(400).json({ message: "Comment text is required" });
    }

    const isAdmin = role === "admin"; // Check if the user is admin

    try {
        const comment = new SugPostComment({ postId, userId, text, isAdmin, role }); // Include role in comment
        await comment.save();

        await SugPost.findByIdAndUpdate(postId, { $inc: { commentsCount: 1 } });

        res.status(201).json({ message: "Comment added", comment });
    } catch (error) {
        console.error("Error adding comment:", error);
        res.status(500).json({ message: "Error commenting on post", error });
    }
};


  









const fetchPostDetails = async (req, res) => { 
    try {
        const { adminId, userId } = req.query;

        console.log("Admin ID:", adminId);
        console.log("User ID:", userId);

        const posts = await SugPost.find(adminId ? { adminId } : {})
            .populate("adminId", "sugFullName email")
            .populate({
                path: "likes",
                select: "_id fullName" 
            })
            .populate({
                path: "comments",
                select: "text userId createdAt isAdmin",
                populate: { 
                    path: "userId", 
                    select: "_id fullName" 
                }
            })
            .sort({ createdAt: -1 })
            .lean();

        posts.forEach(post => {
            console.log(`Post ID: ${post._id}`);
            console.log("Likes Array:", post.likes);

            post.adminLiked = post.likes.some(like => like._id.toString() === adminId);
            console.log(`Admin liked this post: ${post.adminLiked}`);

            if (userId) {
                const userObjectId = new mongoose.Types.ObjectId(userId);
                post.userLiked = post.likes.some(like => like._id.equals(userObjectId));
            } else {
                post.userLiked = false;
            }

            console.log(`Post ID: ${post._id} | userLiked: ${post.userLiked} | adminLiked: ${post.adminLiked}`);
            post.adminCommented = post.comments.some(comment => comment.isAdmin);
            post.commentsCount = post.comments.length;
            post.likesCount = post.likes.length;

            post.comments = post.comments.map(comment => ({
                ...comment,
                isAdmin: comment.isAdmin || false
            }));
        });

        res.json({ posts });
    } catch (error) {
        console.error("Error fetching posts:", error);
        res.status(500).json({ message: "Error fetching posts", error });
    }
};




















module.exports = {createSugPost,toggleLike,addComment,fetchPostDetails}