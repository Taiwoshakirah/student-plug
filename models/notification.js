const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },  
  postId: { type: mongoose.Schema.Types.ObjectId, required: true },  
  title: { type: String, required: true },  
  body: { type: String, required: true },  
  read: { type: Boolean, default: false },  
  likerPhoto: { type: String, required: false }, 
  likerName: { type: String, required: false },  
  createdAt: { type: Date, default: Date.now },  
  type: { type: String, required: true, enum: ['like', 'comment'] }, 
  commentId: { type: mongoose.Schema.Types.ObjectId, required: false },  
});

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = { Notification };

