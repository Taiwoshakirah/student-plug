const mongoose = require("mongoose");
const SugPost = require("../models/sugPost");
const UserPost = require("../models/post");
const Comment = require("../models/allComment");

const getTrendingPosts = async (req, res) => {
    try {
        const { schoolInfoId } = req.query; // Assume schoolInfoId is passed as a query parameter
        if (!schoolInfoId) {
            return res.status(400).json({ message: "schoolInfoId is required" });
        }

        const past24Hours = new Date();
        past24Hours.setDate(past24Hours.getDate() - 1);

        const calculateTrendingPosts = async (PostModel) => {
            return await PostModel.aggregate([
                {
                    $match: {
                        schoolInfoId: new mongoose.Types.ObjectId(schoolInfoId), // Filter by school
                        createdAt: { $gte: past24Hours }, // Only posts in the last 24 hours
                    },
                },
                {
                    $addFields: {
                        likesCount: { $size: "$likes" }, // Number of likes
                        commentsCount: { $size: "$comments" }, // Number of comments
                        hashtagsCount: { $cond: { if: "$hashtags", then: { $size: "$hashtags" }, else: 0 } }, // Hashtags count
                        trendingScore: {
                            $add: [
                                { $multiply: [{ $size: "$likes" }, 1] }, // Weight for likes
                                { $multiply: [{ $size: "$comments" }, 2] }, // Weight for comments
                                { $multiply: ["$hashtagsCount", 1] }, // Weight for hashtags
                            ],
                        },
                    },
                },
                {
                    $sort: { trendingScore: -1 }, // Sort by trending score descending
                },
                {
                    $limit: 10, // Top 10 posts
                },
            ]);
        };

        // Fetch trending posts for both SugPosts and UserPosts
        const [trendingSugPosts, trendingUserPosts] = await Promise.all([
            calculateTrendingPosts(SugPost),
            calculateTrendingPosts(UserPost),
        ]);

        // Merge results and sort by trendingScore
        const allTrendingPosts = [...trendingSugPosts, ...trendingUserPosts].sort(
            (a, b) => b.trendingScore - a.trendingScore
        );

        res.status(200).json({
            message: "Trending posts fetched successfully",
            posts: allTrendingPosts,
        });
    } catch (error) {
        console.error("Error fetching trending posts:", error);
        res.status(500).json({ message: "Internal server error", error });
    }
};




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
    const hashtagRegex = /#\w+/g;
    return text.match(hashtagRegex) || []; 
};


module.exports = { getTrendingPosts, extractHashtags };
