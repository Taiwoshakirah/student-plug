const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Schema = mongoose.Schema;

const schoolSugSchema = new mongoose.Schema({
    sugFullName: {
        type: String,
        required: true,  // Fixed typo from "require" to "required"
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
        required: true,  // Ensure password is required
    },
    agreedToTerms: { 
        type: Boolean, 
        required: true, 
    },
    role: {  // Add a dedicated field for the role
        type: String,
        enum: ["user", "admin"], // Specify allowed roles
        default: "user", // Default role
    },

    faculties: [
        { type: Schema.Types.ObjectId, ref: 'Faculty' }  // References Faculty IDs
      ],
      schoolInfo: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolInfo' },
    resetPasswordCode: {
        type: String,
        required: false, // Optional if you want to reset
    },
    resetPasswordExpires: {
        type: Date,
        required: false, // Optional
    },
   
  
});

// Hash password before saving
schoolSugSchema.pre("save", async function (next) {
    if (!this.isModified("password")) {
        return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});



module.exports = mongoose.model('SugUser', schoolSugSchema);
