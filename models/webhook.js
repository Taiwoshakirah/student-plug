const mongoose = require("mongoose");


const WebHookNotificationSchema = new mongoose.Schema({
  amount: { type: String, required: true },
  accountNumber: { type: String, required: true },
  type: { type: String, enum: ["STATIC", "DYNAMIC"], required: true }, 
  senderAccountNumber: { type: String, required: true },
  senderAccountName: { type: String, required: true },
  senderBank: { type: String, required: true },
  time: { type: String, required: true },
  reference: { type: String, required: true }, 
  webhookHash: { type: String },
  eventId: { type: String, unique: true, required: true }, 
  eventType: { type: String, required: true } 
}, { timestamps: true });



module.exports = mongoose.model("WebHookNotification", WebHookNotificationSchema);

