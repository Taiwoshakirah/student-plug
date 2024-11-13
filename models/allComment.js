const SugPostCommentSchema = new mongoose.Schema({
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SugPost",  // Reference to the Post model
    required: true,
  },
  text: {
    type: String,
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",  // Reference to the User model
    required: true,
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
  parentComment: { type: mongoose.Schema.Types.ObjectId, ref: 'SugPostComment', default: null }, // For nested comments
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const SugPostComment = mongoose.model("SugPostComment", SugPostCommentSchema);
module.exports = SugPostComment;
