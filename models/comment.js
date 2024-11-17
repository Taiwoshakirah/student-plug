// const mongoose = require('mongoose');

// const userCommentSchema = new mongoose.Schema({
//     user: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'User',
//         required: true,
//     },
//     post: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'UserPost',
//         required: true,
//     },
//     text: {
//         type: String,
//         required: true,
//     },
//     parentComment: { type: mongoose.Schema.Types.ObjectId, ref: 'UserComment', default: null }, 
//     replies: [{ 
//         type: mongoose.Schema.Types.ObjectId, 
//         ref: 'UserComment' 
//     }],
//     createdAt: {
//         type: Date,
//         default: Date.now,
//     },
// });

// module.exports = mongoose.model('UserComment', userCommentSchema);
