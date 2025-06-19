const mongoose = require("mongoose");



// const transactionSchema = new mongoose.Schema({
//     userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
//     transactionId: { type: String, required: true, unique: true },
//     accountNumber: { type: String, required: true },
//     amount: { type: Number, required: true },
//     status: { type: String, enum: ["pending", "successful", "failed"], required: true },
//     timestamp: { type: Date, default: Date.now }
//   });
  



const transactionSchema = new mongoose.Schema({
    email: { type: String, required: true },
    amount: { type: Number, required: true },
    feeType: { type: String, required: true },
    reference: { type: String, required: true },
    status: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "StudentPayment" }, // Link student
});



module.exports = mongoose.model("Transaction", transactionSchema);
