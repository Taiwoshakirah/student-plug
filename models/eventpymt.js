const mongoose = require("mongoose");

const eventPaymentSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student",
    required: true,
  },
  registrationNumber: {
    type: String,
    required: true,
  },
  paymentStatus: {
    type: String,
    enum: ["pending", "completed", "failed"],
    default: "pending",
  },
  transactionId: String,
  paymentDate: {
    type: Date,
    default: Date.now,
  },
  amountPaid: { type: Number, default: 0 },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  department: { type: String, required: true },
  academicLevel: { type: String, required: true },
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
    required: true,
  },
  email: { type: String, required: true },
  // Use only ObjectId references to EventTransaction here
  transactions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "EventTransaction", 
  }],
  studentInfoId: { type: mongoose.Schema.Types.ObjectId, ref: "StudentInfo" },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Add userId here
  feeType: { type: String, required: true },
  feeAmount:Number,
    schoolInfoId:{type: mongoose.Schema.Types.ObjectId, ref: "SchoolInfo", required: true},
    virtualAccounts: {
  fcmb: {
    accountNumber: String,
    accountName: String,
    bankName: String,
  },
  fidelity: {
    accountNumber: String,
    accountName: String,
    bankName: String,
  },
},
  senderAccountNumber:{type:Number, required:true},
  reference: { type: String },



});

module.exports = mongoose.model("EventPayment", eventPaymentSchema);
