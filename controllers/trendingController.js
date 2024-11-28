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
        const now = moment().tz(timezone);  // Get current time in the specified timezone

        const startOfToday = now.clone().startOf('day');  // Get the start of today
        const endOfToday = now.clone().endOf('day');  // Get the end of today

        // Log the start and end of today for debugging
        console.log('Start of today:', startOfToday.toISOString());  // Log the start of today
        console.log('End of today:', endOfToday.toISOString());      // Log the end of today

        // Calculate 7 days ago
        const sevenDaysAgo = now.clone().subtract(7, 'days');  // 7 days ago

        console.log('Seven days ago:', sevenDaysAgo.toISOString());  // Log the start of the 7-day window

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

        // Fetch posts with high engagement (likes or comments)
        const engagementPosts = await Promise.all([
            SugPost.find({ ...query, $or: [{ "likes.0": { $exists: true } }, { "comments.0": { $exists: true } }] })
                .populate("adminId", "sugFullName email")
                .populate("schoolInfoId", "uniProfilePicture")
                .exec(),
            UserPost.find({ ...query, $or: [{ "likes.0": { $exists: true } }, { "comments.0": { $exists: true } }] })
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

        // Combine all posts
        const allPosts = [...hashtagPosts[0], ...hashtagPosts[1], ...engagementPosts[0], ...engagementPosts[1]];

        console.log('All posts fetched:', allPosts.length);  // Log how many posts were fetched

        // Remove duplicates by post ID
        const uniquePosts = allPosts.reduce((acc, post) => {
            const id = post._id.toString();
            if (!acc[id]) {
                acc[id] = post;
            }
            return acc;
        }, {});

        // Log unique posts
        console.log('Unique posts:', Object.keys(uniquePosts).length);

        // Map posts to a uniform structure
        const trendingPosts = Object.values(uniquePosts).map((post) => {
            let posterDetails = {};

            if (post.adminId) {
                posterDetails = {
                    name: post.adminId.sugFullName,
                    profilePicture: post.schoolInfoId?.uniProfilePicture || null,
                };
            } else if (post.user) {
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









// const getTrendingPosts = async (req, res) => {
//     try {
//         const { schoolInfoId } = req.query; // Assume schoolInfoId is passed as a query parameter
//         if (!schoolInfoId) {
//             return res.status(400).json({ message: "schoolInfoId is required" });
//         }

//         const past24Hours = new Date();
//         past24Hours.setDate(past24Hours.getDate() - 1);

//         const calculateTrendingPosts = async (PostModel) => {
//             return await PostModel.aggregate([
//                 {
//                     $match: {
//                         schoolInfoId: new mongoose.Types.ObjectId(schoolInfoId), // Filter by school
//                         createdAt: { $gte: past24Hours }, // Only posts in the last 24 hours
//                     },
//                 },
//                 {
//                     $addFields: {
//                         likesCount: { $size: "$likes" }, // Number of likes
//                         commentsCount: { $size: "$comments" }, // Number of comments
//                         hashtagsCount: { $cond: { if: "$hashtags", then: { $size: "$hashtags" }, else: 0 } }, // Hashtags count
//                         trendingScore: {
//                             $add: [
//                                 { $multiply: [{ $size: "$likes" }, 1] }, // Weight for likes
//                                 { $multiply: [{ $size: "$comments" }, 2] }, // Weight for comments
//                                 { $multiply: ["$hashtagsCount", 1] }, // Weight for hashtags
//                             ],
//                         },
//                     },
//                 },
//                 {
//                     $sort: { trendingScore: -1 }, // Sort by trending score descending
//                 },
//                 {
//                     $limit: 10, // Top 10 posts
//                 },
//             ]);
//         };

//         // Fetch trending posts for both SugPosts and UserPosts
//         const [trendingSugPosts, trendingUserPosts] = await Promise.all([
//             calculateTrendingPosts(SugPost),
//             calculateTrendingPosts(UserPost),
//         ]);

//         // Merge results and sort by trendingScore
//         const allTrendingPosts = [...trendingSugPosts, ...trendingUserPosts].sort(
//             (a, b) => b.trendingScore - a.trendingScore
//         );

//         res.status(200).json({
//             message: "Trending posts fetched successfully",
//             posts: allTrendingPosts,
//         });
//     } catch (error) {
//         console.error("Error fetching trending posts:", error);
//         res.status(500).json({ message: "Internal server error", error });
//     }
// };













// const getTrendingPosts = async (req, res) => {
//     try {
//         const { schoolInfoId } = req.query;
//         if (!schoolInfoId || !mongoose.Types.ObjectId.isValid(schoolInfoId)) {
//             return res.status(400).json({ message: "Valid schoolInfoId is required" });
//         }

//         const past24Hours = new Date();
//         past24Hours.setDate(past24Hours.getDate() - 1);

//         const calculateTrendingPosts = async (PostModel) => {
//             return await PostModel.aggregate([
//                 {
//                     $match: {
//                         schoolInfoId: new mongoose.Types.ObjectId(schoolInfoId),
//                         createdAt: { $gte: past24Hours },
//                     },
//                 },
//                 {
//                     $addFields: {
//                         likesCount: { $size: "$likes" },
//                         commentsCount: { $size: "$comments" },
//                         hashtagsCount: { $cond: { if: "$hashtags", then: { $size: "$hashtags" }, else: 0 } },
//                         trendingScore: {
//                             $add: [
//                                 { $multiply: [{ $size: "$likes" }, 1] },
//                                 { $multiply: [{ $size: "$comments" }, 2] },
//                                 { $multiply: ["$hashtagsCount", 1] },
//                             ],
//                         },
//                     },
//                 },
//                 {
//                     $match: { trendingScore: { $gte: 5 } },
//                 },
//                 { $sort: { trendingScore: -1 } },
//                 { $limit: 10 },
//             ]);
//         };

//         const [trendingSugPosts, trendingUserPosts] = await Promise.all([
//             calculateTrendingPosts(SugPost),
//             calculateTrendingPosts(UserPost),
//         ]);

//         const allTrendingPosts = [...trendingSugPosts, ...trendingUserPosts].sort(
//             (a, b) => (b.trendingScore || 0) - (a.trendingScore || 0)
//         );

//         const fetchPosterDetails = async (post, isAdmin) => {
//             try {
//                 const postDetails = await (isAdmin
//                     ? SugPost.findById(post._id)
//                           .populate([
//                               {
//                                   path: "adminId",
//                                   model: "SugUser",
//                                   select: "sugFullName profilePicture role",
//                                   populate: { path: "schoolInfo", model: "SchoolInfo", select: "university" },
//                               },
//                           ])
//                           .lean()
//                     : UserPost.findById(post._id)
//                           .populate([
//                               {
//                                   path: "user",
//                                   model: "User",
//                                   select: "fullName profilePhoto email",
//                                   populate: [
//                                       { path: "studentInfo", model: "StudentInfo", select: "faculty department" },
//                                       { path: "schoolInfoId", model: "SchoolInfo", select: "university" },
//                                   ],
//                               },
//                           ])
//                           .lean());

//                 if (!postDetails) throw new Error("Post details not found");

//                 const user = isAdmin ? postDetails.adminId : postDetails.user;
//                 if (!user) throw new Error("User not found");

//                 const poster = {
//                     name: user.sugFullName || user.fullName || "Unknown",
//                     profilePicture: user.profilePicture || user.profilePhoto || "",
//                     department: user.studentInfo?.department || "Unknown",
//                     faculty: user.studentInfo?.faculty || "Unknown",
//                 };

//                 return { ...post, poster };
//             } catch (err) {
//                 console.error(`Error fetching poster details for post ${post._id}:`, err);
//                 return post;
//             }
//         };

//         const allTrendingPostsWithDetails = await Promise.all(
//             allTrendingPosts.map((post) =>
//                 fetchPosterDetails(post, post.schoolInfoId.toString() === schoolInfoId)
//             )
//         );

//         res.status(200).json({
//             message: "Trending posts fetched successfully",
//             posts: allTrendingPostsWithDetails,
//         });
//     } catch (error) {
//         console.error("Error fetching trending posts:", error);
//         res.status(500).json({ message: "Internal server error", error });
//     }
// };







// const getTrendingPosts = async (req, res) => {
//     try {
//         const { schoolInfoId } = req.query; // Assume schoolInfoId is passed as a query parameter
//         if (!schoolInfoId) {
//             return res.status(400).json({ message: "schoolInfoId is required" });
//         }

//         const past24Hours = new Date();
//         past24Hours.setDate(past24Hours.getDate() - 1);

//         const calculateTrendingPosts = async (PostModel) => {
//             return await PostModel.aggregate([
//                 {
//                     $match: {
//                         schoolInfoId: new mongoose.Types.ObjectId(schoolInfoId), // Filter by school
//                         createdAt: { $gte: past24Hours }, // Only posts in the last 24 hours
//                     },
//                 },
//                 {
//                     $addFields: {
//                         likesCount: { $size: "$likes" }, // Number of likes
//                         commentsCount: { $size: "$comments" }, // Number of comments
//                         hashtagsCount: { $cond: { if: "$hashtags", then: { $size: "$hashtags" }, else: 0 } }, // Hashtags count
//                         trendingScore: {
//                             $add: [
//                                 { $multiply: [{ $size: "$likes" }, 1] }, // Weight for likes
//                                 { $multiply: [{ $size: "$comments" }, 2] }, // Weight for comments
//                                 { $multiply: ["$hashtagsCount", 1] }, // Weight for hashtags
//                             ],
//                         },
//                     },
//                 },
//                 {
//                     $sort: { trendingScore: -1 }, // Sort by trending score descending
//                 },
//                 {
//                     $limit: 10, // Top 10 posts
//                 },
//             ]);
//         };

//         // Fetch trending posts for both SugPosts and UserPosts
//         const [trendingSugPosts, trendingUserPosts] = await Promise.all([
//             calculateTrendingPosts(SugPost),
//             calculateTrendingPosts(UserPost),
//         ]);

//         // Merge results and sort by trendingScore
//         const allTrendingPosts = [...trendingSugPosts, ...trendingUserPosts].sort(
//             (a, b) => b.trendingScore - a.trendingScore
//         );

//         res.status(200).json({
//             message: "Trending posts fetched successfully",
//             posts: allTrendingPosts,
            
//         });
//     } catch (error) {
//         console.error("Error fetching trending posts:", error);
//         res.status(500).json({ message: "Internal server error", error });
//     }
// };




// const getTrendingPosts = async (req, res) => {
//     try {
//         const trendingPosts = await Promise.all([
//             SugPost.find({ trending: true }).populate("schoolInfoId adminId"),
//             UserPost.find({ trending: true }).populate("schoolInfoId user"),
//         ]);
//         res.status(200).json({ trendingPosts });
//     } catch (error) {
//         console.error("Error fetching trending posts:", error);
//         res.status(500).json({ message: "Error fetching trending posts", error });
//     }
// };

const extractHashtags = (text) => {
    if (typeof text !== "string") return [];
    const hashtagRegex = /#\w+/g;
    return text.match(hashtagRegex) || []; 
};


module.exports = { getTrendingPosts, extractHashtags };
