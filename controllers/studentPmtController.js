// routes/student.js
const express = require('express')
const StudentPayment = require("../models/studentPayment");
const axios = require("axios");
require("dotenv").config();




// Save student information
const studentPaymentDetails =  async (req, res) => {
    const { firstName, lastName, department, regNo, academicLevel, email } = req.body;

    try {
        const newStudent = new StudentPayment({
            firstName,
            lastName,
            department,
            regNo,
            academicLevel,
            email,
        });

        await newStudent.save();

        res.status(201).json({ success: true, message: "Student added successfully!" });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ error: "Student with this Registration Number or Email already exists" });
        }
        res.status(500).json({ error: "An error occurred while saving student details" });
    }
}



const addCard = async (req, res) => {
    const { cardNumber, cvv, expiryMonth, expiryYear, email } = req.body;
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




const chargeCard = async (req, res) => {
    const { email, amount, cardToken } = req.body; // Amount in kobo
    const PAYSTACK_SECRET_KEY = "sk_test_482f142b212c1e237586f1d705b56dfb2a9a0402";

    try {
        const response = await axios.post(
            "https://api.paystack.co/transaction/charge_authorization",
            {
                authorization_code: cardToken,
                email,
                amount, // Amount in kobo (e.g., 5000 = ₦50)
            },
            {
                headers: {
                    Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                    "Content-Type": "application/json",
                },
            }
        );

        if (response.data.status) {
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



module.exports = {studentPaymentDetails, addCard, chargeCard}
