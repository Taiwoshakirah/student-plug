

const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    email: { type: String, required: true },
    amount: { type: Number, required: true },
    feeType: { type: String, required: true },
    reference: { type: String, required: true, unique: true },
    status: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    
    student: { type: mongoose.Schema.Types.ObjectId, required: true },
    studentModel: { 
        type: String, 
        required: true,
    },
    
    schoolName: { type: String, required: true },
    
    studentPayment: { type: mongoose.Schema.Types.ObjectId, ref: "StudentPayment" }
});

transactionSchema.virtual('studentData', {
    ref: function(doc) { return doc.studentModel; },
    localField: 'student',
    foreignField: '_id',
    justOne: true
});

transactionSchema.set('toJSON', { virtuals: true });
transactionSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Transaction', transactionSchema);