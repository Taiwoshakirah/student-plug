const mongoose = require('mongoose');

const eventPaymentSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student', // Reference to the Student model
    required: true,
  },
  amountPaid: {
    type: Number,
    required: true,
  },
  registrationNumber: { // Add the registration number field
    type: String,
    required: true,
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending',
  },
  transactionId: {
    type: String,
  },
  paymentDate: {
    type: Date,
    default: Date.now,
  },
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event', // Reference to the Event model
    required: true,
  },
});

const Payment = mongoose.model('EventPayment', eventPaymentSchema);
module.exports = Payment;
