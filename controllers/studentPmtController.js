// routes/student.js
const express = require('express')
const StudentPayment = require("../models/studentPayment");
const axios = require("axios");
require("dotenv").config();
const Transaction = require('../models/transaction')




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
const studentPaymentDetails = async (req, res) => {
    const { firstName, lastName, department, regNo, academicLevel, email, feeType } = req.body;

    try {
        const newStudent = new StudentPayment({
            firstName,
            lastName,
            department,
            regNo,
            academicLevel,
            email,
            feeType,
        });

        await newStudent.save();

        res.status(201).json({ success: true, message: "Student added successfully!" });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ error: "Student with this Registration Number or Email already exists" });
        }
        res.status(500).json({ error: "An error occurred while saving student details" });
    }
};





const addCard = async (req, res) => {
    const { cardNumber, cvv, expiryMonth, expiryYear, email, feeType } = req.body;
    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

    try {
        const response = await axios.post(
            "https://api.paystack.co/charge",
            {
                email,
                amount: 100, // Amount in kobo (₦1 for test purposes)
                card: {
                    number: cardNumber,
                    cvv,
                    expiry_month: expiryMonth,
                    expiry_year: expiryYear,
                },
                metadata: { feeType }, // Include the fee type in metadata
            },
            {
                headers: {
                    Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                    "Content-Type": "application/json",
                },
            }
        );

        if (response.data.status) {
            const authorizationCode = response.data.data.authorization.authorization_code;

            // Save card token (authorization code) to the database for future transactions
            return res.status(200).json({
                success: true,
                cardToken: authorizationCode,
            });
        } else {
            return res.status(400).json({ error: "Card tokenization failed" });
        }
    } catch (error) {
        console.error("Tokenization error:", error.response?.data || error.message);

        if (error.response) {
            return res.status(error.response.status).json({ error: error.response.data.message });
        } else if (error.request) {
            return res.status(500).json({ error: "No response received from Paystack" });
        } else {
            return res.status(500).json({ error: "An unexpected error occurred" });
        }
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



module.exports = {studentPaymentDetails, addCard, chargeCard, retrieveStudentDetails}
