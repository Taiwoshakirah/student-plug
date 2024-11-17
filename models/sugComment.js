// const mongoose = require("mongoose");
// const SugPostCommentSchema = new mongoose.Schema({
//     post: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "SugPost",  
//       required: true,
//     },
//     text: {
//       type: String,
//       required: true,
//     },
//     user: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",  
//       required: true,
//     },
//     isAdmin: {
//       type: Boolean,
//       default: false,
//     },
//     parentComment: { type: mongoose.Schema.Types.ObjectId, ref: 'SugPostComment', default: null },  
//     replies: [{ 
//     type: mongoose.Schema.Types.ObjectId, 
//     ref: 'SugPostComment' 
//   }],
//     createdAt: {
//       type: Date,
//       default: Date.now,
//     },
//   });
  
//   const SugPostComment = mongoose.model("SugPostComment", SugPostCommentSchema);
//   module.exports = SugPostComment;
  




// // // const mongoose = require("mongoose");
// // const Roles = require("../middlewares/role"); // Adjust the path according to your project structure


// // const sugPostCommentSchema = new mongoose.Schema({
// //     postId: { type: mongoose.Schema.Types.ObjectId, ref: "SugPost", required: true },
// //     userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // This can be a user or an admin
// //     isAdmin: { type: Boolean, default: false }, // New field to indicate if the commenter is an admin
// //     text: { type: String, required: true },
// //     role: { type: String, enum: [Roles.ADMIN, Roles.USER], default: Roles.USER },
// //     createdAt: { type: Date, default: Date.now },
// // });

// // module.exports = mongoose.model("SugPostComment", sugPostCommentSchema);
