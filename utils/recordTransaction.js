const StudentPayment = require("../models/studentPayment");
const Student = require('../models/studentRegNo')
const Transaction = require('../models/transaction')
const FidelityNotification = require('../models/fidelityWehook')


const crypto = require("crypto");

const generatePaymentReference = () => {
  return "TXN-" + crypto.randomBytes(4).toString("hex").toUpperCase();  
}

/**
 * Record a transaction once payment is received.
 * Links Student via regNo and stores data in Transaction collection.
 * 
 * @param {string} senderAccountNumber
  */
const recordTransaction = async (senderAccountNumber, reference, SchoolStudent) => {
  try {
    const notification = await FidelityNotification.findOne({ senderAccountNumber, reference });
    if (!notification) {
      throw new Error("Fidelity notification not found.");
    }

    const { amount } = notification;
    const status = "successful";

    const studentPayment = await StudentPayment.findOne({
      senderAccountNumber
    });
    if (!studentPayment) {
      throw new Error("StudentPayment not found.");
    }

    const { email, feeType, regNo } = studentPayment;

    // Use the passed SchoolStudent model (school-specific)
    const student = await SchoolStudent.findOne({ registrationNumber: regNo });
    if (!student) {
      throw new Error(`Student with regNo ${regNo} not found in school-specific collection.`);
    }

    // Check if transaction already exists
    let transaction = await Transaction.findOne({ reference });
    if (transaction) {
      console.log("Transaction already recorded, skipping duplicate.");
      return transaction;
    }

    // Create new transaction with proper references
    transaction = new Transaction({
      email,
      amount,
      feeType,
      reference,
      status,
      student: student._id,
      studentModel: SchoolStudent.modelName, // This will be like 'students_ikoyi'
      schoolName: SchoolStudent.collection.name.replace('students_', ''), // Extract school name
      studentPayment: studentPayment._id, // Reference to the payment record
    });

    await transaction.save();

    // Update both StudentPayment and the school-specific Student with transaction ID
    // Method 1: Mark the array as modified (most reliable)
    studentPayment.transactions.push(transaction._id);
    studentPayment.markModified('transactions'); // This ensures Mongoose knows the array changed
    student.transactions.push(transaction._id);
    student.markModified('transactions');
    studentPayment.reference = reference;

    // Save both documents
    await studentPayment.save();
    await student.save();

    // Alternative Method 2: Use findByIdAndUpdate (more reliable for arrays)
    // await StudentPayment.findByIdAndUpdate(
    //   studentPayment._id,
    //   { 
    //     $push: { transactions: transaction._id },
    //     $set: { reference: reference }
    //   },
    //   { new: true }
    // );
    
    // await SchoolStudent.findByIdAndUpdate(
    //   student._id,
    //   { $push: { transactions: transaction._id } },
    //   { new: true }
    // );

    console.log("Transaction recorded successfully.");
    console.log(`Updated student in collection: ${SchoolStudent.collection.name}`);
    console.log(`StudentPayment transactions before update: ${studentPayment.transactions.length}`);
    console.log(`StudentPayment transactions after update: ${studentPayment.transactions.length}`);
    console.log(`Student transactions after update: ${student.transactions.length}`);
    console.log(`Transaction ID added: ${transaction._id}`);
    
    return transaction;
  } catch (error) {
    console.error("Error in recordTransaction:", error);
    throw error;
  }
};

// const recordTransaction = async (senderAccountNumber, reference, SchoolStudent) => {
//   const notification = await FidelityNotification.findOne({ senderAccountNumber, reference });
//   if (!notification) throw new Error("Fidelity notification not found.");

//   const { amount } = notification;
//   const status = "successful";

//   const studentPayment = await StudentPayment.findOne({ senderAccountNumber });
//   if (!studentPayment) throw new Error("StudentPayment not found.");

//   const { email, feeType, regNo } = studentPayment;

//   const student = await SchoolStudent.findOne({ registrationNumber: regNo });
//   if (!student) throw new Error("Student not found.");

//   let transaction = await Transaction.findOne({ reference });
//   if (transaction) {
//     console.log("Transaction already recorded.");
//     return transaction;
//   }

//   transaction = new Transaction({
//     email,
//     amount,
//     feeType,
//     reference,
//     status,
//     student: student._id,
//   });
//   await transaction.save();

//   // Safely update using $addToSet
//   const [spUpdate, stdUpdate] = await Promise.all([
//     StudentPayment.updateOne(
//       { _id: studentPayment._id },
//       {
//         $addToSet: { transactions: transaction._id },
//         $set: { reference },
//       }
//     ),
//     SchoolStudent.updateOne(
//       { _id: student._id },
//       {
//         $addToSet: { transactions: transaction._id },
//       }
//     ),
//   ]);

//   console.log("✅ Updates:", { spUpdate, stdUpdate });
//   return transaction;
// };





module.exports = { recordTransaction };