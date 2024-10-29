const SugPost = require('../models/sugPost')
const SugPostComment = require('../models/sugComment')

const createSugPost = async (req, res) => {
    const { adminId, text, image } = req.body;
  if (!adminId || !text) {
    return res.status(400).json({ message: "Admin ID and text are required" });
  }
  
  try {
    const post = new SugPost({ adminId, text, image });
    await post.save();
    res.status(201).json({ message: "Post created", post });
  } catch (error) {
    res.status(500).json({ message: "Error creating post", error });
  }
};

const toggleLike = async (req, res) => {
    const { postId } = req.params;
    const { userId } = req.body;
  
    try {
      const post = await SugPost.findById(postId);
      if (!post) return res.status(404).json({ message: "Post not found" });
  
      // Add or remove like
      if (post.likes.includes(userId)) {
        post.likes = post.likes.filter((id) => id.toString() !== userId);
      } else {
        post.likes.push(userId);
      }
  
      await post.save();
      res.json({ message: "Post liked/unliked", likes: post.likes.length });
    } catch (error) {
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

const fetchPostDetails =async (req,res)=>{
    try {
        const posts = await SugPost.find()
          .populate("adminId", "sugFullName email") // Populate admin details
          .populate("likes", "fullName") // Populate user names who liked the post
          .lean(); // Convert Mongoose documents to plain JavaScript objects
    
        for (const post of posts) {
          // Count comments and attach to the post
          post.comments = await SugPostComment.find({ postId: post._id })
            .populate("userId", "fullName") // Populate user details for comments
            .lean();
          
          post.commentsCount = post.comments.length; // Total number of comments
          post.likesCount = post.likes.length; // Total number of likes
        }
    
        res.json({ posts });
      } catch (error) {
        res.status(500).json({ message: "Error fetching posts", error });
      }
}


module.exports = {createSugPost,toggleLike,addComment,fetchPostDetails}