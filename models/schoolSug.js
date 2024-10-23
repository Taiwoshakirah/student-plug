const mongoose = require('mongoose')
const bcrypt = require('bcrypt')

const schoolSugSchema = new mongoose.Schema({
    sugFullName:{
        type: String,
        require: true
    },
    email:{
        type: String,
        required: true,
        match: [/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/, "Please provide an email"],
        unique: true,
    },
    phoneNumber:{
        type: String,
    },
    password:{
        type: String
    },
    agreedToTerms: { 
        type: Boolean, 
        required: true 
      },
})

schoolSugSchema.pre("save", async function (next) {
    if (!this.isModified("password")) {
      return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next()
  });

module.exports = mongoose.model('SugUser',schoolSugSchema)