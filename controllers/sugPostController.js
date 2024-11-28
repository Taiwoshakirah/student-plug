const SugPost = require('../models/sugPost')
const SugPostComment = require('../models/sugComment')
const { promisify } = require("util");
const cloudinary = require("cloudinary");
const { uploadToCloudinary } = require("../config/cloudinaryConfig"); 
const fs = require("fs");;
const mongoose = require('mongoose');
const Roles = require('../middlewares/role');
const User = require('../models/signUp')
const SugUser = require('../models/schoolSug')
const { Types: { ObjectId } } = require('mongoose'); 
const SchoolInfo = require('../models/schoolInfo')
const UserPost = require('../models/post')
const UserComment = require('../models/comment');
const { sendNotification } = require('../utils/websocket');
const Comment = require('../models/allComment')
const {extractHashtags} = require('./trendingController')


const createSugPost = async (req, res) => {
    const { adminId, text, schoolInfoId } = req.body;

    if (!adminId || !schoolInfoId) {
        return res.status(400).json({ message: "Admin ID, and schoolInfoId are required" });
    }

    // Ensure either text or image(s) is provided
    if (!text && !(req.files && req.files.image)) {
        return res.status(400).json({ message: "You must provide either text, image(s), or both" });
    }

    try {
        let imageUrls = [];

        if (req.files && req.files.image) {
            const images = Array.isArray(req.files.image) ? req.files.image : [req.files.image];
            for (const image of images) {
                const tempFilePath = `uploads/${image.name}`;
                await image.mv(tempFilePath);
                const result = await uploadToCloudinary(tempFilePath);
                if (result && result.secure_url) {
                    imageUrls.push(result.secure_url);
                }
                fs.unlinkSync(tempFilePath); // Clean up temporary file
            }
        }

        // Extract hashtags and check for trending hashtags
        const processedText = text || ""; // Ensure `text` is a string
        const hashtags = extractHashtags(processedText);
        const trendingHashtags = ["#trending", "#viral"]; // Define trending hashtags
        const isTrending = hashtags.some((hashtag) =>
            trendingHashtags.includes(hashtag.toLowerCase())
        );

        // Create post
        const post = new SugPost({
            adminId,
            text: processedText,
            images: imageUrls,
            schoolInfoId,
            trending: processedText.includes("#"), // Set trending based on hashtags
        });
        await post.save();

        const populatedPost = await SugPost.findById(post._id)
            .populate("schoolInfoId", "university uniProfilePicture")
            .populate("adminId", "sugFullName email");

        res.status(201).json({ message: "Post created", post: populatedPost });
    } catch (error) {
        console.error("Error creating post:", error);
        res.status(500).json({ message: "Error creating post", error });
    }
};

// const createSugPost = async (req, res) => {
//     const { adminId, text, schoolInfoId } = req.body; 
//     if (!adminId || !text || !schoolInfoId) { 
//         return res.status(400).json({ message: "Admin ID, text, and schoolInfoId are required" });
//     }

//     try {
//         let imageUrls = [];

//         if (req.files && req.files.image) {
//             const images = Array.isArray(req.files.image) ? req.files.image : [req.files.image];
//             console.log("Images received in request:", images);

//             for (const image of images) {
//                 const tempFilePath = `uploads/${image.name}`;

//                 await image.mv(tempFilePath);
//                 console.log(`File moved to temporary path: ${tempFilePath}`);

//                 const result = await uploadToCloudinary(tempFilePath);
//                 console.log("Cloudinary upload result:", result);

//                 if (result && result.secure_url) {
//                     imageUrls.push(result.secure_url);
//                 } else {
//                     console.error("Failed to upload image to Cloudinary:", result);
//                 }

//                 // Temporary file deletion  
//                 fs.unlink(tempFilePath, (unlinkErr) => {
//                     if (unlinkErr) {
//                         console.error("Error deleting temporary file:", unlinkErr);
//                     }
//                 });
//             }
//         }
//         console.log("Final image URLs to be saved:", imageUrls);

//         //post Created with all image URLs and schoolInfoId
//         const post = new SugPost({ adminId, text, images: imageUrls, schoolInfoId });
//         await post.save();

//         const populatedPost = await SugPost.findById(post._id)
//             .populate({
//                 path: "schoolInfoId",
//                 select: "university uniProfilePicture",
//                 model: "SchoolInfo"
//             })
//             .populate("adminId", "sugFullName email");

//         res.status(201).json({ message: "Post created", post: populatedPost });
//     } catch (error) {
//         console.error("Error creating post:", error);
//         res.status(500).json({ message: "Error creating post", error });
//     }
// };




const isValidObjectId = (id) => {
    return ObjectId.isValid(id) && (new ObjectId(id)).equals(id);
};

const toggleLike = async (req, res) => {
    try {
        const { postId } = req.params;
        const { userId, adminId } = req.body;

        console.log("userId:", userId, "adminId:", adminId);

        if (!userId && !adminId) {
            return res.status(400).json({ message: "Invalid liker ID" });
        }

        const likerId = userId || adminId;

        const post = await UserPost.findById(postId) || await SugPost.findById(postId);
        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }

        const alreadyLikedIndex = post.likes.findIndex(like => like && like._id && like._id.toString && like._id.toString() === likerId);

        if (alreadyLikedIndex !== -1) {
            post.likes.splice(alreadyLikedIndex, 1);  
        } else {
            post.likes.push({ _id: likerId, fullName: "Unknown Liker",createdAt: new Date() });  
        }

        await post.save();

        const postOwnerId = post.user && post.user._id ? post.user._id.toString() : post.adminId && post.adminId._id ? post.adminId._id.toString() : null;

        if (!postOwnerId) {
            return res.status(400).json({ message: "Post owner not found" });
        }

        console.log("Post Owner ID: ", postOwnerId);

        // Send notification to the post owner if liked by someone else(websocket here also)
        if (postOwnerId && postOwnerId !== likerId) {
            sendNotification(postOwnerId, {
                type: "like",
                message: `Your post was ${alreadyLikedIndex !== -1 ? "unliked" : "liked"}`,
                postId: post._id,
                likerId: likerId
            });

            if (req.io) {
                req.io.to(postOwnerId).emit("post_like_toggled", {
                    postId,
                    likerId,
                    action: alreadyLikedIndex !== -1 ? "unlike" : "like",
                });
            } else {
                console.error("Socket.IO instance not found");
            }
            
        }

        // Updated likes array
        const likerIds = post.likes.map(like => like && like._id).filter(Boolean);
        const users = await User.find({ _id: { $in: likerIds } });
        const admins = await SugUser.find({ _id: { $in: likerIds } });

        const userMap = new Map(users.map(user => [user._id.toString(), user.fullName]));
        const adminMap = new Map(admins.map(admin => [admin._id.toString(), admin.sugFullName]));

        // Map likes to include fullName if it's available, or "Unknown Liker" if missing
        const updatedLikes = post.likes.map(like => {
            if (!like || !like._id) return { userId: null, fullName: "Unknown Liker", liked: true, createdAt: null };
            
            const likeId = like._id.toString();
            const fullName = userMap.get(likeId) || adminMap.get(likeId) || "Unknown Liker";
        
            return {
                userId: like._id,
                fullName,
                liked: true,
                createdAt: like.createdAt || null, // Include createdAt if available
            };
        });
        

        console.log(`Updated likes for post ${post._id}:`, post.likes);
        console.log(`Post ${post._id} now has ${post.likes.length} likes.`);

        // Emit a real-time event to update all clients
        req.io.emit("post_likes_updated", {
            postId,
            likesCount: post.likes.length,
            updatedLikes,
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
//     const { postType, text, userId, parentCommentId } = req.body;

//     try {
//         if (!postId || !userId || !text) {
//             return res.status(400).json({ message: "postId, userId, and text are required" });
//         }

//         let newComment;

//         if (postType === "admin") {
//             newComment = await SugPostComment.create({
//                 post: postId,
//                 text,
//                 admin: userId,
//                 parentComment: parentCommentId || null,
//                 createdAt: new Date(),
//             });
//         } else if (postType === "user") {
//             newComment = await SugPostComment.create({
//                 post: postId,
//                 text,
//                 user: userId,
//                 parentComment: parentCommentId || null,
//                 createdAt: new Date(),
//             });
//         } else {
//             return res.status(400).json({ message: "Invalid post type" });
//         }

//         if (parentCommentId) {
//             await SugPostComment.findByIdAndUpdate(parentCommentId, {
//                 $push: { replies: newComment._id },
//             });
//         }

//         const populatedComment = await newComment.populate(postType === "admin" ? {
//     path: 'admin',
//     select: 'sugfullName uniProfilePicture',
// } : {
//     path: 'user',
//     select: 'fullName profilePhoto',
// });


//         res.status(201).json({ message: "Comment added", comment: populatedComment });
//     } catch (error) {
//         console.error("Error adding comment:", error);
//         res.status(500).json({ message: "Error adding comment", error });
//     }
// };



// const fetchComments = async (req, res) => {
//     const { postId } = req.params;
//     const { postType } = req.query;

//     try {
//         let comments;

//         if (postType === "admin") {
//             comments = await SugPostComment.find({ post: postId })
//                 .populate({
//                     path: "user",
//                     select: "fullName profilePhoto",
//                     transform: (doc) => {
//                         if (doc) {
//                             console.log("Profile Photo for User:", doc.profilePhoto); // Log the actual profile photo URL
//                             return {
//                                 _id: doc._id,
//                                 fullName: doc.fullName,
//                                 profilePhoto: doc.profilePhoto, // Remove fallback temporarily for testing
//                             };
//                         }
//                         return null; // Handle missing user
//                     },
//                 });
//         } else if (postType === "user") {
//             comments = await UserComment.find({ post: postId })
//                 .populate({
//                     path: "user",
//                     select: "fullName profilePhoto",
//                     transform: (doc) => {
//                         if (doc) {
//                             console.log("Profile Photo for User:", doc.profilePhoto); // Log for verification
//                             return {
//                                 _id: doc._id,
//                                 fullName: doc.fullName,
//                                 profilePhoto: doc.profilePhoto,
//                             };
//                         }
//                         return null;
//                     },
//                 });
//         } else {
//             return res.status(400).json({ message: "Invalid post type" });
//         }

//         if (!comments.length) {
//             return res.status(404).json({ message: "No comments found for this post." });
//         }

//         // Build comment tree
//         const commentTree = comments.reduce((tree, comment) => {
//             const commentObj = { ...comment.toObject(), replies: [] };
//             if (!comment.parentComment) {
//                 tree.push(commentObj);
//             } else {
//                 const parent = tree.find(c => c._id.equals(comment.parentComment));
//                 if (parent) {
//                     parent.replies.push(commentObj);
//                 }
//             }
//             return tree;
//         }, []);

//         res.status(200).json({ comments: commentTree });
//     } catch (error) {
//         console.error("Error fetching comments:", error);
//         res.status(500).json({ message: "Error fetching comments", error });
//     }
// };


const addComment = async (req, res) => {
    const { postId } = req.params;
    const { text, userId, isAdmin, parentCommentId } = req.body;

    try {
        if (!postId || !userId || !text) {
            return res.status(400).json({ message: "postId, userId, and text are required." });
        }

        const isAdminFlag = isAdmin === true || isAdmin === "true"; // Handle different types
        const commentData = {
            post: postId,
            text,
            parentComment: parentCommentId || null,
            isAdmin: isAdminFlag,
            ...(isAdminFlag ? { admin: userId } : { user: userId }),
        };

        const newComment = await Comment.create(commentData);

        if (parentCommentId) {
            await Comment.findByIdAndUpdate(parentCommentId, {
                $push: { replies: newComment._id },
            });
        }

        const populatedComment = await newComment.populate([
            {
                path: "user",
                model: "User",
                select: "fullName profilePhoto",
            },
            {
                path: "admin",
                model: "SugUser",
                populate: {
                    path: "schoolInfo", // Populate schoolInfo from SchoolInfo collection
                    model: "SchoolInfo",
                    select: "uniProfilePicture", // Select only uniProfilePicture
                },
                select: "sugFullName schoolInfo", // Ensure schoolInfo is included
            },
        ]);
        

        res.status(201).json({
            message: "Comment added successfully",
            comment: populatedComment,
        });
    } catch (error) {
        console.error("Error adding comment:", error.message || error);
        res.status(500).json({
            message: "Error adding comment",
            error: error.message || error,
        });
    }
};




const fetchComments = async (req, res) => {
    const { postId } = req.params;

    try {
        // Fetch all top-level comments for the post (both admin and user)
        const comments = await Comment.find({ post: postId, parentComment: null })
            .populate({
                path: "user", // Populate user field for regular users
                select: "fullName profilePhoto",
                transform: (doc) => {
                    if (doc) {
                        return {
                            _id: doc._id,
                            fullName: doc.fullName,
                            profilePicture: doc.profilePhoto, // Rename profilePhoto to profilePicture
                        };
                    }
                    return null;
                },
            })
            .populate({
                path: "admin", // Populate admin field for admin users
                select: "sugFullName",
                populate: {
                    path: "schoolInfo", // Populate the schoolInfo for the admin to get uniProfilePicture
                    model: "SchoolInfo",
                    select: "uniProfilePicture",
                },
                transform: (doc) => {
                    if (doc) {
                        return {
                            _id: doc._id,
                            fullName: doc.sugFullName, // Standardize field name to fullName for consistency
                            profilePicture: doc.schoolInfo ? doc.schoolInfo.uniProfilePicture : null, // Rename uniProfilePicture to profilePicture
                        };
                    }
                    return null;
                },
            })
            .populate({
                path: "replies", // Populate replies
                populate: {
                    path: "user", // Populate user field in replies for regular users
                    select: "fullName profilePhoto",
                    transform: (doc) => {
                        if (doc) {
                            return {
                                _id: doc._id,
                                fullName: doc.fullName,
                                profilePicture: doc.profilePhoto, // Rename profilePhoto to profilePicture
                            };
                        }
                        return null;
                    },
                },
            });

        if (!comments.length) {
            return res.status(404).json({ message: "No comments found for this post." });
        }

        // Transform fetched comments to replace `admin` with `user` dynamically
        const transformedComments = comments.map((comment) => {
            const obj = comment.toObject();

            if (obj.admin) {
                // Assign admin to user key
                obj.user = { ...obj.admin };
                delete obj.admin; // Remove admin key
            }

            // Recursively handle replies if they exist
            if (obj.replies && obj.replies.length > 0) {
                obj.replies = obj.replies.map((reply) => {
                    const replyObj = { ...reply };
                    if (replyObj.admin) {
                        replyObj.user = { ...replyObj.admin };
                        delete replyObj.admin;
                    }
                    return replyObj;
                });
            }

            return obj;
        });

        // Helper function to build a nested comment tree
        const buildCommentTree = (comments) => {
            return comments.map((comment) => {
                const commentObj = { ...comment };
                if (comment.replies && comment.replies.length > 0) {
                    commentObj.replies = buildCommentTree(comment.replies);
                }
                return commentObj;
            });
        };

        // Generate the comment tree structure
        const commentTree = buildCommentTree(transformedComments);

        res.status(200).json({ comments: commentTree });
    } catch (error) {
        console.error("Error fetching comments:", error);
        res.status(500).json({ message: "Error fetching comments", error: error.message });
    }
};



  

const fetchPostDetails = async (req, res) => {
    try {
        const { adminId } = req.params;

        console.log("Admin ID:", adminId);

        if (!adminId) {
            return res.status(400).json({ message: "Admin ID is required" });
        }

        const adminObjectId = new mongoose.Types.ObjectId(adminId);

        const posts = await SugPost.find({ adminId: adminObjectId })
            .populate({
                path: "adminId",
                select: "sugFullName email",
                populate: {
                    path: "schoolInfo",  
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

        if (posts.length === 0) {
            return res.status(404).json({ message: "No posts found for this admin." });
        }

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
    const { page = 1, limit = 6 } = req.query; // Default to page 1, 6 posts per page

    console.log("Received schoolInfoId:", schoolInfoId);

    if (!mongoose.Types.ObjectId.isValid(schoolInfoId)) {
        return res.status(400).json({ message: "Invalid schoolInfoId" });
    }

    try {
        // Fetching school information
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

        // Convert page and limit to integers
        const pageNumber = parseInt(page, 6);
        const limitNumber = parseInt(limit, 6);

        // Fetch admin posts with pagination
        const adminPosts = await SugPost.find({ schoolInfoId })
            .populate([
                {
                    path: "adminId",
                    model: "SugUser",
                    select: "sugFullName email role",
                    populate: {
                        path: "schoolInfo",
                        model: "SchoolInfo",
                        select: "university uniProfilePicture"
                    }
                },
                {
                    path: "comments",
                    model: "Comment",
                    populate: [
                        { path: "user", model: "User", select: "fullName profilePhoto" },
                        { path: "admin", model: "SugUser", select: "sugFullName" },
                        {
                            path: "replies",
                            model: "Comment",
                            populate: [
                                { path: "user", model: "User", select: "fullName profilePhoto" },
                                { path: "admin", model: "SugUser", select: "sugFullName" }
                            ]
                        }
                    ]
                }
            ])
            .sort({ createdAt: -1 })
            .skip((pageNumber - 1) * limitNumber)
            .limit(limitNumber)
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

        // Fetch student posts with pagination
        const studentPosts = await UserPost.find({ schoolInfoId })
            .populate([
                {
                    path: "user",
                    model: "User",
                    select: "fullName email profilePhoto",
                    populate: [
                        { path: "studentInfo", model: "StudentInfo", select: "faculty department" },
                        { path: "schoolInfoId", model: "SchoolInfo", select: "university" }
                    ]
                },
                {
                    path: "comments",
                    model: "Comment",
                    populate: [
                        { path: "user", model: "User", select: "fullName profilePhoto" },
                        { path: "admin", model: "SugUser", select: "sugFullName" },
                        {
                            path: "replies",
                            model: "Comment",
                            populate: [
                                { path: "user", model: "User", select: "fullName profilePhoto" },
                                { path: "admin", model: "SugUser", select: "sugFullName" }
                            ]
                        }
                    ]
                }
            ])
            .sort({ createdAt: -1 })
            .skip((pageNumber - 1) * limitNumber)
            .limit(limitNumber)
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

        // Combine posts
        const allPosts = [...adminPostsWithDetails, ...studentPostsWithDetails].sort(
            (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );

        // Total post count
        const totalAdminPosts = await SugPost.countDocuments({ schoolInfoId });
        const totalStudentPosts = await UserPost.countDocuments({ schoolInfoId });
        const totalPosts = totalAdminPosts + totalStudentPosts;

        // Response
        res.json({
            schoolInfo,
            posts: allPosts,
            totalPosts,
            currentPage: pageNumber,
            totalPages: Math.ceil(totalPosts / limitNumber)
        });
    } catch (error) {
        console.error("Error fetching school info and posts:", error);
        res.status(500).json({ message: "Error fetching school info and posts", error });
    }
};




// const fetchPostsForSchool = async (req, res) => {
//     const { schoolInfoId } = req.params;
//     console.log("Received schoolInfoId:", schoolInfoId);

//     if (!mongoose.Types.ObjectId.isValid(schoolInfoId)) {
//         return res.status(400).json({ message: "Invalid schoolInfoId" });
//     }

//     try {
//         // Fetching school information
//         const schoolInfo = await SchoolInfo.findById(schoolInfoId)
//             .select("university state aboutUniversity userId uniProfilePicture")
//             .populate({
//                 path: "userId",
//                 model: "User",
//                 select: "fullName email"
//             })
//             .lean();

//         if (!schoolInfo) {
//             return res.status(404).json({ message: "School not found" });
//         }

//         // Fetch admin posts with comments
//         const adminPosts = await SugPost.find({ schoolInfoId })
//             .populate([
//                 {
//                     path: "adminId",
//                     model: "SugUser",
//                     select: "sugFullName email role",
//                     populate: {
//                         path: "schoolInfo",
//                         model: "SchoolInfo",
//                         select: "university uniProfilePicture"
//                     }
//                 },
//                 {
//                     path: "comments",
//                     model: "Comment",
//                     populate: [
//                         { path: "user", model: "User", select: "fullName profilePhoto" },
//                         { path: "admin", model: "SugUser", select: "sugFullName" },
//                         {
//                             path: "replies",
//                             model: "Comment",
//                             populate: [
//                                 { path: "user", model: "User", select: "fullName profilePhoto" },
//                                 { path: "admin", model: "SugUser", select: "sugFullName" }
//                             ]
//                         }
//                     ]
//                 }
//             ])
//             .sort({ createdAt: -1 })
//             .lean();

//         // Format admin posts
//         const adminPostsWithDetails = adminPosts.map(post => ({
//             ...post,
//             postType: "admin",
//             isAdmin: post.adminId?.role === "admin",
//             userId: {
//                 id: post.adminId?._id || "",
//                 university: post.adminId?.schoolInfo?.university || "",
//                 schoolInfo: {
//                     id: post.adminId?.schoolInfo?._id || "",
//                     university: post.adminId?.schoolInfo?.university || ""
//                 },
//                 profilePicture: post.adminId?.schoolInfo?.uniProfilePicture || ""
//             }
//         }));

//         // Fetch student posts with comments
//         const studentPosts = await UserPost.find({ schoolInfoId })
//             .populate([
//                 {
//                     path: "user",
//                     model: "User",
//                     select: "fullName email profilePhoto",
//                     populate: [
//                         { path: "studentInfo", model: "StudentInfo", select: "faculty department" },
//                         { path: "schoolInfoId", model: "SchoolInfo", select: "university" }
//                     ]
//                 },
//                 {
//                     path: "comments",
//                     model: "Comment",
//                     populate: [
//                         { path: "user", model: "User", select: "fullName profilePhoto" },
//                         { path: "admin", model: "SugUser", select: "sugFullName" },
//                         {
//                             path: "replies",
//                             model: "Comment",
//                             populate: [
//                                 { path: "user", model: "User", select: "fullName profilePhoto" },
//                                 { path: "admin", model: "SugUser", select: "sugFullName" }
//                             ]
//                         }
//                     ]
//                 }
//             ])
//             .sort({ createdAt: -1 })
//             .lean();

//         // Format student posts
//         const studentPostsWithDetails = studentPosts.map(post => ({
//             ...post,
//             postType: "student",
//             userId: {
//                 id: post.user?._id || "",
//                 university: post.user?.schoolInfoId?.university || "",
//                 schoolInfo: {
//                     id: post.user?.schoolInfoId?._id || "",
//                     university: post.user?.schoolInfoId?.university || ""
//                 },
//                 profilePicture: post.user?.profilePhoto || ""
//             },
//             faculty: post.user?.studentInfo?.faculty || "",
//             department: post.user?.studentInfo?.department || ""
//         }));

//         // Combine and sort posts
//         const allPosts = [...adminPostsWithDetails, ...studentPostsWithDetails].sort(
//             (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
//         );

//         // Fetch likes for each post with details
//         const allPostsWithLikes = await Promise.all(
//             allPosts.map(async post => {
//                 const likesWithDetails = await Promise.all(
//                     post.likes.map(async like => {
//                         const userLike = await User.findById(like._id).select("fullName");
//                         const adminLike = await SugUser.findById(like._id).select("sugFullName");
//                         return {
//                             _id: like._id,
//                             fullName: userLike?.fullName || adminLike?.sugFullName || "Unknown Liker"
//                         };
//                     })
//                 );
//                 return { ...post, likes: likesWithDetails };
//             })
//         );

//         res.json({
//             schoolInfo,
//             posts: allPostsWithLikes
//         });
//     } catch (error) {
//         console.error("Error fetching school info and posts:", error);
//         res.status(500).json({ message: "Error fetching school info and posts", error });
//     }
// };



const deletePost = async (req, res) => {
    const { postId } = req.params;
    const { userId, role } = req.user;

    console.log("Post ID from params:", postId); 

    if (!mongoose.Types.ObjectId.isValid(postId)) {
        return res.status(400).json({ message: "Invalid Post ID format" });
    }

    let postModel;
    if (role === Roles.ADMIN) {
        console.log("Admin role detected, checking both UserPost and SugPost models.");
        postModel = [UserPost, SugPost]; 
    } else {
        console.log("Regular user role detected, checking UserPost model.");
        postModel = UserPost;
    }

    try {
        let post;
        
        if (Array.isArray(postModel)) {
            post = await postModel[0].findById(postId) || await postModel[1].findById(postId);
        } else {
            post = await postModel.findById(postId);
        }
        
        console.log("Found post:", post);

        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }

        
        const isAuthorized = role === Roles.ADMIN || post.user.toString() === userId.toString();
        if (!isAuthorized) {
            return res.status(403).json({ message: "Unauthorized to delete this post" });
        }

        await UserComment.deleteMany({ post: postId });

        
        if (post.images && post.images.length > 0) {
            for (const imageUrl of post.images) {
                const publicId = imageUrl.split('/').pop().split('.')[0];
                await cloudinary.uploader.destroy(publicId);
            }
        }

        await post.deleteOne();

        res.status(200).json({ message: "Post and associated comments deleted successfully" });
    } catch (error) {
        console.error("Error deleting post:", error);
        res.status(500).json({ message: "Failed to delete post", error });
    }
};
















module.exports = {createSugPost,toggleLike,addComment,fetchComments,fetchPostDetails,fetchPostsForSchool,deletePost}