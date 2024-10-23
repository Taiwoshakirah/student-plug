const mongoose = require("mongoose");

const StudentSchema = new mongoose.Schema({
  registrationNumber: { type: String, required: true, unique: true },
  faculty: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty' },
});

module.exports = mongoose.model("Student", StudentSchema);
