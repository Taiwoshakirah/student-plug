const mongoose = require("mongoose");

const webHookNotificationSchema = new mongoose.Schema({ 
  webhookHash: {
    type: String,
    required: true
  }
}, {
}, { timestamps: true });

module.exports = mongoose.model("WebHookNotification", webHookNotificationSchema);
