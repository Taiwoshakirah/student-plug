// SugPost Schema
const mongoose = require("mongoose");

const sugPostSchema = new mongoose.Schema({
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SugUser", // Reference to admin users
        required: true,
    },
    text: { 
        type: String, 
        required: true 
    },
    images: [
        String
    ],
    createdAt: { 
        type: Date, 
        default: Date.now 
    },
    likes: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "SugUser" // Ensure this references the correct user model
    }],
    commentsCount: { 
        type: Number, 
        default: 0 
    }
});

// Virtual for comments
sugPostSchema.virtual("comments", {
    ref: "SugPostComment", // Reference to the comments collection
    localField: "_id", // The field in the SugPost model
    foreignField: "postId" // The field in the SugPostComment model
});

// Ensure virtuals are included when converting documents to JSON or Objects
sugPostSchema.set("toJSON", { virtuals: true });
sugPostSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("SugPost", sugPostSchema);

