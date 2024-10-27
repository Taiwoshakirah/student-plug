const mongoose = require("mongoose");

const FacultySchema = new mongoose.Schema({
  facultyName: { 
    type: String, 
    required: true 
},
university: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
createdAt: {
    type: Date,
    default: Date.now
}
});

module.exports = mongoose.model("Faculty", FacultySchema);
