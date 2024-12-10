const mongoose = require("mongoose");

const StudentSchema = new mongoose.Schema({
  registrationNumber: { type: String, required: true, unique: true },
  faculty: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty' },
  schoolInfo: { type: mongoose.Schema.Types.ObjectId, ref: "SchoolInfo" },
  transactions: [{ type: mongoose.Schema.Types.ObjectId, ref: "Transaction" }], // Add this field
  
});

module.exports = mongoose.model("Student", StudentSchema);
