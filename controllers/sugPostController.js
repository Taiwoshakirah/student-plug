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
const SchoolInfo = require('../models/schoolInfo')
const UserPost = require('../models/post')
const UserComment = require('../models/comment');



const createSugPost = async (req, res) => {
    const { adminId, text, schoolInfoId } = req.body; // Add schoolInfoId here
    if (!adminId || !text || !schoolInfoId) { // Include schoolInfoId in validation
        return res.status(400).json({ message: "Admin ID, text, and schoolInfoId are required" });
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

                // Temporary file deleted   
                fs.unlink(tempFilePath, (unlinkErr) => {
                    if (unlinkErr) {
                        console.error("Error deleting temporary file:", unlinkErr);
                    }
                });
            }
        }
        console.log("Final image URLs to be saved:", imageUrls);

        // Create post with all image URLs and schoolInfoId
        const post = new SugPost({ adminId, text, images: imageUrls, schoolInfoId });
        await post.save();

        // Fetch the post with populated school information (uniProfilePicture and university name)
        const populatedPost = await SugPost.findById(post._id)
            .populate({
                path: "schoolInfoId",
                select: "university uniProfilePicture",
                model: "SchoolInfo"
            })
            .populate("adminId", "sugFullName email"); // Optionally, populate admin info

        res.status(201).json({ message: "Post created", post: populatedPost });
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

        const post = await SugPost.findById(postId);
        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }

        const user = userId ? await User.findById(userId) : null;
        const admin = adminId ? await User.findById(adminId) : null;

        // Initialize userLiked and adminLiked status
        const userLiked = user ? post.likes.some(like => like.id.toString() === userId.toString()) : false;
        const adminLiked = admin ? post.likes.some(like => like.id.toString() === adminId.toString()) : false;

        // Toggle user like if userId is provided
        if (userId && user) {
            if (userLiked) {
                // User is unliking the post
                post.likes = post.likes.filter(like => like.id.toString() !== userId.toString()); // Remove user like
            } else {
                // User is liking the post
                post.likes.push({ _id: userId, fullName: user.fullName || "Unknown User", id: userId }); // Use placeholder if fullName is not available
            }
        }

        // Toggle admin like if adminId is provided
        if (adminId && admin) {
            if (adminLiked) {
                // Admin is unliking the post
                post.likes = post.likes.filter(like => like.id.toString() !== adminId.toString()); // Remove admin like
            } else {
                // Admin is liking the post
                post.likes.push({ _id: adminId, fullName: admin.fullName || "Unknown Admin", id: adminId }); // Use placeholder if fullName is not available
            }
        }

        await post.save();

        // Prepare response with updated likes information
        const updatedLikes = post.likes.map(like => ({
            userId: like.id,
            fullName: like.fullName || "Unknown User",
            liked: true
        }));

        return res.status(200).json({
            message: "Post like toggled",
            likesCount: post.likes.length,
            likesArray: post.likes,
            userLiked: !userLiked, 
            adminLiked: !adminLiked, 
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


  

// const fetchPostDetails = async (req, res) => {
//     try {
//         const { adminId } = req.params; // Change this line to use req.params

//         console.log("Admin ID:", adminId);

//         // Ensure adminId is provided and convert it to an ObjectId
//         if (!adminId) {
//             return res.status(400).json({ message: "Admin ID is required" });
//         }

//         const adminObjectId = new mongoose.Types.ObjectId(adminId);

//         // Find posts only for the given adminId
//         const posts = await SugPost.find({ adminId: adminObjectId })
//             .populate("adminId", "sugFullName email")
//             .populate({
//                 path: "likes",
//                 model: "User",
//                 select: "_id fullName"
//             })
//             .populate({
//                 path: "comments",
//                 select: "text userId createdAt isAdmin",
//                 populate: {
//                     path: "userId",
//                     model: "User",
//                     select: "_id fullName"
//                 }
//             })
//             .sort({ createdAt: -1 })
//             .lean();

//         // If no posts found, return a message
//         if (posts.length === 0) {
//             return res.status(404).json({ message: "No posts found for this admin." });
//         }

//         // Process the fetched posts
//         posts.forEach(post => {
//             console.log(`Post ID: ${post._id}`);
//             console.log("Likes Array:", post.likes);

//             // Check if admin has liked the post
//             post.adminLiked = post.likes.some(like => like._id.equals(adminObjectId));
//             console.log(`Admin liked this post: ${post.adminLiked}`);

//             // Additional properties
//             post.commentsCount = post.comments.length;
//             post.likesCount = post.likes.length;

//             // Ensure comments have a consistent `isAdmin` field
//             post.comments = post.comments.map(comment => ({
//                 ...comment,
//                 isAdmin: comment.isAdmin || false
//             }));
//         });

//         res.json({ posts });
//     } catch (error) {
//         console.error("Error fetching posts:", error);
//         res.status(500).json({ message: "Error fetching posts", error });
//     }
// };





const fetchPostsForSchool = async (req, res) => {
    const { schoolInfoId } = req.params;
    console.log("Received schoolInfoId:", schoolInfoId);

    if (!mongoose.Types.ObjectId.isValid(schoolInfoId)) {
        return res.status(400).json({ message: "Invalid schoolInfoId" });
    }

    try {
        const schoolInfo = await SchoolInfo.findById(schoolInfoId)
            .select("university state aboutUniversity userId uniProfilePicture")
            .populate({
                path: "userId",
                model: "User",
                select: "fullName email"
            })
            .lean();

        if (!schoolInfo) {
            return res.status(404).json({ message: "School not found" });
        }

        const adminPosts = await SugPost.find({ schoolInfoId })
            .populate({
                path: "adminId",
                model: "SugUser",
                select: "sugFullName email role",
                populate: {
                    path: "schoolInfo",
                    model: "SchoolInfo",
                    select: "university uniProfilePicture"
                }
            })
            .populate({
                path: "likes",
                model: "SugUser",
                select: "_id fullName"
            })
            .populate({
                path: "comments",
                model: "SugPostComment",
                select: "text createdAt isAdmin",
                populate: {
                    path: "user",
                    model: "SugUser",
                    select: "_id fullName"
                }
            })
            .sort({ createdAt: -1 })
            .lean();

        const adminPostsWithDetails = adminPosts.map(post => ({
            ...post,
            postType: "admin",
            isAdmin: post.adminId?.role === "admin",
            userId: {
                id: post.adminId?._id || "",
                university: post.adminId?.schoolInfo?.university || "",
                schoolInfo: {
                    id: post.adminId?.schoolInfo?._id || "",
                    university: post.adminId?.schoolInfo?.university || ""
                },
                profilePicture: post.adminId?.schoolInfo?.uniProfilePicture || ""
            }
        }));

        const studentPosts = await UserPost.find({ schoolInfoId })
            .populate({
                path: "user",
                model: "User",
                select: "fullName email profilePhoto",
                populate: [
                    {
                        path: "studentInfo",
                        model: "StudentInfo",
                        select: "faculty department"
                    },
                    {
                        path: "schoolInfoId",  // Ensure schoolInfoId is populated in the User model
                        model: "SchoolInfo",
                        select: "university"
                    }
                ]
            })
            .populate({
                path: "likes",
                model: "User",
                select: "_id fullName"
            })
            .populate({
                path: "comments",
                model: "UserComment",
                select: "text createdAt",
                populate: {
                    path: "user",
                    model: "User",
                    select: "_id fullName"
                }
            })
            .sort({ createdAt: -1 })
            .lean();

        const studentPostsWithDetails = studentPosts.map(post => ({
            ...post,
            postType: "student",
            userId: {
                id: post.user?._id || "",
                university: post.user?.schoolInfoId?.university || "",  // Access schoolInfoId.university here
                schoolInfo: {
                    id: post.user?.schoolInfoId?._id || "",
                    university: post.user?.schoolInfoId?.university || ""
                },
                profilePicture: post.user?.profilePhoto || ""
            },
            faculty: post.user?.studentInfo?.faculty || "",
            department: post.user?.studentInfo?.department || ""
        }));

        const allPosts = [...adminPostsWithDetails, ...studentPostsWithDetails].sort(
            (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );

        res.json({
            schoolInfo,
            posts: allPosts
        });
    } catch (error) {
        console.error("Error fetching school info and posts:", error);
        res.status(500).json({ message: "Error fetching school info and posts", error });
    }
};















// In your routes file
// router.get('/posts/school/:schoolId', fetchPostsForSchool);















module.exports = {createSugPost,toggleLike,addComment,fetchPostsForSchool}