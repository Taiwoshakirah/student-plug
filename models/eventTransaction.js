const mongoose = require("mongoose");

const eventTransactionSchema = new mongoose.Schema({
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "EventPayment",
    required: true,
  },
  reference: {
    type: String,
    required: true,  
  },
  amountPaid: {
    type: Number,
    required: true,
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending',
  },
   
  paymentDate: {
    type: Date,
    required: true,
    default: Date.now,
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
  },
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
  },
});

module.exports = mongoose.model('EventTransaction', eventTransactionSchema);
