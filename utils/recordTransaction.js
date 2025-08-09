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
      studentModel: SchoolStudent.modelName, 
      schoolName: SchoolStudent.collection.name.replace('students_', ''), 
      studentPayment: studentPayment._id, 
    });

    await transaction.save();


    // Update StudentPayment using findByIdAndUpdate with $push
    const updatedStudentPayment = await StudentPayment.findByIdAndUpdate(
      studentPayment._id,
      { 
        $push: { transactions: transaction._id },
        $set: { reference: reference }
      },
      { new: true, runValidators: true }
    );

    if (!updatedStudentPayment) {
      throw new Error("Failed to update StudentPayment");
    }

    // Update the school-specific student collection
    const updatedStudent = await SchoolStudent.findByIdAndUpdate(
      student._id,
      { $push: { transactions: transaction._id } },
      { new: true, runValidators: true }
    );

    if (!updatedStudent) {
      throw new Error("Failed to update student in school collection");
    }

    console.log(` StudentPayment updated - transactions count: ${updatedStudentPayment.transactions.length}`);
    console.log(` Student updated - transactions count: ${updatedStudent.transactions.length}`);

    console.log("Transaction recorded successfully.");
    console.log(`Updated student in collection: ${SchoolStudent.collection.name}`);
    console.log(`Transaction ID added: ${transaction._id}`);
    
    return transaction;
  } catch (error) {
    console.error("Error in recordTransaction:", error);
    throw error;
  }
};







module.exports = { recordTransaction };