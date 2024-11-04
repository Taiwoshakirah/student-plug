const SugPost = require('../models/sugPost')
const SugPostComment = require('../models/sugComment')
const { promisify } = require("util");
const cloudinary = require("cloudinary");
const { uploadToCloudinary } = require("../config/cloudinaryConfig"); // Correctly import the function
const fs = require("fs");;
const mongoose = require('mongoose');
const Roles = require('../middlewares/role');
const User = require('../models/signUp')
const SugUser = require('../models/schoolSug')
const { Types: { ObjectId } } = require('mongoose'); // Make sure to import ObjectId



const createSugPost = async (req, res) => {
    const { adminId, text } = req.body;
    if (!adminId || !text) {
        return res.status(400).json({ message: "Admin ID and text are required" });
    }

    try {
        let imageUrls = []; 

        if (req.files && req.files.image) {
            const images = Array.isArray(req.files.image) ? req.files.image : [req.files.image];
            console.log("Images received in request:", images); 

            for (const image of images) {
                const tempFilePath = `uploads/${image.name}`;

                
                await image.mv(tempFilePath);
                console.log(`File moved to temporary path: ${tempFilePath}`);

                
                const result = await uploadToCloudinary(tempFilePath);
                console.log("Cloudinary upload result:", result); 

                if (result && result.secure_url) {
                    imageUrls.push(result.secure_url);
                } else {
                    console.error("Failed to upload image to Cloudinary:", result);
                }

                //temporary file Deleted   
                fs.unlink(tempFilePath, (unlinkErr) => {
                    if (unlinkErr) {
                        console.error("Error deleting temporary file:", unlinkErr);
                    }
                });
            }
        }
        console.log("Final image URLs to be saved:", imageUrls); 
        // post saved with all image URLs
        const post = new SugPost({ adminId, text, images: imageUrls });
        await post.save();
        res.status(201).json({ message: "Post created", post });
    } catch (error) {
        console.error("Error creating post:", error);
        res.status(500).json({ message: "Error creating post", error });
    }
};



const isValidObjectId = (id) => {
    return ObjectId.isValid(id) && (new ObjectId(id)).equals(id);
};

const toggleLike = async (req, res) => { 
    try {
        const { postId } = req.params;
        const { userId, adminId } = req.body;

        // Fetch post only once
        const post = await SugPost.findById(postId);
        if (!post) return res.status(404).json({ message: "Post not found" });

        const likeId = userId || adminId;
        const user = userId ? await User.findById(userId) : adminId ? await User.findById(adminId) : null;
        if (!user) return res.status(400).json({ message: "User not found" });

        const alreadyLiked = post.likes.some(like => like.id.toString() === likeId.toString());

        // Toggle like status
        if (alreadyLiked) {
            post.likes = post.likes.filter(like => like.id.toString() !== likeId.toString());
        } else {
            post.likes.push({ _id: likeId, fullName: user.fullName || "Unknown", id: likeId });
        }

        await post.save();

        // Prepare response
        const updatedLikes = post.likes.map(like => ({
            userId: like.id,
            fullName: like.fullName || "Unknown User",
            liked: true
        }));

        return res.status(200).json({
            message: "Post like toggled",
            likesCount: post.likes.length,
            likesArray: post.likes,
            userLiked: !alreadyLiked, 
            allLikes: updatedLikes
        });
    } catch (error) {
        console.error("Error toggling like:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};



const addComment = async (req, res) => {
    const { postId } = req.params;
    const text = req.body.text;

    const userId = req.user.userId; 
    const role = req.user.role; 
    if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
    }
    if (!text) {
        return res.status(400).json({ message: "Comment text is required" });
    }

    const isAdmin = role === "admin"; 

    try {
        const comment = new SugPostComment({ postId, userId, text, isAdmin, role });
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
        const { adminId } = req.params; // Change this line to use req.params

        console.log("Admin ID:", adminId);

        // Ensure adminId is provided and convert it to an ObjectId
        if (!adminId) {
            return res.status(400).json({ message: "Admin ID is required" });
        }

        const adminObjectId = new mongoose.Types.ObjectId(adminId);

        // Find posts only for the given adminId
        const posts = await SugPost.find({ adminId: adminObjectId })
            .populate("adminId", "sugFullName email")
            .populate({
                path: "likes",
                model: "User",
                select: "_id fullName"
            })
            .populate({
                path: "comments",
                select: "text userId createdAt isAdmin",
                populate: {
                    path: "userId",
                    model: "User",
                    select: "_id fullName"
                }
            })
            .sort({ createdAt: -1 })
            .lean();

        // If no posts found, return a message
        if (posts.length === 0) {
            return res.status(404).json({ message: "No posts found for this admin." });
        }

        // Process the fetched posts
        posts.forEach(post => {
            console.log(`Post ID: ${post._id}`);
            console.log("Likes Array:", post.likes);

            // Check if admin has liked the post
            post.adminLiked = post.likes.some(like => like._id.equals(adminObjectId));
            console.log(`Admin liked this post: ${post.adminLiked}`);

            // Additional properties
            post.commentsCount = post.comments.length;
            post.likesCount = post.likes.length;

            // Ensure comments have a consistent `isAdmin` field
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