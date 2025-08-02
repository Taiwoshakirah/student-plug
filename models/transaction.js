// const mongoose = require("mongoose");


// const transactionSchema = new mongoose.Schema({
//     email: { type: String, required: true },
//     amount: { type: Number, required: true },
//     feeType: { type: String, required: true },
//     reference: { type: String, required: true, unique: true },
//     status: { type: String, required: true },
//     createdAt: { type: Date, default: Date.now },
//     student: { type: mongoose.Schema.Types.ObjectId, ref: "StudentPayment" }, 
// });



// module.exports = mongoose.model("Transaction", transactionSchema);

const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    email: { type: String, required: true },
    amount: { type: Number, required: true },
    feeType: { type: String, required: true },
    reference: { type: String, required: true, unique: true },
    status: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    
    // Option 1: Dynamic reference using refPath
    student: { type: mongoose.Schema.Types.ObjectId, required: true },
    studentModel: { 
        type: String, 
        required: true,
        // This will contain the model name like 'students_ikoyi', 'students_harvard', etc.
    },
    
    // Alternative: You could also add school information directly
    schoolName: { type: String, required: true },
    
    // Keep reference to StudentPayment for payment info
    studentPayment: { type: mongoose.Schema.Types.ObjectId, ref: "StudentPayment" }
});

// Add a virtual for dynamic population
transactionSchema.virtual('studentData', {
    ref: function(doc) { return doc.studentModel; }, // Dynamic reference
    localField: 'student',
    foreignField: '_id',
    justOne: true
});

// Ensure virtual fields are serialized
transactionSchema.set('toJSON', { virtuals: true });
transactionSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Transaction', transactionSchema);