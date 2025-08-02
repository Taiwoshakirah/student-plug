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
// const recordTransaction = async (senderAccountNumber, reference, SchoolStudent) => {
//   const notification = await FidelityNotification.findOne({ senderAccountNumber, reference });
//   if (!notification) {
//     throw new Error("Fidelity notification not found.");
//   }

//   const { amount } = notification;
//   const status = "successful";

//   const studentPayment = await StudentPayment.findOne({ 
//     senderAccountNumber
//   });
//   if (!studentPayment) {
//     throw new Error("StudentPayment not found.");
//   }

//   const { email, feeType, regNo } = studentPayment;

//   const student = await SchoolStudent.findOne({ registrationNumber: regNo });
//   if (!student) {
//     throw new Error("Student not found.");
//   }

//   let transaction = await Transaction.findOne({ reference });
//   if (transaction) {
//     console.log("Transaction already recorded, skipping duplicate.");
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
//   studentPayment.transactions.push(transaction._id);
//   student.transactions.push(transaction._id);
//   // studentPayment.status = 'paid';
//   studentPayment.reference = reference;

//   await studentPayment.save();
//   await student.save();

//   console.log("Transaction recorded successfully.");
//   return transaction;
// };

const recordTransaction = async (senderAccountNumber, reference, SchoolStudent) => {
  const notification = await FidelityNotification.findOne({ senderAccountNumber, reference });
  if (!notification) throw new Error("Fidelity notification not found.");

  const { amount } = notification;
  const status = "successful";

  const studentPayment = await StudentPayment.findOne({ senderAccountNumber });
  if (!studentPayment) throw new Error("StudentPayment not found.");

  const { email, feeType, regNo } = studentPayment;

  const student = await SchoolStudent.findOne({ registrationNumber: regNo });
  if (!student) throw new Error("Student not found.");

  // Check for existing transaction
  let transaction = await Transaction.findOne({ reference });
  if (transaction) {
    console.log("Transaction already recorded, skipping duplicate.");
    return transaction;
  }

  // Create new transaction
  transaction = new Transaction({
    email,
    amount,
    feeType,
    reference,
    status,
    student: student._id,
  });

  await transaction.save();

  // Push transaction ID to both records
  studentPayment.transactions = studentPayment.transactions || [];
  student.transactions = student.transactions || [];

  studentPayment.transactions.push(transaction._id);
  studentPayment.markModified("transactions");

  student.transactions.push(transaction._id);
  student.markModified("transactions");

  studentPayment.reference = reference;

  try {
    await studentPayment.save();
  } catch (err) {
    console.error("❌ Failed to save studentPayment:", err);
  }

  try {
    await student.save();
  } catch (err) {
    console.error("❌ Failed to save student:", err);
  }

  console.log("✅ Transaction recorded and linked successfully.");
  return transaction;
};



module.exports = { recordTransaction };