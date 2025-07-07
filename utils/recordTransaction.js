const StudentPayment = require("../models/studentPayment");
const Student = require('../models/studentRegNo')
const Transaction = require('../models/transaction')
const FidelityNotification = require('../models/fidelityWehook')


const crypto = require("crypto");

const generatePaymentReference = () => {
  return "TXN-" + crypto.randomBytes(4).toString("hex").toUpperCase();  // e.g. TXN-A1B2C3D4
}

/**
 * Record a transaction once payment is received.
 * Links Student via regNo and stores data in Transaction collection.
 * 
 * @param {string} senderAccountNumber
 */
const recordTransaction = async (senderAccountNumber, reference) => {
  const notification = await FidelityNotification.findOne({ senderAccountNumber, reference });
  if (!notification) {
    throw new Error("Fidelity notification not found.");
  }

  const { amount } = notification;
  const status = "successful";

  const studentPayment = await StudentPayment.findOne({ 
    senderAccountNumber,
    status: 'pending'
  });
  if (!studentPayment) {
    throw new Error("StudentPayment not found.");
  }

  const { email, feeType, regNo } = studentPayment;

  const student = await Student.findOne({ registrationNumber: regNo });
  if (!student) {
    throw new Error("Student not found.");
  }

  const transaction = new Transaction({
    email,
    amount,
    feeType,
    reference,
    status,
    student: student._id,
  });

  await transaction.save();
  studentPayment.transactions.push(transaction._id);
  student.transactions.push(transaction._id);
  studentPayment.status = 'paid';
  studentPayment.reference = reference;

  await studentPayment.save();
  await student.save();

  console.log("Transaction recorded successfully.");
  return transaction;
};


module.exports = { recordTransaction };