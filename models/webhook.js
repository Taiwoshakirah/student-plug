const mongoose = require("mongoose");

const webHookNotificationSchema = new mongoose.Schema({
  clientId: String,
  subscriptionKey: String,
  xToken: String,
  utcTimestamp: String,
  payload: mongoose.Schema.Types.Mixed, 
}, { timestamps: true });

module.exports = mongoose.model("WebHookNotification", webHookNotificationSchema);
