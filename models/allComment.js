const mongoose = require("mongoose");

const CommentSchema = new mongoose.Schema({
    post: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "SugPost",  // Reference to the post being commented on
        required: true 
    },
    text: { 
        type: String, 
        required: true 
    },
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User" 
    }, // Regular user reference
    admin: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "SugUser" 
    }, // Admin reference
    isAdmin: { 
        type: Boolean, 
        default: false 
    }, // Flag to indicate if the commenter is an admin
    parentComment: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Comment", 
        default: null 
    }, // Parent comment for nested replies
    replies: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Comment" 
    }], // Array of replies
    createdAt: { 
        type: Date, 
        default: Date.now 
    },
});

module.exports = mongoose.model("Comment", CommentSchema);
