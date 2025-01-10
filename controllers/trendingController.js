const mongoose = require("mongoose");
const SugPost = require("../models/sugPost");
const UserPost = require("../models/post");
const Comment = require("../models/allComment");


const moment = require('moment-timezone');  // Add moment-timezone

const getTrendingPosts = async (req, res) => {
    try {
        const schoolInfoId = req.query.schoolInfoId;

        if (!schoolInfoId) {
            return res.status(400).json({ message: "schoolInfoId is required" });
        }

        const timezone = 'UTC'; // You can set this to the user's timezone or keep it as UTC
        const now = moment().tz(timezone); // Get current time in the specified timezone

        const startOfToday = now.clone().startOf('day'); // Get the start of today
        const endOfToday = now.clone().endOf('day'); // Get the end of today

        // Calculate 7 days ago
        const sevenDaysAgo = now.clone().subtract(7, 'days'); // 7 days ago

        // Create a query base for posts (fetch posts from the last 7 days including today)
        const query = {
            schoolInfoId,
            createdAt: { $gte: sevenDaysAgo.toDate(), $lte: endOfToday.toDate() }, // Include posts from the last 7 days
        };

        // Fetch posts containing hashtags
        const hashtagPosts = await Promise.all([
            SugPost.find({ ...query, text: { $regex: /#\w+/g } })
                .populate("adminId", "sugFullName email")
                .populate("schoolInfoId", "uniProfilePicture")
                .exec(),
            UserPost.find({ ...query, text: { $regex: /#\w+/g } })
                .populate("user", "fullName profilePhoto")
                .populate({
                    path: "user",
                    populate: {
                        path: "studentInfo",
                        select: "faculty department",
                    },
                })
                .exec()
        ]);

        // // Fetch posts with high engagement (likes or comments)
        // const engagementPosts = await Promise.all([
        //     SugPost.find({ ...query, $or: [{ "likes.0": { $exists: true } }, { "comments.0": { $exists: true } }] })
        //         .populate("adminId", "sugFullName email")
        //         .populate("schoolInfoId", "uniProfilePicture")
        //         .exec(),
        //     UserPost.find({ ...query, $or: [{ "likes.0": { $exists: true } }, { "comments.0": { $exists: true } }] })
        //         .populate("user", "fullName profilePhoto")
        //         .populate({
        //             path: "user",
        //             populate: {
        //                 path: "studentInfo",
        //                 select: "faculty department",
        //             },
        //         })
        //         .exec()
        // ]);
        // Fetch posts with high engagement (likes or comments above 20)
const engagementPosts = await Promise.all([
    SugPost.find({
        ...query,
        $or: [
            { "likes.20": { $exists: true } }, // At least 20 likes
            { "comments.20": { $exists: true } }, // At least 20 comments
        ],
    })
        .populate("adminId", "sugFullName email")
        .populate("schoolInfoId", "uniProfilePicture")
        .exec(),
    UserPost.find({
        ...query,
        $or: [
            { "likes.20": { $exists: true } }, // At least 20 likes
            { "comments.20": { $exists: true } }, // At least 20 comments
        ],
    })
        .populate("user", "fullName profilePhoto")
        .populate({
            path: "user",
            populate: {
                path: "studentInfo",
                select: "faculty department",
            },
        })
        .exec(),
]);


        // Combine all posts
        const allPosts = [...hashtagPosts[0], ...hashtagPosts[1], ...engagementPosts[0], ...engagementPosts[1]];

        // Remove duplicates by post ID
        const uniquePosts = allPosts.reduce((acc, post) => {
            const id = post._id.toString();
            if (!acc[id]) {
                acc[id] = post;
            }
            return acc;
        }, {});

        // Map posts to a uniform structure with postType
        const trendingPosts = Object.values(uniquePosts).map((post) => {
            let posterDetails = {};
            let postType = "unknown";

            if (post.adminId) {
                postType = "admin"; // Assign postType as "admin"
                posterDetails = {
                    name: post.adminId.sugFullName,
                    profilePicture: post.schoolInfoId?.uniProfilePicture || null,
                };
            } else if (post.user) {
                postType = "student"; // Assign postType as "student"
                posterDetails = {
                    name: post.user.fullName,
                    profilePicture: post.user.profilePhoto || null,
                    department: post.user.studentInfo?.department || "N/A",
                    faculty: post.user.studentInfo?.faculty || "N/A",
                };
            }

            return {
                postId: post._id,
                text: post.text,
                images: post.images,
                createdAt: post.createdAt,
                likes: post.likes?.length || 0,
                comments: post.comments?.length || 0,
                postType, // Include postType
                poster: posterDetails,
            };
        });

        // Sort posts by creation date in descending order
        trendingPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.status(200).json({
            message: "Trending posts fetched successfully",
            trendingPosts,
        });
    } catch (error) {
        console.error("Error fetching trending posts:", error);
        res.status(500).json({ message: "Error fetching trending posts", error });
    }
};




const extractHashtags = (text) => {
    if (typeof text !== "string") return [];
    const hashtagRegex = /#\w+/g;
    return text.match(hashtagRegex) || []; 
};


module.exports = { getTrendingPosts, extractHashtags };
