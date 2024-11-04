const mongoose = require("mongoose");

const schoolInfoSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SugUser", // Ensure this matches the model name
    required: true,
  },
  university: {
    type: String,
    required: true,
  },
  state: {
    type: String,
    required: true,
  },
  aboutUniversity: {
    type: String,
    required: true,
  },
  uniProfilePicture: {
    type: String,
    required: true,
  },
  faculties: [{ type: mongoose.Schema.Types.ObjectId, ref: "Faculty" }], 
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }]
});

module.exports = mongoose.model("SchoolInfo", schoolInfoSchema);
