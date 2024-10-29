// const mongoose = require('mongoose');

// const postSchema = new mongoose.Schema({
//   user: { 
//     type: mongoose.Schema.Types.ObjectId, 
//     ref: 'User', 
//     required: true 
// },

//   text: { 
//     type: String, 
//     required: true 
// },

//   image: { 
//     type: String 
// }, // URL for the image, if any
//   likes: [{ 
//     type: mongoose.Schema.Types.ObjectId, 
//     ref: 'User' 
// }],
//   likeCount: { 
//     type: Number, 
//     default: 0 
// }, // Track the number of likes
//   comments: [{ 
//     type: mongoose.Schema.Types.ObjectId, 
//     ref: 'Comment' 
// }],
//   shares: [{ 
//     type: mongoose.Schema.Types.ObjectId, 
//     ref: 'User' 
// }],
//   createdAt: { 
//     type: Date, 
//     default: Date.now 
// }
// });

// module.exports = mongoose.model('Post', postSchema);
