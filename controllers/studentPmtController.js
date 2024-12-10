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




// Save student information
// const studentPaymentDetails =  async (req, res) => {
//     const { firstName, lastName, department, regNo, academicLevel, email } = req.body;

//     try {
//         const newStudent = new StudentPayment({
//             firstName,
//             lastName,
//             department,
//             regNo,
//             academicLevel,
//             email,
//         });

//         await newStudent.save();

//         res.status(201).json({ success: true, message: "Student added successfully!" });
//     } catch (error) {
//         if (error.code === 11000) {
//             return res.status(400).json({ error: "Student with this Registration Number or Email already exists" });
//         }
//         res.status(500).json({ error: "An error occurred while saving student details" });
//     }
// }




const isValidRegNumber = (regNum) => {
    // Regular expression for validating regNo in the format 'ND/xxx/xxx'
    const regNumberPattern = /^ND\/\d{3}\/\d{3}$/;
    return regNum && regNumberPattern.test(regNum);
  };
  
  const studentPaymentDetails = async (req, res) => {
    const { userId, firstName, lastName, department, regNo, academicLevel, email, feeType, schoolInfoId } = req.body;
  
    // Validate required fields
    if (!userId || !firstName || !lastName || !department || !regNo || !academicLevel || !email || !feeType || !schoolInfoId) {
      return res.status(422).json({ success: false, message: "All fields are required, including schoolInfoId." });
    }
  
    // Validate regNo format
    if (!isValidRegNumber(regNo)) {
      return res.status(400).json({ success: false, message: "Invalid registration number format." });
    }
  
    try {
      // Check if the user exists
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }
  
      // Check if the regNo exists in the students collection
      const student = await Student.findOne({ registrationNumber: regNo });
      if (!student) {
        return res.status(404).json({ success: false, message: "Student with the given registration number not found." });
      }
  
      // Check for existing payment with the same regNo or email
      const existingPayment = await StudentPayment.findOne({ 
        $or: [{ regNo }, { email }] 
      });
      if (existingPayment) {
        return res.status(400).json({ success: false, message: "Payment details already exist for this Registration Number or Email" });
      }
  
      // Create a new payment record
      const newStudentPayment = new StudentPayment({
        userId,
        firstName,
        lastName,
        department,
        regNo,
        academicLevel,
        email,
        feeType,
        schoolInfoId,
      });
  
      // Save payment record
      const savedPayment = await newStudentPayment.save();
  
      res.status(201).json({
        success: true,
        message: "Payment details saved successfully!",
        payment: savedPayment,
      });
    } catch (error) {
      console.error("Error in studentPaymentDetails:", error);
      res.status(500).json({ success: false, message: "An error occurred while saving payment details", error });
    }
  };
  
  


// const studentPaymentDetails = async (req, res) => {
//     const { firstName, lastName, department, regNo, academicLevel, email, feeType } = req.body;

//     try {
//         const newStudent = new StudentPayment({
//             firstName,
//             lastName,
//             department,
//             regNo,
//             academicLevel,
//             email,
//             feeType,
//         });

//         await newStudent.save();

//         res.status(201).json({ success: true, message: "Student added successfully!" });
//     } catch (error) {
//         if (error.code === 11000) {
//             return res.status(400).json({ error: "Student with this Registration Number or Email already exists" });
//         }
//         res.status(500).json({ error: "An error occurred while saving student details" });
//     }
// };





const addCard = async (req, res) => {
    const { cardNumber, cvv, expiryDate, email, feeType, bankName } = req.body;
    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

    // Validate expiryDate format (MM/YY)
    if (!expiryDate || !/^\d{2}\/\d{2}$/.test(expiryDate)) {
        return res.status(400).json({ error: "Invalid expiry date format. It should be MM/YY." });
    }

    const [expiryMonth, expiryYear] = expiryDate.split('/');

    try {
        const response = await axios.post(
            "https://api.paystack.co/charge",
            {
                email,
                amount: 1000, // Amount in kobo (₦1 for test purposes)
                card: {
                    number: cardNumber,
                    cvv,
                    expiry_month: expiryMonth,
                    expiry_year: expiryYear,
                },
                metadata: {
                    feeType,
                    bankName,
                },
            },
            {
                headers: {
                    Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                    "Content-Type": "application/json",
                },
            }
        );

        if (response.data.status) {
            const { authorization_code } = response.data.data.authorization;

            // Extract first 3 and last 3 digits
            const first3 = cardNumber.slice(0, 3);
            const last3 = cardNumber.slice(-3);

            // Save non-sensitive information and token
            const cardDetails = new CardDetails({
                email,
                bankName,
                feeType,
                first3,
                last3,
                authorizationCode: authorization_code,
            });

            await cardDetails.save();

            return res.status(200).json({
                success: true,
                message: "Card added successfully",
                cardToken: authorization_code,
            });
        } else {
            return res.status(400).json({ error: "Card tokenization failed" });
        }
    } catch (error) {
        console.error("Tokenization error:", error.response?.data || error.message);
        res.status(500).json({ error: "An error occurred during tokenization" });
    }
};

  
  
const getStudentAndCardDetails = async (req, res) => {
    const { email } = req.query;

    try {
        const studentDetails = await StudentPayment.findOne({ email });
        if (!studentDetails) {
            return res.status(404).json({ error: "Student not found" });
        }

        const cardDetails = await CardDetails.findOne({ email: studentDetails.email });
        if (!cardDetails) {
            return res.status(404).json({ error: "Card details not found" });
        }

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
            },
            card: {
                cardNumber: `${cardDetails.first3} **** **** ${cardDetails.last3}`, // Return first 3 and last 3 digits
                bankName: cardDetails.bankName,
                expiryDate: cardDetails.expiryDate,
            },
        });
    } catch (error) {
        console.error("Error fetching student or card details:", error.message);
        res.status(500).json({ error: "An error occurred while fetching details" });
    }
};


  


// const addCard = async (req, res) => {
//     const { cardNumber, cvv, expiryMonth, expiryYear, email } = req.body;
//     const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

//     try {
//         const response = await axios.post(
//             "https://api.paystack.co/charge",
//             {
//                 email,
//                 amount: 100, // Amount in kobo (₦1 for test purposes)
//                 card: {
//                     number: cardNumber,
//                     cvv,
//                     expiry_month: expiryMonth,
//                     expiry_year: expiryYear,
//                 },
//             },
//             {
//                 headers: {
//                     Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
//                     "Content-Type": "application/json",
//                 },
//             }
//         );

//         if (response.data.status) {
//             const authorizationCode = response.data.data.authorization.authorization_code;

//             // Save card token (authorization code) to the database for future transactions
//             return res.status(200).json({
//                 success: true,
//                 cardToken: authorizationCode,
//             });
//         } else {
//             return res.status(400).json({ error: "Card tokenization failed" });
//         }
//     } catch (error) {
//         console.error("Tokenization error:", error.response?.data || error.message);

//         if (error.response) {
//             return res.status(error.response.status).json({ error: error.response.data.message });
//         } else if (error.request) {
//             return res.status(500).json({ error: "No response received from Paystack" });
//         } else {
//             return res.status(500).json({ error: "An unexpected error occurred" });
//         }
//     }
// };




const chargeCard = async (req, res) => {
    const { email, amount, cardToken, feeType } = req.body;
    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

    const allowedFeeTypes = ["SUG", "Departmental", "Faculty", "exam"];

    if (!feeType || !allowedFeeTypes.includes(feeType)) {
        return res.status(400).json({ error: "Invalid or missing fee type" });
    }

    try {
        // Call Paystack API to charge card
        const response = await axios.post(
            "https://api.paystack.co/transaction/charge_authorization",
            {
                authorization_code: cardToken,
                email,
                amount, // Amount in kobo
                metadata: { feeType },
            },
            {
                headers: {
                    Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                    "Content-Type": "application/json",
                },
            }
        );

        if (response.data.status) {
            // Find the student by email
            const student = await StudentPayment.findOne({ email });
            if (!student) {
                return res.status(404).json({ error: "Student not found" });
            }

            // Create and save the transaction
            const newTransaction = new Transaction({
                email,
                amount,
                feeType,
                reference: response.data.data.reference,
                status: response.data.data.status,
                gatewayResponse: response.data.data.gateway_response,
                student: student._id, // Link to the student
            });

            const savedTransaction = await newTransaction.save();

            // Add transaction reference to the student
            student.transactions.push(savedTransaction._id);
            await student.save();

            return res.status(200).json({ success: true, data: response.data.data });
        } else {
            return res.status(400).json({ error: response.data.message });
        }
    } catch (error) {
        console.error("Charge error:", error.response?.data || error.message);

        if (error.response) {
            return res.status(error.response.status).json({ error: error.response.data.message });
        } else if (error.request) {
            return res.status(500).json({ error: "No response received from Paystack" });
        } else {
            return res.status(500).json({ error: "An unexpected error occurred" });
        }
    }
};


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
      const registrationNumber = studentPayment.regNo.trim(); // Remove extra spaces
      const student = await Student.findOne({
        registrationNumber: { $regex: `^${registrationNumber}$`, $options: "i" }
      });
  
      if (!student) {
        console.log("No student found for regNo:", registrationNumber);
        return res.status(404).json({ success: false, message: "Student record not found." });
      }
  
      console.log("Student Record Found:", student);
  
      // Create a new transaction
      const transaction = new Transaction({
        email,
        amount,
        feeType,
        reference,
        status,
        gatewayResponse,
        student: studentPayment._id, // Link to StudentPayment
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
    const { email } = req.params; // Assume email is passed as a URL parameter

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
    const { page = 1, limit = 1 } = req.query; // Default to page 1 and 1 faculty per page

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
            const formattedRegNo = `${student.registrationNumber} (${paymentStatus})`;

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

        const startIndex = (page - 1) * limit; // Start index for pagination
        const endIndex = startIndex + parseInt(limit, 10); // End index for pagination

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






  
  
  
  
  
  
  
  
  
  




// const chargeCard = async (req, res) => {
//     const { email, amount, cardToken } = req.body; // Amount in kobo
//     const PAYSTACK_SECRET_KEY = "sk_test_482f142b212c1e237586f1d705b56dfb2a9a0402";

//     try {
//         const response = await axios.post(
//             "https://api.paystack.co/transaction/charge_authorization",
//             {
//                 authorization_code: cardToken,
//                 email,
//                 amount, // Amount in kobo (e.g., 5000 = ₦50)
//             },
//             {
//                 headers: {
//                     Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
//                     "Content-Type": "application/json",
//                 },
//             }
//         );

//         if (response.data.status) {
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



module.exports = {studentPaymentDetails, addCard,getStudentAndCardDetails, chargeCard,recordPayment, retrieveStudentDetails, schoolPaymentStatus}
