const StudentPayment = require("../models/studentPayment");
const Student = require('../models/studentRegNo')
const Transaction = require('../models/transaction')
const FidelityNotification = require('../models/fidelityWehook')
/**
 * Record a transaction once payment is received.
 * Links Student via regNo and stores data in Transaction collection.
 * @param {string} senderAccountNumber
 */
const recordTransaction = async (senderAccountNumber, regNo) => {
  try {
    // Get payment notification details
    const notification = await FidelityNotification.findOne({ senderAccountNumber });
    if (!notification) {
      throw new Error("Fidelity notification not found.");
    }

    const { amount, reference } = notification;
    const status = "successful"; // or notification.status if available

    // Get student payment info
    const studentPayment = await StudentPayment.findOne({ 
  $or: [
    { senderAccountNumber, regNo },
    { regNo }
  ]
});


    // const studentPayment = await StudentPayment.findOne({ senderAccountNumber, regNo  });

    // const studentPayment = await StudentPayment.findOne({ senderAccountNumber });
    if (!studentPayment) {
      throw new Error("StudentPayment not found.");
    }

    const { email, feeType } = studentPayment;

    // Get the actual Student by regNo
    const student = await Student.findOne({ registrationNumber: regNo });
    if (!student) {
      throw new Error("Student not found.");
    }

    // Create new transaction record
    const transaction = new Transaction({
      email,
      amount,
      feeType,
      reference,
      status,
      student: student._id,
    });

    await transaction.save();
    // Push transaction ID into studentPayment.transaction array
    studentPayment.transactions.push(transaction._id);
    student.transactions.push(transaction._id)
    await studentPayment.save();
    await student.save();
    
    console.log("Transaction recorded successfully.");
    return transaction;

  } catch (error) {
    console.error("Error recording transaction:", error.message);
    throw error;
  }
};

module.exports = { recordTransaction };