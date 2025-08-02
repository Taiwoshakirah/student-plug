const EventTransaction = require("../models/eventTransaction");
const EventPayment = require("../models/eventpymt");
const Student = require('../models/studentRegNo');

const generateEventReceiptDetails = async (transaction_ref) => {
  try {
    //  Find the transaction
    const transaction = await EventTransaction.findOne({ reference: transaction_ref });
    if (!transaction) throw new Error("Transaction not found.");

    const {
      reference,
      amountPaid,
      paymentDate,
      studentId
    } = transaction;

    //  Find the Student record
    const student = await Student.findById(studentId);
    if (!student) throw new Error("Student record not found.");

    //  Find the EventPayment record using registrationNumber
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

