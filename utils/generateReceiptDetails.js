


const FidelityNotification = require("../models/fidelityWehook");
const Transaction = require("../models/transaction");
const StudentPayment = require("../models/studentPayment");
const SchoolInfo = require("../models/schoolInfo"); 
const mongoose = require("mongoose");
const studentSchema = require("../models/studentRegNo").schema;

const getSchoolStudentModel = (universityName) => {
  const collectionName = `students_${universityName.toLowerCase().replace(/\s+/g, "_")}`;
  return mongoose.models[collectionName] || mongoose.model(collectionName, studentSchema, collectionName);
};
const generateReceiptDetails = async (transaction_ref) => {
  try {
    // Find the transaction
    const transaction = await Transaction.findOne({ reference: transaction_ref });
    if (!transaction) throw new Error("Transaction not found.");

    const {
      email,
      amount,
      feeType,
      reference,
      createdAt,
      student: studentId,
      studentPayment: studentPaymentId 
    } = transaction;

    // Method 1: If you have studentPayment reference in transaction (recommended)
    let studentPayment;
    if (studentPaymentId) {
      studentPayment = await StudentPayment.findById(studentPaymentId);
    } else {
      // Method 2: Find StudentPayment by looking for the transaction reference
      studentPayment = await StudentPayment.findOne({ 
        transactions: studentId,
        reference: reference 
      });
    }

    if (!studentPayment) throw new Error("StudentPayment record not found.");

    const {
      regNo,
      department,
      academicLevel,
      firstName,
      lastName,
      schoolInfoId
    } = studentPayment;

    // Get school info to determine which student collection to use
    const schoolInfo = await SchoolInfo.findById(schoolInfoId);
    if (!schoolInfo) throw new Error("School information not found.");

    // Get the school-specific student model
    const SchoolStudent = getSchoolStudentModel(schoolInfo.university);
    
    // Find the student in the correct school collection
    const schoolStudent = await SchoolStudent.findById(studentId);
    if (!schoolStudent) {
      throw new Error(`Student record not found in ${schoolInfo.university} collection.`);
    }

    // Generate receipt details
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

    console.log(` Receipt generated for student in ${SchoolStudent.collection.name}`);

    return {
      paymentStatus: "success",
      amount,
      reference,
      regNo,
      fullName,
      department,
      academicLevel,
      schoolName: schoolInfo.university, 
      date,
      time,
      feeType, 
    };
    
  } catch (error) {
    console.error("Error generating receipt:", error.message);
    return null;
  }
};

// Alternative version if you want to make it more explicit by passing schoolName
const generateReceiptDetailsWithSchool = async (transaction_ref, schoolName = null) => {
  try {
    const transaction = await Transaction.findOne({ reference: transaction_ref });
    if (!transaction) throw new Error("Transaction not found.");

    const {
      email,
      amount,
      feeType,
      reference,
      createdAt,
      student: studentId,
      schoolName: transactionSchoolName 
    } = transaction;

    // Use provided schoolName or get from transaction
    const actualSchoolName = schoolName || transactionSchoolName;
    
    if (!actualSchoolName) {
      // Fallback: find via StudentPayment
      const studentPayment = await StudentPayment.findOne({ reference: reference });
      if (!studentPayment) throw new Error("StudentPayment record not found.");
      
      const schoolInfo = await SchoolInfo.findById(studentPayment.schoolInfoId);
      if (!schoolInfo) throw new Error("School information not found.");
      
      actualSchoolName = schoolInfo.university;
    }

    // Get the school-specific student model
    const SchoolStudent = getSchoolStudentModel(actualSchoolName);
    
    // Find the student in the correct school collection
    const schoolStudent = await SchoolStudent.findById(studentId);
    if (!schoolStudent) {
      throw new Error(`Student record not found in ${actualSchoolName} collection.`);
    }

    // Find StudentPayment for additional details
    const studentPayment = await StudentPayment.findOne({ 
      regNo: schoolStudent.registrationNumber 
    });
    if (!studentPayment) throw new Error("StudentPayment record not found.");

    const fullName = `${studentPayment.firstName} ${studentPayment.lastName}`;
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
      regNo: schoolStudent.registrationNumber,
      fullName,
      department: studentPayment.department,
      academicLevel: studentPayment.academicLevel,
      schoolName: actualSchoolName,
      date,
      time,
      feeType,
    };
    
  } catch (error) {
    console.error("Error generating receipt:", error.message);
    return null;
  }
};

module.exports = {
  generateReceiptDetails,
  generateReceiptDetailsWithSchool
};