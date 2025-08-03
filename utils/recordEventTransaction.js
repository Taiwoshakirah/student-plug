const EventPayment = require("../models/eventpymt");
const EventTransaction = require("../models/eventTransaction");
const Student = require("../models/studentRegNo"); 
const mongoose = require("mongoose");

// const recordEventTransaction = async (eventId, senderAccountNumber, reference, amount) => {
//   const eventPayment = await EventPayment.findOne({
//     eventId: new mongoose.Types.ObjectId(eventId),
//     senderAccountNumber: senderAccountNumber.trim(),
//   });

//   if (!eventPayment) {
//     throw new Error("EventPayment record not found for student.");
//   }

//   // Find the associated student
//   const student = await SchoolStudent.findById(eventPayment.studentId);
//   if (!student) {
//     throw new Error("Student not found for this EventPayment.");
//   }

//   // Prevent duplicate recording
//   const existingTransaction = await EventTransaction.findOne({ reference });
//   if (existingTransaction) {
//     console.log("Duplicate transaction, skipping");
//     return;
//   }

//   // Update payment record
//   eventPayment.paymentStatus = "completed";
//   eventPayment.amountPaid = amount;

//   const eventTransaction = new EventTransaction({
//     transactionId: eventPayment._id,
//     studentId: eventPayment.studentId,
//     eventId: eventPayment.eventId,
//     amountPaid: amount,
//     reference,
//     paymentStatus: "completed",
//   });

//   await eventTransaction.save();

//   // Link to both EventPayment and Student
//   eventPayment.transactions.push(eventTransaction._id);
//   eventPayment.reference = reference;
//   await eventPayment.save();

//   student.transactions.push(eventTransaction._id); // link to student too
//   await student.save();

//   console.log("Event transaction recorded successfully.");
//   return eventTransaction;
// };


const recordEventTransaction = async (eventId, senderAccountNumber, reference, amount) => {
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

    // Get the school-specific student model
    const SchoolStudent = getSchoolStudentModel(schoolInfo.university);
    
    // Find the associated student in the correct school collection
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
      schoolName: schoolInfo.university, // Add school info for tracking
      createdAt: new Date()
    });

    await eventTransaction.save();

    // Use database-level updates for reliability (same approach as StudentPayment)
    
    // Update EventPayment record
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

    console.log(`✅ Event transaction recorded successfully for event: ${eventId}`);
    console.log(`✅ EventPayment updated - transactions count: ${updatedEventPayment.transactions.length}`);
    console.log(`✅ Student updated in ${SchoolStudent.collection.name} - transactions count: ${updatedStudent.transactions.length}`);
    console.log(`✅ Transaction ID: ${eventTransaction._id}`);
    
    return eventTransaction;

  } catch (error) {
    console.error("Error in recordEventTransaction:", error);
    throw error;
  }
};




module.exports = {recordEventTransaction};
