
// const EventTransaction = require("../models/eventTransaction");
// const EventPayment = require("../models/eventpymt");
// const Student = require('../models/studentRegNo')


// const generateEventReceiptDetails = async (transaction_ref) => {
//   try {
//     // 1️⃣ Find the transaction
//     const transaction = await EventTransaction.findOne({ reference: transaction_ref });
//     if (!transaction) throw new Error("Transaction not found.");

//     const {
//       email,
//       amount,
//       feeType,
//       reference,
//       createdAt,
//       studentId 
//     } = transaction;

//     // 2️⃣ Find the Student record
//     const student = await Student.findById(studentId);
//     if (!student) throw new Error("Student record not found.");

//     // 3️⃣ Find the EventPayment record using registrationNumber
//     const eventPayment = await EventPayment.findOne({ registrationNumber: student.registrationNumber });
//     if (!eventPayment) throw new Error("EventPayment record not found.");

//     const {
//       regNo,
//       department,
//       academicLevel,
//       firstName,
//       lastName
//     } = studentPayment;

//     const fullName = `${firstName} ${lastName}`;
//     const date = createdAt.toLocaleDateString("en-GB", {
//       day: "2-digit",
//       month: "short",
//       year: "numeric",
//     });
//     const time = createdAt.toLocaleTimeString("en-GB", {
//       hour: "2-digit",
//       minute: "2-digit",
//     });

//     return {
//       paymentStatus: "success",
//       amount,
//       reference,
//       regNo,
//       fullName,
//       department,
//       academicLevel,
//       date,
//       time,
//     };
//   } catch (error) {
//     console.error("Error generating receipt:", error.message);
//     return null;
//   }
// };






// module.exports = generateEventReceiptDetails;
const EventTransaction = require("../models/eventTransaction");
const EventPayment = require("../models/eventpymt");
const Student = require('../models/studentRegNo');

const generateEventReceiptDetails = async (transaction_ref) => {
  try {
    // 1️⃣ Find the transaction
    const transaction = await EventTransaction.findOne({ reference: transaction_ref });
    if (!transaction) throw new Error("Transaction not found.");

    const {
      reference,
      amountPaid,
      paymentDate,
      studentId
    } = transaction;

    // 2️⃣ Find the Student record
    const student = await Student.findById(studentId);
    if (!student) throw new Error("Student record not found.");

    // 3️⃣ Find the EventPayment record using registrationNumber
    const eventPayment = await EventPayment.findOne({ registrationNumber: student.registrationNumber });
    if (!eventPayment) throw new Error("EventPayment record not found.");

    const {
      department,
      academicLevel,
      firstName,
      lastName
    } = eventPayment;

    const fullName = `${firstName} ${lastName}`;
    const date = paymentDate.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const time = paymentDate.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });

    return {
      paymentStatus: "success",
      amount: amountPaid,
      reference,
      regNo: student.registrationNumber,
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

module.exports = generateEventReceiptDetails;

