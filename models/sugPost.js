
const mongoose = require("mongoose");

const sugPostSchema = new mongoose.Schema({
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SugUser", 
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
    comments: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Comment'  
    }],
    likes: [
        {
            _id: { type: mongoose.Schema.Types.ObjectId, ref: "SugUser" },
            fullName: String
        }
    ],
    commentsCount: { 
        type: Number, 
        default: 0 
    },
    schoolInfoId: {  
        type: mongoose.Schema.Types.ObjectId,
        ref: "SchoolInfo",
        required: true
    }
});



module.exports = mongoose.model("SugPost", sugPostSchema);

