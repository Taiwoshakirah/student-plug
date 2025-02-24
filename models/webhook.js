// const mongoose = require("mongoose");

// const WebHookNotificationSchema = new mongoose.Schema({
//   webhookHash: { type: String, required: true },
//   virtualAccount: {
//     creationTime: { type: Date, required: true },
//     expirationTime: { type: Date },
//     amount: { type: Number, required: true },
//     accountNumber: { type: String, required: true },
//     name: { type: String, required: true },
//     type: { type: String, required: true, enum: ["credit", "debit"] }
//   }
// }, { timestamps: true });

// module.exports = mongoose.model("WebHookNotification", WebHookNotificationSchema);

const mongoose = require("mongoose");

const WebHookNotificationSchema = new mongoose.Schema({
    amount: { type: String, required: true },
    accountNumber: { type: String, required: true },
    type: { type: String, enum: ["STATIC", "DYNAMIC"], required: true },
    senderAccountNumber: { type: String, required: true },
    senderAccountName: { type: String, required: true },
    senderBank: { type: String, required: true },
    time: { type: String, required: true },
    reference: { type: String, unique: true, required: true },
    webhookHash: { type: String },
}, { timestamps: true });



module.exports = mongoose.model("WebHookNotification", WebHookNotificationSchema);

