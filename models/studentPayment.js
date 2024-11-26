// models/Student.js
const mongoose = require("mongoose");

const studentPymtSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    department: { type: String, required: true },
    regNo: { type: String, required: true, unique: true },
    academicLevel: { type: String, required: true },
    email: { type: String, required: true, unique: true }, 
}, { timestamps: true });

module.exports = mongoose.model("StudentPayment", studentPymtSchema);
