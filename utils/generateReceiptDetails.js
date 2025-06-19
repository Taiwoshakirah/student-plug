const FidelityNotification = require("../models/fidelityWehook")
const StudentPayment = require("../models/studentPayment");

const generateReceiptDetails = async (senderAccountNumber) => {
  try {
    const notification = await FidelityNotification.findOne({ senderAccountNumber });
    if (!notification) throw new Error("Notification not found.");

    const { amount, accountName } = notification;

    const studentPayment = await StudentPayment.findOne({ senderAccountNumber });
    if (!studentPayment) throw new Error("Student payment record not found.");

    const { regNo, department, academicYear } = studentPayment;

    const now = new Date();
    const date = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const time = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

    const reference = Date.now();

    return {
      paymentStatus: "success",
      amount,
      accountName,
      regNo,
      department,
      academicYear,
      date,
      time,
      reference,
    };
  } catch (error) {
    console.error("Error generating receipt:", error.message);
    return null;
  }
};

module.exports = generateReceiptDetails;
