const EventPayment = require("../models/eventpymt");
const EventTransaction = require("../models/eventTransaction");
const Student = require("../models/studentRegNo"); // Ensure this is imported
const mongoose = require("mongoose");

const recordEventTransaction = async (eventId, senderAccountNumber, reference, amount) => {
  const eventPayment = await EventPayment.findOne({
    eventId: new mongoose.Types.ObjectId(eventId),
    senderAccountNumber: senderAccountNumber.trim(),
  });

  if (!eventPayment) {
    throw new Error("EventPayment record not found for student.");
  }

  // Find the associated student
  const student = await Student.findById(eventPayment.studentId);
  if (!student) {
    throw new Error("Student not found for this EventPayment.");
  }

  // Prevent duplicate recording
  const existingTransaction = await EventTransaction.findOne({ reference });
  if (existingTransaction) {
    console.log("Duplicate transaction, skipping");
    return;
  }

  // Update payment record
  eventPayment.paymentStatus = "completed";
  eventPayment.amountPaid = amount;

  const eventTransaction = new EventTransaction({
    transactionId: eventPayment._id,
    studentId: eventPayment.studentId,
    eventId: eventPayment.eventId,
    amountPaid: amount,
    reference,
    paymentStatus: "completed",
  });

  await eventTransaction.save();

  // Link to both EventPayment and Student
  eventPayment.transactions.push(eventTransaction._id);
  eventPayment.reference = reference;
  await eventPayment.save();

  student.transactions.push(eventTransaction._id); // link to student too
  await student.save();

  console.log("Event transaction recorded successfully.");
  return eventTransaction;
};





module.exports = {recordEventTransaction};
