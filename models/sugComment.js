const mongoose = require("mongoose");
const Roles = require("../middlewares/role"); // Adjust the path according to your project structure


const sugPostCommentSchema = new mongoose.Schema({
    postId: { type: mongoose.Schema.Types.ObjectId, ref: "SugPost", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // This can be a user or an admin
    isAdmin: { type: Boolean, default: false }, // New field to indicate if the commenter is an admin
    text: { type: String, required: true },
    role: { type: String, enum: [Roles.ADMIN, Roles.USER], default: Roles.USER },
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("SugPostComment", sugPostCommentSchema);
