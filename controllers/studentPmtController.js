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
const processedEvents = new Set();


 

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

  // const crypto = require('crypto');

  //Verify webhook signature
  // const verifyWebhookSignature = (payload, receivedHash, secretKey) => {
  //   try {
  //     // Compute hash using HMACSHA256
  //     const computedHash = crypto
  //       .createHmac('sha256', secretKey)
  //       .update(JSON.stringify(payload))
  //       .digest('hex');
  
  //     // Compare computed hash with received hash
  //     return crypto.timingSafeEqual(
  //       Buffer.from(computedHash),
  //       Buffer.from(receivedHash)
  //     );
  //   } catch (error) {
  //     console.error('Hash verification error:', error);
  //     return false;
  //   }
  // };
//   const verifyWebhookSignature = (rawBody, receivedHash, secretKey) => {
//     if (!secretKey) {
//         console.error("Missing FCMB_WEBHOOK_SECRET_KEY in environment variables!");
//         return false;
//     }

//     // Deep cleaning to remove newlines and extra spaces, also sort the keys to ensure consistency
//     const rawBodyString = JSON.stringify(rawBody)
//   .replace(/\r\n|\n|\r/g, "")   
//   .replace(/\s+/g, "");     
// console.log("Cleaned Raw Body String:", rawBodyString);


// const computedHash = crypto.createHmac("sha256", secretKey)
//     .update(rawBody, "utf8")  
//     .digest("hex");


// console.log("Computed Hash:", computedHash);
// console.log("Received Hash:", receivedHash);


//     // Compare the computed hash and the received hash
//     if (computedHash.toLowerCase() === receivedHash.toLowerCase()) {
//         console.log("Valid webhook signature");
//         return true;
//     } else {
//         console.log("Invalid webhook signature");
//         return false;
//     }
// };

// const verifyWebhookSignature = (rawBody, receivedHash, secretKey) => {
//     if (!secretKey) {
//         console.error("Missing FCMB_WEBHOOK_SECRET_KEY in environment variables!");
//         return false;
//     }
    
//     // If rawBody is already a string, use it directly. If it's an object, stringify it
//     const rawBodyString = typeof rawBody === 'string' 
//         ? rawBody 
//         : JSON.stringify(rawBody);

//     // Clean the string
//     const cleanedBody = rawBodyString
//         .replace(/\r\n|\n|\r/g, "")
//         .replace(/\s+/g, "");

//     const computedHash = crypto.createHmac("sha256", secretKey)
//         .update(cleanedBody, "utf8")
//         .digest("hex");

//     // Add debug logging
//     console.log({
//         cleanedBody,
//         computedHash,
//         receivedHash,
//         match: computedHash.toLowerCase() === receivedHash.toLowerCase()
//     });

//     return computedHash.toLowerCase() === receivedHash.toLowerCase();
// };

const verifyWebhookSignature = (rawBody, receivedHash, secretKey) => {
  if (!secretKey) {
    console.error("Missing FCMB_WEBHOOK_SECRET_KEY in environment variables!");
    return false;
  }
  if (!rawBody || !receivedHash) {
    console.error("Missing rawBody or receivedHash");
    return false;
  }

  const payloadString = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;
  const compactPayload = JSON.stringify(JSON.parse(payloadString)); // Strip formatting

  const computedHashFormatted = crypto
    .createHmac('sha256', secretKey)
    .update(payloadString, 'utf8')
    .digest('hex');

  const computedHashCompact = crypto
    .createHmac('sha256', secretKey)
    .update(compactPayload, 'utf8')
    .digest('hex');

  console.log({
    payloadString,
    compactPayload,
    computedHashFormatted,
    computedHashCompact,
    receivedHash,
    matchFormatted: computedHashFormatted === receivedHash,
    matchCompact: computedHashCompact === receivedHash
  });

  return computedHashCompact === receivedHash; // Assume compact for now
};

// const verifyWebhookSignature = (rawBody, receivedHash, secretKey) => {
//   if (!secretKey) {
//       console.error("Missing FCMB_WEBHOOK_SECRET_KEY in environment variables!");
//       return false;
//   }

//   const computedHash = crypto.createHmac("sha256", secretKey)
//       .update(rawBody, "utf8")
//       .digest("hex");

//   console.log("Computed Hash:", computedHash);
//   console.log("Received Hash:", receivedHash);

//   return computedHash.toLowerCase() === receivedHash.toLowerCase();
// };






  
// const webhook = async (req, res) => {
//   try {
//       // Extract the hash from headers
//       const receivedHash = req.headers["x-checksum-hash"];
//       console.log("Received X-checksum-hash:", receivedHash);

//       if (!receivedHash) {
//           console.error("Missing X-checksum-hash header");
//           return res.status(401).json({
//               code: "01",
//               description: "Missing signature header",
//               data: {},
//           });
//       }

//       // Ensure you're using raw body for signature verification
//       const rawBody = req.rawBody || req.body; // Ensure rawBody is available or fallback to body

//       // Verify webhook signature
//       const isValidSignature = verifyWebhookSignature(rawBody, receivedHash, process.env.FCMB_WEBHOOK_SECRET_KEY);

//       if (!isValidSignature) {
//           console.error("Invalid webhook signature");
//           return res.status(401).json({
//               code: "01",
//               description: "Invalid webhook signature",
//               data: {},
//           });
//       }

//       const { creationTime, expirationTime, amount, accountNumber, name, type } = req.body.data;

//       // Validate required fields
//       if (!accountNumber || !name || !type || !creationTime) {
//           return res.status(400).json({
//               code: "01",
//               description: "Missing required fields",
//               data: {},
//           });
//       }

//       // Create new notification record
//       const newNotification = await WebHookNotification.create({
//           webhookHash: receivedHash,
//           // Virtual account data
//           virtualAccount: {
//               creationTime,
//               expirationTime,
//               amount,
//               accountNumber,
//               name,
//               type,
//           },
//       });

//       // Log successful verification and storage
//       console.log("Verified and saved the webhook notification:", newNotification._id);

//       // Send success response
//       return res.status(200).json({
//           code: "00",
//           description: "Notification received and verified successfully",
//           data: {
//               notificationId: newNotification._id,
//           },
//       });
//   } catch (error) {
//       console.error("FCMB Webhook Error:", error);
//       return res.status(500).json({
//           code: "99",
//           description: "Internal server error",
//           data: {},
//       });
//   }
// };



const webhook = async (req, res) => {
  console.log("Received Headers:", req.headers);
console.log("Received Body:", req.body);
console.log("Received Raw Body:", req.rawBody);

  try {
      const receivedHash = req.headers["x-checksum-hash"];
      const rawPayload = req.rawBody;

      if (!verifyWebhookSignature(rawPayload, receivedHash, process.env.FCMB_WEBHOOK_SECRET_KEY)) {
          return res.status(401).json({
              code: "01",
              description: "Invalid webhook signature",
              data: {},
          });
      }

      const event = req.body;

      console.log("Received FCMB Webhook:", event);

      // Prevent duplicate processing
      if (processedEvents.has(event.reference)) {
        return res.status(200).json({ message: "Duplicate event ignored" });
      }
  
      res.status(200).json({
        code: "00",
        description: "Notification received and verified successfully",
        data: {},
      });
  
      setImmediate(async () => {
        try {
          processedEvents.add(event.reference);
  
          const { amount, accountNumber, type, senderAccountNumber, senderAccountName, senderBank, time, reference } = event;
  
          const newNotification = await WebHookNotification.create({
            webhookHash: receivedHash,
            virtualAccount: {
              senderAccountNumber,
              senderBank,
              amount,
              accountNumber,
              senderAccountName,
              type,
              time,
              reference,
            },
          });
          console.log(newNotification);
          
  
          console.log("Notification stored:", newNotification._id);
        } catch (error) {
          console.error("Async processing error:", error);
        }
      });
  
    } catch (error) {
      console.error("Webhook processing error:", error);
      return res.status(500).json({ error: "Internal server error" });
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
