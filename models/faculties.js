const mongoose = require("mongoose");

const FacultySchema = new mongoose.Schema({
  facultyName: { 
    type: String, 
    required: true 
},
  schoolId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'schoolInfo', 
    required: true 
},
createdAt: {
    type: Date,
    default: Date.now
}
});

module.exports = mongoose.model("Faculty", FacultySchema);
