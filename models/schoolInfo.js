const mongoose = require("mongoose");

const schoolInfoSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "sugUser",
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

});

module.exports = mongoose.model("schoolInfo", schoolInfoSchema);
