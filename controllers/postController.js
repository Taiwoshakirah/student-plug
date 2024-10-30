const UserPost = require('../models/post')
const UserComment = require('../models/userComment')

const createPost = async (req, res) => {
    try {
        const { userId, text } = req.body;
        let imageUrls = [];

        // If images are provided, upload them to Cloudinary (or another storage) and get URLs
        if (req.files && req.files.image) {
            const images = Array.isArray(req.files.image) ? req.files.image : [req.files.image];
            
            for (const image of images) {
                const result = await uploadToCloudinary(image); // upload function for Cloudinary
                if (result && result.secure_url) {
                    imageUrls.push(result.secure_url);
                }
            }
        }

        // Validate at least one of text or images is provided
        if (!text && imageUrls.length === 0) {
            return res.status(400).json({ message: "Post text or image is required" });
        }

        const post = new UserPost({
            user: userId,
            text,
            image: imageUrls
        });

        await post.save();
        res.status(201).json({ message: "Post created successfully", post });
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





    module.exports = {createPost,likePost,sharePost,commentOnPost}
    
