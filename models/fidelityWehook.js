const mongoose = require("mongoose")
const FidelityNotificationSchema = new mongoose.Schema({
  amount: { type: String, required: true },
  narration: { type: String },
  accountNumber: { type: String, required: true },
  accountName: { type: String },
  senderAccountNumber: { type: String, required: true },
  senderAccountName: { type: String },
  senderBank: { type: String },
  reference: { type: String, required: true },
  transactionType: { type: String },
  status: { type: String },
  provider: { type: String },
  customerRef: { type: String },
  customerEmail: { type: String },
  transactionDesc: { type: String },
  webhookRaw: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });
module.exports = mongoose.model("FidelityNotification", FidelityNotificationSchema)