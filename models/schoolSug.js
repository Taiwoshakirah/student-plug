const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Schema = mongoose.Schema;

const schoolSugSchema = new mongoose.Schema({
    sugFullName: {
        type: String,
        required: true,  
    },
    email: {
        type: String,
        required: true,
        match: [/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/, "Please provide a valid email"],
        unique: true,
    },
    phoneNumber: {
        type: String,
    },
    password: {
        type: String,
        required: true,  
    },
    agreedToTerms: { 
        type: Boolean, 
        required: true, 
    },
    role: {  
        type: String,
        enum: ["user", "admin"], 
        default: "user", 
    },

    faculties: [
        { type: Schema.Types.ObjectId, ref: 'Faculty' }  
      ],
      schoolInfo: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolInfo' },
    resetPasswordCode: {
        type: String,
        required: false, 
    },
    resetPasswordExpires: {
        type: Date,
        required: false, 
    },
   
  
});


schoolSugSchema.pre("save", async function (next) {
    if (!this.isModified("password")) {
        return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});



module.exports = mongoose.model('SugUser', schoolSugSchema);
