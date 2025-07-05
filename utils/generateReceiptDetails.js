// const FidelityNotification = require("../models/fidelityWehook")
// const StudentPayment = require("../models/studentPayment");

// const generateReceiptDetails = async (senderAccountNumber) => {
//   try {
//     const notification = await FidelityNotification.findOne({ senderAccountNumber });
//     if (!notification) throw new Error("Notification not found.");

//     const { amount, accountName } = notification;

//     const studentPayment = await StudentPayment.findOne({ senderAccountNumber });
//     if (!studentPayment) throw new Error("Student payment record not found.");

//     const { regNo, department, academicYear } = studentPayment;

//     const now = new Date();
//     const date = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
//     const time = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

//     const reference = Date.now();

//     return {
//       paymentStatus: "success",
//       amount,
//       accountName,
//       regNo,
//       department,
//       academicYear,
//       date,
//       time,
//       reference,
//     };
//   } catch (error) {
//     console.error("Error generating receipt:", error.message);
//     return null;
//   }
// };

// module.exports = generateReceiptDetails;
const FidelityNotification = require("../models/fidelityWehook")

const Transaction = require("../models/transaction");
const StudentPayment = require("../models/studentPayment");
const Student = require('../models/studentRegNo')


const generateReceiptDetails = async (transaction_ref) => {
  try {
    // 1️⃣ Find the transaction
    const transaction = await Transaction.findOne({ reference: transaction_ref });
    if (!transaction) throw new Error("Transaction not found.");

    const {
      email,
      amount,
      feeType,
      reference,
      createdAt,
      student: studentId
    } = transaction;

    // 2️⃣ Find the Student record
    const student = await Student.findById(studentId);
    if (!student) throw new Error("Student record not found.");

    // 3️⃣ Find the StudentPayment record using regNo
    const studentPayment = await StudentPayment.findOne({ regNo: student.registrationNumber });
    if (!studentPayment) throw new Error("StudentPayment record not found.");

    const {
      regNo,
      department,
      academicLevel,
      firstName,
      lastName
    } = studentPayment;

    const fullName = `${firstName} ${lastName}`;
    const date = createdAt.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const time = createdAt.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });

    return {
      paymentStatus: "success",
      amount,
      reference,
      regNo,
      fullName,
      department,
      academicLevel,
      date,
      time,
    };
  } catch (error) {
    console.error("Error generating receipt:", error.message);
    return null;
  }
};






module.exports = generateReceiptDetails;

