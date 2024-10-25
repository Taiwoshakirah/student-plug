const mongoose = require("mongoose");

const FacultySchema = new mongoose.Schema({
  facultyName: { 
    type: String, 
    required: true 
},
 
createdAt: {
    type: Date,
    default: Date.now
}
});

module.exports = mongoose.model("Faculty", FacultySchema);
