// routes/student.js
const express = require('express')
const StudentPayment = require("../models/studentPayment");
const Student = require('../models/studentRegNo')
const axios = require("axios");
require("dotenv").config();
const Transaction = require('../models/transaction')
const CardDetails = require('../models/cardDetails')
const SchoolInfo = require('../models/schoolInfo')
const StudentInfo = require('../models/studentInfo')
const Faculty = require('../models/faculties')
const mongoose = require('mongoose')
const User = require('../models/signUp')
const WebHookNotification = require('../models/webhook')
const crypto = require('crypto')


 

const isValidRegNumber = (regNum) => {
  const regNumberPattern = /^ND\/\d{3}\/\d{3}$/;
  return regNum && regNumberPattern.test(regNum);
};

const studentPaymentDetails = async (req, res) => {
  const { 
    userId, 
    firstName, 
    lastName, 
    department, 
    regNo, 
    academicLevel, 
    email, 
    feeType,
    feeAmount,
    schoolInfoId 
  } = req.body;

  // Add logging to verify schoolInfoId
  console.log('Received schoolInfoId:', schoolInfoId);

  if (!userId || !firstName || !lastName || !department || !regNo || 
      !academicLevel || !email || !feeType || !feeAmount || !schoolInfoId) {
    return res.status(422).json({ 
      success: false, 
      message: "All fields are required, including schoolInfoId and feeAmount." 
    });
  }

  try {
    // Verify schoolInfo exists before creating payment
    const schoolInfo = await SchoolInfo.findById(schoolInfoId);
    console.log('Found schoolInfo:', schoolInfo ? schoolInfo._id : 'not found');
    
    if (!schoolInfo) {
      return res.status(404).json({ 
        success: false, 
        message: "School information not found" 
      });
    }

    const newStudentPayment = await StudentPayment.findOneAndUpdate(
      { $or: [{ regNo }, { email }] },
      {
        userId,
        firstName,
        lastName,
        department,
        regNo,
        academicLevel,
        email,
        feeType,
        feeAmount,
        schoolInfoId: schoolInfo._id, 
        virtualAccount: schoolInfo.virtualAccount,
      },
      { new: true, upsert: true }
    );

    console.log('Created/Updated payment with schoolInfoId:', newStudentPayment.schoolInfoId);

    res.status(201).json({
      success: true,
      message: "Payment details saved or updated successfully!",
      payment: newStudentPayment,
      virtualAccount: schoolInfo.virtualAccount,
    });

  } catch (error) {
    console.error("Error in studentPaymentDetails:", error);
    res.status(500).json({ 
      success: false, 
      message: "An error occurred while saving payment details", 
      error: error.message
    });
  }
};
  
  
const getStudentPaymentDetails = async (req, res) => {
  const { email } = req.query;

  try {
    const studentDetails = await StudentPayment.findOne({ email });
    console.log('Found student payment:', studentDetails ? {
      email: studentDetails.email,
      schoolInfoId: studentDetails.schoolInfoId
    } : 'not found');

    if (!studentDetails) {
      return res.status(404).json({ error: "Student not found" });
    }

    // Log the schoolInfoId we're trying to find
    console.log('Looking for schoolInfoId:', studentDetails.schoolInfoId);

    // Ensure schoolInfoId is valid before querying
    if (!studentDetails.schoolInfoId) {
      return res.status(400).json({ error: "Student payment record is missing schoolInfoId" });
    }

    const schoolInfo = await SchoolInfo.findById(studentDetails.schoolInfoId);
    console.log('Found schoolInfo:', schoolInfo ? {
      _id: schoolInfo._id,
      university: schoolInfo.university
    } : 'not found');

    if (!schoolInfo) {
      return res.status(404).json({ 
        error: "School information not found",
        searchedId: studentDetails.schoolInfoId
      });
    }

    const { accountNumber, accountName, bankName } = schoolInfo.virtualAccount;
    // const accountName = schoolInfo.university;

    const serviceCharge = 100;
    const totalFee = parseFloat(studentDetails.feeAmount) + serviceCharge;

    res.status(200).json({
      success: true,
      student: {
        firstName: studentDetails.firstName,
        lastName: studentDetails.lastName,
        department: studentDetails.department,
        regNo: studentDetails.regNo,
        academicLevel: studentDetails.academicLevel,
        email: studentDetails.email,
        feeType: studentDetails.feeType,
        virtualAccount: {
          accountNumber,
          accountName,
          bankName,
        },
        paymentDetails: {
          paymentMethod: "Bank Transfer",
          paymentAmount: totalFee,
          originalAmount: studentDetails.feeAmount,
          serviceCharge,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching student payment details:", error);
    res.status(500).json({ 
      error: "An error occurred while fetching details",
      details: error.message
    });
  }
};






// Function to decrypt data (modify based on FCMB encryption)
function decryptData(encryptedData) {
  if (!encryptedData) {
    throw new Error("Missing encrypted data for decryption");
}

const buffer = Buffer.from(encryptedData, "base64");
  try {
    const algorithm = "aes-256-cbc"; // Example, replace with actual
    const key = Buffer.from(process.env.ENCRYPTION_KEY, "hex"); // Load from env
    const iv = Buffer.from(process.env.ENCRYPTION_IV, "hex"); // Load from env

    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encryptedText, "base64", "utf8");
    decrypted += decipher.final("utf8");

    return JSON.parse(decrypted); // Assuming it's JSON
  } catch (error) {
    console.error("Decryption Error:", error);
    return null;
  }
}


function generateXToken(utcdate, ClientID, Password) {
    const date = utcdate.toISOString().slice(0, 10) + utcdate.toISOString().slice(11, 19).replace(/:/g, '');
    const data = date + ClientID + Password;
    return SHA512(data);
  }
  
  // Define a private function to calculate SHA512 hash
  function SHA512(input) {
    const hash = crypto.createHash('sha512');
    hash.update(input, 'utf8');
    return hash.digest('hex');
  }
  
  const GetToken = () => {
    const utcdate = new Date();
    const ClientID = process.env.CLIENT_ID;
    const Password = process.env.PASSWORD;
    const xtoken = generateXToken(utcdate, ClientID, Password);
    const UTCTimestamp = utcdate.toISOString().replace("Z","");
    return { xtoken, UTCTimestamp };
  };



const webhook = async (req, res) => {
  try {
    console.log("Received FCMB webhook:", JSON.stringify(req.body, null, 2));
    console.log("Received Headers:", req.headers);

    // const clientId = req.headers["client_id"];
    // const subscriptionKey = req.headers["ocp-apim-subscription-key"];
    // const xToken = req.headers["x-token"];
    // const utcTimestamp = req.headers["utctimestamp"];

    // if (!clientId || !subscriptionKey || !xToken || !utcTimestamp) {
    //   return res.status(401).json({ message: "Missing required headers" });
    // }

    const utcDate = new Date();
        const clientID = "250";
        const password = "Tt9=dEB$4FdruOjlg1j1^sNR";
        
        //Format for header needs to be yyyy-MM-ddTHH:mm:ss.fff
        const utctimestamp = utcDate.toISOString().replace("Z", "").slice(0, 23); 
    
        const xToken = generateXToken(utcDate, clientID, password);
    

    const encryptedString = req.body?.encryptedString;
    if (!encryptedString) {
      return res.status(400).json({ message: "Missing encryptedString in request body" });
    }

    console.log("Received Encrypted Payload:", encryptedString);

    // const decryptedPayload = decryptData(encryptedString);
    // if (!decryptedPayload) {
    //   return res.status(400).json({ message: "Invalid encrypted data" });
    // }

    // console.log("Decrypted Payload:", decryptedPayload);

    const newNotification = new WebHookNotification({
      "clientId":clientID,
      "xToken":xToken,
      "utcTimestamp":utctimestamp,
      "Ocp-Apim-Subscription-Key": process.env.FCMB_SUBSCRIPTION_KEY,
      // payload: decryptedPayload,
      payload: encryptedString,
    });

    await newNotification.save();

    return res.status(200).json({
      code: "00",
      description: "Notification received successfully",
      data: {},
    });
  } catch (error) {
    console.error("FCMB Webhook Error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};













// const chargeCard = async (req, res) => {
//     const { email, amount, cardToken, feeType } = req.body;
//     const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

//     const allowedFeeTypes = ["SUG", "Departmental", "Faculty", "exam"];

//     if (!feeType || !allowedFeeTypes.includes(feeType)) {
//         return res.status(400).json({ error: "Invalid or missing fee type" });
//     }

//     try {
//         // Call Paystack API to charge card
//         const response = await axios.post(
//             "https://api.paystack.co/transaction/charge_authorization",
//             {
//                 authorization_code: cardToken,
//                 email,
//                 amount, 
//                 metadata: { feeType },
//             },
//             {
//                 headers: {
//                     Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
//                     "Content-Type": "application/json",
//                 },
//             }
//         );

//         if (response.data.status) {
//             // Find the student by email
//             const student = await StudentPayment.findOne({ email });
//             if (!student) {
//                 return res.status(404).json({ error: "Student not found" });
//             }

//             // Create and save the transaction
//             const newTransaction = new Transaction({
//                 email,
//                 amount,
//                 feeType,
//                 reference: response.data.data.reference,
//                 status: response.data.data.status,
//                 gatewayResponse: response.data.data.gateway_response,
//                 student: student._id, 
//             });

//             const savedTransaction = await newTransaction.save();

//             // Add transaction reference to the student
//             student.transactions.push(savedTransaction._id);
//             await student.save();

//             return res.status(200).json({ success: true, data: response.data.data });
//         } else {
//             return res.status(400).json({ error: response.data.message });
//         }
//     } catch (error) {
//         console.error("Charge error:", error.response?.data || error.message);

//         if (error.response) {
//             return res.status(error.response.status).json({ error: error.response.data.message });
//         } else if (error.request) {
//             return res.status(500).json({ error: "No response received from Paystack" });
//         } else {
//             return res.status(500).json({ error: "An unexpected error occurred" });
//         }
//     }
// };


const recordPayment = async (req, res) => {
    const { email, amount, feeType, reference, status, gatewayResponse } = req.body;
  
    try {
      // Find the student payment by email
      const studentPayment = await StudentPayment.findOne({ email });
      if (!studentPayment) {
        return res.status(404).json({ success: false, message: "Student payment record not found." });
      }
  
      console.log("Student Payment Record:", studentPayment);
  
      // Find the student by registration number
      const registrationNumber = studentPayment.regNo.trim(); 
      const student = await Student.findOne({
        registrationNumber: { $regex: `^${registrationNumber}$`, $options: "i" },
      });
  
      if (!student) {
        console.log("No student found for regNo:", registrationNumber);
        return res.status(404).json({ success: false, message: "Student record not found." });
      }
  
      console.log("Student Record Found:", student);
  
      // Check if the transaction already exists
      let transaction = await Transaction.findOne({ reference });
      if (transaction) {
        console.log("Transaction already exists:", transaction);
  
        // Ensure the transaction is linked to the student payment and student
        if (!studentPayment.transactions.includes(transaction._id)) {
          studentPayment.transactions.push(transaction._id);
          await studentPayment.save();
        }
  
        if (!student.transactions.includes(transaction._id)) {
          student.transactions.push(transaction._id);
          await student.save();
        }
  
        return res.status(200).json({
          success: true,
          message: "Payment already recorded and linked successfully.",
          data: transaction,
        });
      }
  
      // Create a new transaction if it doesn't exist
      transaction = new Transaction({
        email,
        amount,
        feeType,
        reference,
        status,
        gatewayResponse,
        student: studentPayment._id, 
      });
  
      const savedTransaction = await transaction.save();
  
      // Update the StudentPayment transactions array
      studentPayment.transactions.push(savedTransaction._id);
      await studentPayment.save();
  
      // Update the Student transactions array
      student.transactions.push(savedTransaction._id);
      await student.save();
  
      return res.status(200).json({
        success: true,
        message: "Payment recorded and linked successfully.",
        data: savedTransaction,
      });
    } catch (error) {
      console.error("Error recording payment:", error.stack || error);
      return res.status(500).json({
        success: false,
        message: "An error occurred while recording the payment.",
      });
    }
  };
  


  


const retrieveStudentDetails = async (req, res) => {
    const { email } = req.params; 

    try {
        // Find the student and populate their transactions
        const student = await StudentPayment.findOne({ email }).populate("transactions");

        if (!student) {
            return res.status(404).json({ success: false, error: "Student not found" });
        }

        res.status(200).json({
            success: true,
            data: {
                student,
                transactions: student.transactions,
            },
        });
    } catch (error) {
        console.error("Error retrieving student details:", error.message);
        res.status(500).json({ success: false, error: "An error occurred while retrieving student details" });
    }
};


const schoolPaymentStatus = async (req, res) => {
    const { schoolInfoId } = req.params;
    const { page = 1, limit = 1 } = req.query; 

    try {
        // Retrieve school information and populate related faculties and students
        const schoolInfo = await SchoolInfo.findById(schoolInfoId)
            .populate({
                path: "faculties",
                select: "facultyName",
            })
            .populate({
                path: "students",
                select: "registrationNumber faculty transactions",
                populate: [
                    {
                        path: "faculty",
                        select: "facultyName",
                    },
                    {
                        path: "transactions",
                        select: "status",
                    },
                ],
            });

        if (!schoolInfo) {
            return res.status(404).json({ message: "School information not found." });
        }

        const totalRegistrations = schoolInfo.students.length;
        let totalPaid = 0;

        // Create a dictionary to hold data grouped by faculty
        const facultyWiseData = {};

        schoolInfo.faculties.forEach((faculty) => {
            facultyWiseData[faculty._id] = {
                facultyName: faculty.facultyName,
                totalRegistrations: 0,
                students: [],
            };
        });

        // Categorize students by faculty and payment status
        schoolInfo.students.forEach((student) => {
            const hasPaid = student.transactions.some(
                (transaction) => transaction.status === "success"
            );
            const paymentStatus = hasPaid ? "Paid" : "Unpaid";
            const formattedRegNo = `${student.registrationNumber}`;

            if (student.faculty && facultyWiseData[student.faculty._id]) {
                facultyWiseData[student.faculty._id].totalRegistrations++;
                facultyWiseData[student.faculty._id].students.push({
                    registrationNumber: formattedRegNo,
                    status: paymentStatus,
                });
            }

            if (hasPaid) {
                totalPaid++;
            }
        });

        const totalUnpaid = totalRegistrations - totalPaid;

        // Implement pagination for faculties
        const facultyEntries = Object.values(facultyWiseData);
        const totalFaculties = facultyEntries.length;

        const startIndex = (page - 1) * limit; 
        const endIndex = startIndex + parseInt(limit, 10); 

        // Slice the faculty entries based on pagination indices
        const paginatedFaculties = facultyEntries.slice(
            Math.max(startIndex, 0), 
            Math.min(endIndex, totalFaculties)
        );

        // Handle case where no entries exist for the requested page
        if (paginatedFaculties.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No faculties found for the specified page.",
            });
        }

        // Format response
        const result = {
            totalRegistrations,
            totalPaid,
            totalUnpaid,
            facultyDetails: paginatedFaculties,
            pagination: {
                currentPage: Number(page),
                totalPages: Math.ceil(totalFaculties / limit),
                hasNextPage: endIndex < totalFaculties,
                hasPrevPage: startIndex > 0,
            },
        };

        return res.status(200).json({
            success: true,
            message: "School payment status retrieved successfully.",
            data: result,
        });
    } catch (error) {
        console.error("Error retrieving school payment status:", error);
        return res.status(500).json({
            success: false,
            message: "An error occurred while retrieving school payment status.",
        });
    }
};

//this function is not in use at the moment because it's being implemented directly by the frontend guy
const searchStudentByRegistrationNumber = async (req, res) => {
    const { schoolInfoId, registrationNumber } = req.params;

    try {
        // Retrieve the school information and populate related students
        const schoolInfo = await SchoolInfo.findById(schoolInfoId)
            .populate({
                path: "students",
                select: "registrationNumber faculty transactions",
                populate: [
                    {
                        path: "faculty",
                        select: "facultyName",
                    },
                    {
                        path: "transactions",
                        select: "status",
                    },
                ],
            });

        if (!schoolInfo) {
            return res.status(404).json({ message: "School information not found." });
        }

        // Find the student with the specified registration number
        const student = schoolInfo.students.find(
            (student) => student.registrationNumber === registrationNumber
        );

        if (!student) {
            return res.status(404).json({ message: "Student not found." });
        }

        // Check the payment status of the student
        const hasPaid = student.transactions.some(
            (transaction) => transaction.status === "success"
        );
        const paymentStatus = hasPaid ? "Paid" : "Unpaid";

        // Format the result
        const result = {
            registrationNumber: student.registrationNumber,
            faculty: student.faculty ? student.faculty.facultyName : "N/A",
            paymentStatus,
        };

        return res.status(200).json({
            success: true,
            message: "Student found.",
            data: result,
        });
    } catch (error) {
        console.error("Error searching for student:", error);
        return res.status(500).json({
            success: false,
            message: "An error occurred while searching for the student.",
        });
    }
};


// const schoolPaymentStatus = async (req, res) => { 
//     const { schoolInfoId } = req.params;

//     try {
//         // Retrieve school information and populate related faculties and students
//         const schoolInfo = await SchoolInfo.findById(schoolInfoId)
//             .populate({
//                 path: "faculties",
//                 select: "facultyName",
//             })
//             .populate({
//                 path: "students",
//                 select: "registrationNumber faculty transactions",
//                 populate: [
//                     {
//                         path: "faculty",
//                         select: "facultyName",
//                     },
//                     {
//                         path: "transactions",
//                         select: "status",
//                     },
//                 ],
//             });

//         if (!schoolInfo) {
//             return res.status(404).json({ message: "School information not found." });
//         }

//         console.log("School Info:", schoolInfo);

//         const totalRegistrations = schoolInfo.students.length;

//         // Create a dictionary to hold data grouped by faculty
//         const facultyWiseData = {};

//         // Initialize each faculty entry based on the school info
//         schoolInfo.faculties.forEach((faculty) => {
//             facultyWiseData[faculty._id] = {
//                 facultyName: faculty.facultyName,
//                 totalRegistrations: 0,
//                 students: {
//                     paid: [],
//                     unpaid: [],
//                 },
//             };
//         });

//         let totalPaid = 0;

//         // Iterate over the students and categorize them by faculty
//         schoolInfo.students.forEach((student) => {
//             console.log("Student:", student);
//             console.log("Transactions:", student.transactions);

//             // Check if the student has paid
//             const hasPaid = student.transactions.some(
//                 (transaction) => transaction.status === "success"
//             );
//             console.log(`Has Paid (${student.registrationNumber}):`, hasPaid);

//             // Categorize the student as 'paid' or 'unpaid'
//             const category = hasPaid ? "paid" : "unpaid";

//             // Ensure the student is assigned to the correct faculty using faculty _id
//             if (student.faculty && facultyWiseData[student.faculty._id]) {
//                 facultyWiseData[student.faculty._id].totalRegistrations++;
//                 facultyWiseData[student.faculty._id].students[category].push(
//                     student.registrationNumber
//                 );
//             } else {
//                 console.warn(
//                     `Student ${student.registrationNumber} has an invalid or unlinked faculty.`
//                 );
//             }

//             if (hasPaid) {
//                 totalPaid++;
//             }
//         });

//         const totalUnpaid = totalRegistrations - totalPaid;

//         // Format response
//         const result = {
//             totalRegistrations,
//             totalPaid,
//             totalUnpaid,
//             facultyDetails: Object.values(facultyWiseData),
//         };

//         return res.status(200).json({
//             success: true,
//             message: "School payment status retrieved successfully.",
//             data: result,
//         });
//     } catch (error) {
//         console.error("Error retrieving school payment status:", error);
//         return res.status(500).json({
//             success: false,
//             message: "An error occurred while retrieving school payment status.",
//         });
//     }
// };




  



  


// const schoolPaymentStatus = async (req, res) => {
//     const { schoolInfoId } = req.params;

//     try {
//         // Retrieve school information and populate related faculties and students
//         const schoolInfo = await SchoolInfo.findById(schoolInfoId)
//             .populate({
//                 path: "faculties",
//                 select: "facultyName", // Only fetch faculty name
//             })
//             .populate({
//                 path: "students",
//                 select: "registrationNumber faculty transactions",
//                 populate: [
//                     {
//                         path: "faculty",
//                         select: "facultyName",  // Ensure we are populating facultyName
//                     },
//                     {
//                         path: "transactions",
//                         select: "status", 
//                     },
//                 ],
//             });

//         if (!schoolInfo) {
//             return res.status(404).json({ message: "School information not found." });
//         }

//         console.log("School Info:", schoolInfo); // Debugging: Check if school info and students are populated
//         console.log("Students:", schoolInfo.students); // Debugging: Check students data

//         const totalRegistrations = schoolInfo.students.length;
//         console.log("Total Registrations:", totalRegistrations); // Debug: Check the count of students

//         const facultyWiseData = {};
//         schoolInfo.faculties.forEach((faculty) => {
//             facultyWiseData[faculty._id] = {
//                 facultyName: faculty.facultyName,
//                 students: {
//                     paid: [],
//                     unpaid: [],
//                 },
//             };
//         });

//         let totalPaid = 0;

//         schoolInfo.students.forEach((student) => {
//             console.log("Student Registration:", student.registrationNumber);
//             console.log("Student Faculty:", student.faculty); // Check faculty
//             console.log("Student Transactions:", student.transactions); // Check transactions

//             // Ensure transactions exist
//             if (student.transactions && Array.isArray(student.transactions)) {
//                 student.transactions.forEach((transaction) => {
//                     console.log(`Transaction status for ${student.registrationNumber}: ${transaction.status}`);
//                 });
//             }

//             // Check if the student has paid
//             const hasPaid = student.transactions.some(
//                 (transaction) => transaction.status.toLowerCase() === "success" // Ensure case-insensitive match
//             );
//             console.log(`Has Paid (${student.registrationNumber}):`, hasPaid); // Debugging if payment status is correct

//             if (hasPaid) {
//                 totalPaid++;
//             }

//             // Categorize the student as 'paid' or 'unpaid'
//             const category = hasPaid ? "paid" : "unpaid";

//             // Make sure that the student has a valid faculty and faculty data exists
//             if (student.faculty && facultyWiseData[student.faculty._id]) {
//                 facultyWiseData[student.faculty._id].students[category].push(student.registrationNumber);
//             } else {
//                 console.log(`Faculty data missing for student ${student.registrationNumber}`);
//             }
//         });

//         const totalUnpaid = totalRegistrations - totalPaid;

//         // Format response
//         const result = {
//             totalRegistrations,
//             totalPaid,
//             totalUnpaid,
//             facultyDetails: Object.values(facultyWiseData),
//         };

//         return res.status(200).json({
//             success: true,
//             message: "School payment status retrieved successfully.",
//             data: result,
//         });
//     } catch (error) {
//         console.error("Error retrieving school payment status:", error);
//         return res.status(500).json({
//             success: false,
//             message: "An error occurred while retrieving school payment status.",
//         });
//     }
// };






  
  
  
  
  
  
  
  
  
  








module.exports = {studentPaymentDetails, getStudentPaymentDetails,webhook, recordPayment, retrieveStudentDetails, schoolPaymentStatus, searchStudentByRegistrationNumber}
