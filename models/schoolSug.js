const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

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
    // schoolInfoId: {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: 'schoolInfo',
    //     required: true,  // Reference to the associated school
    // },
    // selectedFaculties: [{
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: 'Faculty',  // Reference to the selected faculties
    // }],
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
