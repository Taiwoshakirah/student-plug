const mongoose = require("mongoose");


const sugPostCommentSchema = new mongoose.Schema({
    postId: { type: mongoose.Schema.Types.ObjectId, ref: "Post", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    
  });
  
  module.exports = mongoose.model("SugPostComment", sugPostCommentSchema);