const EventPayment = require("../models/eventpymt");
const EventTransaction = require("../models/eventTransaction");
const SchoolInfo = require("../models/schoolInfo");
const Student = require("../models/studentRegNo"); 
const mongoose = require("mongoose");




const recordEventTransaction = async (eventId, senderAccountNumber, reference, amount, SchoolStudent) => {
  try {
    // Find the event payment record
    const eventPayment = await EventPayment.findOne({
      eventId: new mongoose.Types.ObjectId(eventId),
      senderAccountNumber: senderAccountNumber.trim(),
    });

    if (!eventPayment) {
      throw new Error("EventPayment record not found for this event and sender.");
    }

    // Prevent duplicate recording first (before any other operations)
    const existingTransaction = await EventTransaction.findOne({ reference });
    if (existingTransaction) {
      console.log("Duplicate event transaction, skipping");
      return existingTransaction;
    }

    // Get the school info to determine which student collection to use
    const schoolInfo = await SchoolInfo.findById(eventPayment.schoolInfoId);
    if (!schoolInfo) {
      throw new Error("SchoolInfo not found for eventPayment.");
    }

    
    const student = await SchoolStudent.findById(eventPayment.studentId);
    if (!student) {
      throw new Error("Student not found in school-specific collection for this EventPayment.");
    }

    // Create the event transaction
    const eventTransaction = new EventTransaction({
      transactionId: eventPayment._id,
      studentId: eventPayment.studentId,
      eventId: eventPayment.eventId,
      amountPaid: amount,
      reference,
      paymentStatus: "completed",
      schoolName: schoolInfo.university, 
      createdAt: new Date()
    });

    await eventTransaction.save();

  
    const updatedEventPayment = await EventPayment.findByIdAndUpdate(
      eventPayment._id,
      { 
        $push: { transactions: eventTransaction._id },
        $set: { 
          paymentStatus: "completed",
          amountPaid: amount,
          reference: reference,
          updatedAt: new Date()
        }
      },
      { new: true, runValidators: true }
    );

    if (!updatedEventPayment) {
      throw new Error("Failed to update EventPayment");
    }

    // Update the school-specific student collection
    const updatedStudent = await SchoolStudent.findByIdAndUpdate(
      student._id,
      { $push: { transactions: eventTransaction._id } },
      { new: true, runValidators: true }
    );

    if (!updatedStudent) {
      throw new Error("Failed to update student in school collection");
    }

    console.log(` Event transaction recorded successfully for event: ${eventId}`);
    console.log(` EventPayment updated - transactions count: ${updatedEventPayment.transactions.length}`);
    console.log(` Student updated in ${SchoolStudent.collection.name} - transactions count: ${updatedStudent.transactions.length}`);
    console.log(` Transaction ID: ${eventTransaction._id}`);
    
    return eventTransaction;

  } catch (error) {
    console.error("Error in recordEventTransaction:", error);
    throw error;
  }
};




module.exports = {recordEventTransaction};
