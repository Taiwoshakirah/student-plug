const mongoose = require('mongoose');

const userPostSchema = new mongoose.Schema({
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    text: { 
        type: String, 
        required: true 
    },
    images: [String],
    likes: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    }],
    likeCount: { 
        type: Number, 
        default: 0 
    },
    comments: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Comment'  
    }],
    shares: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    }],
    schoolInfoId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'SchoolInfo', 
        required: true 
    }, 
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

module.exports = mongoose.models.UserPost || mongoose.model('UserPost', userPostSchema);
