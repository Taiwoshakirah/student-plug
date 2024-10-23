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
});

module.exports = mongoose.model("Faculty", FacultySchema);
