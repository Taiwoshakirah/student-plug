const mongoose = require("mongoose");

const StudentSchema = new mongoose.Schema({
  registrationNumber: { type: String, required: true, unique: true },
  faculty: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty' },
  schoolInfo: { type: mongoose.Schema.Types.ObjectId, ref: "SchoolInfo" }
});

module.exports = mongoose.model("Student", StudentSchema);
