const mongoose = require("mongoose");

const studentInfoSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  university: {
    type: String,
    required: true,
  },
  course: {
    type: String,
    required: true,
  },
  department: {
    type: String,
    required: true,
  },
  level: {
    type: String,
    required: true,
  },
  yearOfAdmission: {
    type: Date,
    required: true,
  },
  yearOfGraduation: {
    type: Date,
    required: true,
  },
});

module.exports = mongoose.model("StudentInfo", studentInfoSchema);
