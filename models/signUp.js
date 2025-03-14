const bcrypt = require('bcrypt')
const mongoose = require("mongoose");

const userSchema =new mongoose.Schema({
  fullName: {
    type: String,
    require: true,
  },
  email: {
    type: String,
    required: true,
    match: [/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/, "Please provide an email"],
    unique: true,
  },
  phoneNumber: {
    type: String,
  },
  password: {
    type: String,
    required: function () {
      return !this.googleId
  }
},
  agreedToTerms: { 
    type: Boolean, 
    required: true 
  },
  profilePhoto: { 
    type: String, 
    default: null
  },

  googleId: { 
    type: String, 
    unique: true,
    sparse: true
   }, 

  resetPasswordCode: { 
    type: String 
  },
  resetPasswordExpires: { 
    type: Date 
  },
  schoolInfoId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "SchoolInfo" 
  },
  studentInfo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "StudentInfo" 
  },
  // fcmToken: { type: String, default: null },

  
});

userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) {
      return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next()
  });



module.exports = mongoose.model("User", userSchema);
