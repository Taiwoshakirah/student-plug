const mongoose = require("mongoose");

const CommentSchema = new mongoose.Schema({
    post: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "SugPost",  
        required: true 
    },
    text: { 
        type: String, 
        required: true 
    },
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User" 
    }, 
    admin: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "SugUser" 
    }, 
    isAdmin: { 
        type: Boolean, 
        default: false 
    }, 
    parentComment: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Comment", 
        default: null 
    }, 
    replies: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Comment" 
    }],
    createdAt: { 
        type: Date, 
        default: Date.now 
    },
});

module.exports = mongoose.model("Comment", CommentSchema);
