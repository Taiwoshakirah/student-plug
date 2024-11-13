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
const { sendNotification } = require('../utils/websocket');



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
        const likerId = userId || adminId;

        // Find the post by ID
        const post = await UserPost.findById(postId) || await SugPost.findById(postId);
        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }

        // Check if the liker already exists in the post likes
        const alreadyLikedIndex = post.likes.findIndex(
            like => like._id.toString() === likerId
        );

        // Toggle like
        if (alreadyLikedIndex !== -1) {
            post.likes.splice(alreadyLikedIndex, 1);  // Remove like
        } else {
            post.likes.push({ _id: likerId });  // Add like
        }

        // Save the updated post
        await post.save();

        const postOwnerId = post.user ? post.user._id.toString() : post.adminId._id.toString();

        // Send notification to the post owner if liked by someone else
        if (postOwnerId !== likerId) {
            sendNotification(postOwnerId, {
                type: "like",
                message: `Your post was ${alreadyLikedIndex !== -1 ? "unliked" : "liked"}`,
                postId: post._id,
                likerId: likerId
            });
        }

        // Collect unique liker IDs
        const likerIds = post.likes.map(like => like._id);

        // Fetch user information from User collection for regular users
        const users = await User.find({ _id: { $in: likerIds } });
        
        // Fetch admin information from SugUser collection only if adminId is provided
        const admins = await SugUser.find({ _id: { $in: likerIds } });

        // Map the likes array to include fullName from User or SugUser, if available
        const updatedLikes = post.likes.map(like => {
            const userLiker = users.find(user => user._id.toString() === like._id.toString());
            const adminLiker = admins.find(admin => admin._id.toString() === like._id.toString());

            return {
                userId: like._id,
                fullName: userLiker?.fullName || adminLiker?.sugFullName || "Unknown Liker",
                liked: true,
            };
        });

        res.status(200).json({
            message: "Post like toggled",
            likesCount: post.likes.length,
            likesArray: updatedLikes,
            userLiked: !!userId && alreadyLikedIndex === -1,
            adminLiked: !!adminId && alreadyLikedIndex === -1,
            allLikes: updatedLikes,
        });
    } catch (error) {
        console.error("Error toggling like:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};








// const addComment = async (req, res) => {
//     const { postId } = req.params;
//     const text = req.body.text;

//     const userId = req.user.userId; 
//     const role = req.user.role; 
//     if (!userId) {
//         return res.status(400).json({ message: "User ID is required" });
//     }
//     if (!text) {
//         return res.status(400).json({ message: "Comment text is required" });
//     }

//     const isAdmin = role === "admin"; 

//     try {
//         const comment = new SugPostComment({ postId, userId, text, isAdmin, role });
//         await comment.save();

//         await SugPost.findByIdAndUpdate(postId, { $inc: { commentsCount: 1 } });

//         res.status(201).json({ message: "Comment added", comment });
//     } catch (error) {
//         console.error("Error adding comment:", error);
//         res.status(500).json({ message: "Error commenting on post", error });
//     }
// };

// POST /api/posts/:postId/comments
const addComment = async (req, res) => {
    const { postId } = req.params;
    const { postType, text, userId, parentCommentId } = req.body;

    try {
        if (!postId || !userId || !text) {
            return res.status(400).json({ message: "postId, userId, and text are required" });
        }

        let newComment;
        
        if (postType === "admin") {
            // Commenting on an admin post
            newComment = await SugPostComment.create({
                post: postId,
                text,
                user: userId,
                isAdmin: true,
                parentComment: parentCommentId || null,
                createdAt: new Date(),
            });
        } else if (postType === "user") {
            // Commenting on a user post
            newComment = await UserComment.create({
                post: postId,
                text,
                user: userId,
                parentComment: parentCommentId || null,
                createdAt: new Date(),
            });
        } else {
            return res.status(400).json({ message: "Invalid post type" });
        }

        // Debugging: Log the user and its profile photo before population
        const user = await User.findById(userId);
        console.log("User Before Population:", user);

        // Populate the user with profile photo and full name
        const populatedComment = await newComment.populate({
            path: 'user',
            select: 'fullName profilePhoto',
        });

        console.log("Populated Comment:", populatedComment);  // Check if profilePhoto is populated now

        res.status(201).json({ message: "Comment added", comment: populatedComment });
    } catch (error) {
        console.error("Error adding comment:", error);
        res.status(500).json({ message: "Error adding comment", error });
    }
};





const fetchComments = async (req, res) => {
    const { postId } = req.params;
    const { postType } = req.query;

    try {
        let comments;

        if (postType === "admin") {
            comments = await SugPostComment.find({ post: postId })
                .populate({
                    path: "user",
                    select: "fullName profilePhoto",
                    transform: (doc) => {
                        if (doc) {
                            console.log("Profile Photo for User:", doc.profilePhoto); // Log the actual profile photo URL
                            return {
                                _id: doc._id,
                                fullName: doc.fullName,
                                profilePhoto: doc.profilePhoto, // Remove fallback temporarily for testing
                            };
                        }
                        return null; // Handle missing user
                    },
                });
        } else if (postType === "user") {
            comments = await UserComment.find({ post: postId })
                .populate({
                    path: "user",
                    select: "fullName profilePhoto",
                    transform: (doc) => {
                        if (doc) {
                            console.log("Profile Photo for User:", doc.profilePhoto); // Log for verification
                            return {
                                _id: doc._id,
                                fullName: doc.fullName,
                                profilePhoto: doc.profilePhoto,
                            };
                        }
                        return null;
                    },
                });
        } else {
            return res.status(400).json({ message: "Invalid post type" });
        }

        if (!comments.length) {
            return res.status(404).json({ message: "No comments found for this post." });
        }

        // Build comment tree
        const commentTree = comments.reduce((tree, comment) => {
            const commentObj = { ...comment.toObject(), replies: [] };
            if (!comment.parentComment) {
                tree.push(commentObj);
            } else {
                const parent = tree.find(c => c._id.equals(comment.parentComment));
                if (parent) {
                    parent.replies.push(commentObj);
                }
            }
            return tree;
        }, []);

        res.status(200).json({ comments: commentTree });
    } catch (error) {
        console.error("Error fetching comments:", error);
        res.status(500).json({ message: "Error fetching comments", error });
    }
};







// GET /api/posts/:postId/comments
// const fetchComments = async (req, res) => {
//     const { postId } = req.params;
//     const { postType } = req.query; // postType is sent as a query parameter (either "admin" or "user")

//     try {
//         let comments;
        
//         if (postType === "admin") {
//             // Fetch comments for an admin post
//             comments = await SugPostComment.find({ post: postId })
//                 .populate({
//                     path: "user",
//                     model: "SugUser",
//                     select: "_id fullName",
//                 })
//                 .sort({ createdAt: -1 })
//                 .lean();
//         } else if (postType === "user") {
//             // Fetch comments for a user post
//             comments = await UserComment.find({ post: postId })
//                 .populate({
//                     path: "user",
//                     model: "User",
//                     select: "_id fullName",
//                 })
//                 .sort({ createdAt: -1 })
//                 .lean();
//         } else {
//             return res.status(400).json({ message: "Invalid post type" });
//         }

//         res.json(comments);
//     } catch (error) {
//         console.error("Error fetching comments:", error);
//         res.status(500).json({ message: "Error fetching comments", error });
//     }
// };


  

const fetchPostDetails = async (req, res) => {
    try {
        const { adminId } = req.params;

        console.log("Admin ID:", adminId);

        // Ensure adminId is provided
        if (!adminId) {
            return res.status(400).json({ message: "Admin ID is required" });
        }

        const adminObjectId = new mongoose.Types.ObjectId(adminId);

        // Find posts for the given adminId
        const posts = await SugPost.find({ adminId: adminObjectId })
            .populate({
                path: "adminId",
                select: "sugFullName email",
                populate: {
                    path: "schoolInfo",  // Assuming `schoolInfo` is the field in `adminId` model
                    model: "SchoolInfo",
                    select: "uniProfilePicture"
                }
            })
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

        // Process each post
        const processedPosts = posts.map(post => {
            // Check if admin has liked the post
            const adminLiked = post.likes.some(like => like._id.equals(adminObjectId));

            return {
                ...post,
                adminLiked,
                commentsCount: post.comments.length,
                likesCount: post.likes.length,
                comments: post.comments.map(comment => ({
                    ...comment,
                    isAdmin: comment.isAdmin || false
                })),
                // Add `profilePicture` from `uniProfilePicture`
                profilePicture: post.adminId?.schoolInfo?.uniProfilePicture || ""
            };
        });

        res.json({ posts: processedPosts });
    } catch (error) {
        console.error("Error fetching posts:", error);
        res.status(500).json({ message: "Error fetching posts", error });
    }
};





const fetchPostsForSchool = async (req, res) => {
    const { schoolInfoId } = req.params;
    console.log("Received schoolInfoId:", schoolInfoId);

    if (!mongoose.Types.ObjectId.isValid(schoolInfoId)) {
        return res.status(400).json({ message: "Invalid schoolInfoId" });
    }

    try {
        // Fetch school information
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

        // Fetch admin posts
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

        // Format admin posts
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

        // Fetch student posts
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
                        path: "schoolInfoId",
                        model: "SchoolInfo",
                        select: "university"
                    }
                ]
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

        // Format student posts
        const studentPostsWithDetails = studentPosts.map(post => ({
            ...post,
            postType: "student",
            userId: {
                id: post.user?._id || "",
                university: post.user?.schoolInfoId?.university || "",
                schoolInfo: {
                    id: post.user?.schoolInfoId?._id || "",
                    university: post.user?.schoolInfoId?.university || ""
                },
                profilePicture: post.user?.profilePhoto || ""
            },
            faculty: post.user?.studentInfo?.faculty || "",
            department: post.user?.studentInfo?.department || ""
        }));

        // Combine posts and sort by creation date
        const allPosts = [...adminPostsWithDetails, ...studentPostsWithDetails].sort(
            (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );

        // Populate likes with fullName for each post
        const allPostsWithLikes = await Promise.all(
            allPosts.map(async post => {
                const likesWithDetails = await Promise.all(
                    post.likes.map(async like => {
                        const userLike = await User.findById(like._id).select("fullName");
                        const adminLike = await SugUser.findById(like._id).select("sugFullName");
                        return {
                            _id: like._id,
                            fullName: userLike?.fullName || adminLike?.sugFullName || "Unknown Liker"
                        };
                    })
                );
                return { ...post, likes: likesWithDetails };
            })
        );

        res.json({
            schoolInfo,
            posts: allPostsWithLikes
        });
    } catch (error) {
        console.error("Error fetching school info and posts:", error);
        res.status(500).json({ message: "Error fetching school info and posts", error });
    }
};
















// In your routes file
// router.get('/posts/school/:schoolId', fetchPostsForSchool);















module.exports = {createSugPost,toggleLike,addComment,fetchComments,fetchPostDetails,fetchPostsForSchool}