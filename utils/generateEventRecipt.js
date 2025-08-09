const EventTransaction = require("../models/eventTransaction");
const EventPayment = require("../models/eventpymt");
const SchoolInfo = require("../models/schoolInfo");
const mongoose = require("mongoose");
const studentSchema = require("../models/studentRegNo").schema;

// Remove: const Student = require('../models/studentRegNo') - No longer needed

const getSchoolStudentModel = (universityName) => {
  const collectionName = `students_${universityName.toLowerCase().replace(/\s+/g, "_")}`;
  return mongoose.models[collectionName] || mongoose.model(collectionName, studentSchema, collectionName);
};

const generateEventReceiptDetails = async (transaction_ref) => {
  try {
    // Find the transaction
    const transaction = await EventTransaction.findOne({ reference: transaction_ref });
    if (!transaction) throw new Error("Event transaction not found.");

    const {
      reference,
      amountPaid,
      paymentDate,
      createdAt,
      studentId,
      eventId
    } = transaction;

    // Method 1: Find EventPayment using studentId (if you have this relationship)
    let eventPayment = await EventPayment.findOne({ studentId: studentId });
    
    if (!eventPayment) {
      // Method 2: Find EventPayment using eventId and then match studentId
      eventPayment = await EventPayment.findOne({ 
        eventId: eventId,
        studentId: studentId 
      });
    }

    if (!eventPayment) throw new Error("EventPayment record not found.");

    const {
      department,
      academicLevel,
      firstName,
      lastName,
      registrationNumber,
      schoolInfoId,
      feeType
    } = eventPayment;

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

    // Use paymentDate if available, otherwise use createdAt
    const dateToUse = paymentDate || createdAt;
    
    const fullName = `${firstName} ${lastName}`;
    const date = dateToUse.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const time = dateToUse.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });

    console.log(`✅ Event receipt generated for student in ${SchoolStudent.collection.name}`);

    return {
      paymentStatus: "success",
      amount: amountPaid,
      reference,
      regNo: registrationNumber || schoolStudent.registrationNumber, 
      fullName,
      department,
      academicLevel,
      schoolName: schoolInfo.university,
      feeType: feeType || "Event Registration", 
      date,
      time,
    };
    
  } catch (error) {
    console.error("Error generating event receipt:", error.message);
    return null;
  }
};

// Alternative version if you want to optimize by passing school name
const generateEventReceiptDetailsWithSchool = async (transaction_ref, schoolName = null) => {
  try {
    const transaction = await EventTransaction.findOne({ reference: transaction_ref });
    if (!transaction) throw new Error("Event transaction not found.");

    const {
      reference,
      amountPaid,
      paymentDate,
      createdAt,
      studentId,
      schoolName: transactionSchoolName 
    } = transaction;

    // Use provided schoolName or get from transaction
    const actualSchoolName = schoolName || transactionSchoolName;
    
    if (!actualSchoolName) {
      // Fallback: find via EventPayment
      const eventPayment = await EventPayment.findOne({ studentId: studentId });
      if (!eventPayment) throw new Error("EventPayment record not found.");
      
      const schoolInfo = await SchoolInfo.findById(eventPayment.schoolInfoId);
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

    // Find EventPayment for additional details
    const eventPayment = await EventPayment.findOne({ 
      registrationNumber: schoolStudent.registrationNumber 
    });
    if (!eventPayment) throw new Error("EventPayment record not found.");

    const dateToUse = paymentDate || createdAt;
    const fullName = `${eventPayment.firstName} ${eventPayment.lastName}`;
    const date = dateToUse.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const time = dateToUse.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });

    return {
      paymentStatus: "success",
      amount: amountPaid,
      reference,
      regNo: schoolStudent.registrationNumber,
      fullName,
      department: eventPayment.department,
      academicLevel: eventPayment.academicLevel,
      schoolName: actualSchoolName,
      feeType: eventPayment.feeType || "Event Registration",
      date,
      time,
    };
    
  } catch (error) {
    console.error("Error generating event receipt:", error.message);
    return null;
  }
};

module.exports = generateEventReceiptDetails;

module.exports.generateEventReceiptDetailsWithSchool = generateEventReceiptDetailsWithSchool;