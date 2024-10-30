// models/Post.js
const mongoose = require("mongoose");

const sugPostSchema = new mongoose.Schema({
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SugUser", // Reference to admin users (SUG admins)
        required: true,
      },
      text: { 
        type: String, 
        required: true },
      images: [
        String
      ], 
         
      createdAt: { 
        type: Date, 
        default: Date.now 
    },
      likes: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User" 
    }],
    });
module.exports = mongoose.model("SugPost", sugPostSchema);
