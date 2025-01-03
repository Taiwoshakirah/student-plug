// const mongoose = require('mongoose');

// const notificationSchema = new mongoose.Schema({
//   userId: { type: mongoose.Schema.Types.ObjectId, required: true },
//   postId: { type: mongoose.Schema.Types.ObjectId, required: true },
//   title: { type: String, required: true },
//   body: { type: String, required: true },
//   read: { type: Boolean, default: false }, // If the notification has been read
//   likerPhoto: { type: String, required: false }, // Add this field
//   likerName: { type: String, required: false },
//   createdAt: { type: Date, default: Date.now },
// });

// const Notification = mongoose.model('Notification', notificationSchema);

// module.exports = { Notification };

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },  // User receiving the notification
  postId: { type: mongoose.Schema.Types.ObjectId, required: true },  // The post associated with the notification
  title: { type: String, required: true },  // Title of the notification
  body: { type: String, required: true },  // Body of the notification
  read: { type: Boolean, default: false },  // If the notification has been read
  likerPhoto: { type: String, required: false },  // Photo of the liker (if applicable)
  likerName: { type: String, required: false },  // Name of the liker (if applicable)
  createdAt: { type: Date, default: Date.now },  // Timestamp of when the notification was created
  type: { type: String, required: true, enum: ['like', 'comment'] },  // Type of notification (like or comment)
  commentId: { type: mongoose.Schema.Types.ObjectId, required: false },  // Reference to the comment (for comment notifications)
});

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = { Notification };

