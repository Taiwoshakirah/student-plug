const fs = require('fs')
const Event = require("../models/event");
const {uploadToCloudinary} = require('../config/cloudinaryConfig')
const axios = require('axios')
const Roles = require("../middlewares/role");
const SugUser = require('../models/schoolSug')
const SchoolInfo = require('../models/schoolInfo')
const User = require("../models/signUp"); // Import User model
const Student = require("../models/studentRegNo"); // Import Student model
const EventPayment = require('../models/eventpymt')
require("dotenv").config();
const EventCardDetails = require('../models/eventCardDetails')
const StudentInfo = require('../models/studentInfo')
const EventTransaction = require('../models/eventTransaction')



const createUnpaidEvent = async (req, res) => {
    try {
        const { adminId, schoolInfoId, title, description, ticketsAvailable } = req.body;

        if (!adminId || !schoolInfoId || !title) {
            return res.status(400).json({ 
                success: false, 
                message: "Required fields are missing." 
            });
        }

        // Determine postedByBody based on adminId
        let postedByBody = null;

        if (await SugUser.findById(adminId)) {
            postedByBody = "sug";
        } else if (await FacultyUser.findById(adminId)) {
            postedByBody = "faculty";
        } else if (await DepartmentUser.findById(adminId)) {
            postedByBody = "department";
        } else {
            return res.status(404).json({ 
                success: false, 
                message: "Admin ID not found in any user group." 
            });
        }


        // Fetch uniProfilePicture from SchoolInfo
        const schoolInfo = await SchoolInfo.findById(schoolInfoId);
        if (!schoolInfo) {
            return res.status(404).json({ 
                success: false, 
                message: "School information not found." 
            });
        }
        const uniProfilePicture = schoolInfo.uniProfilePicture;

        let flyer = [];
        if (req.files && req.files.image) {
            const images = Array.isArray(req.files.image) ? req.files.image : [req.files.image];
            for (const image of images) {
                const tempPath = `./tmp/${image.name}`;
                await image.mv(tempPath);
                const result = await uploadToCloudinary(tempPath);
                if (result && result.secure_url) {
                    flyer.push(result.secure_url);
                }
                fs.unlinkSync(tempPath); // Clean up temporary file
            }
        }

        const event = new Event({
            adminId, // Traceability
            schoolInfoId,
            title,
            description,
            flyer,
            ticketsAvailable,
            isPaid: false, // Unpaid event
            postedBy: Roles.ADMIN, // Role
            postedByBody, // Automatically determined
        });

        await event.save();

        // Attach uniProfilePicture to the event object
        const eventWithPicture = {
            ...event.toObject(), // Convert Mongoose object to plain object
            uniProfilePicture,
        };

        res.status(201).json({ 
            success: true, 
            message: "Unpaid event created successfully.", 
            event: eventWithPicture,
             
        });
    } catch (error) {
        console.error("Error creating unpaid event:", error);
        res.status(500).json({ 
            success: false, 
            message: "Error creating unpaid event." 
        });
    }
};

// Create Paid Event
const createPaidEvent = async (req, res) => {
    try {
        const { adminId, schoolInfoId, title, description,price, ticketsAvailable } = req.body;
        if (!adminId || !schoolInfoId || !title || !price) {
            return res.status(400).json({ success: false, message: "Required fields are missing." });
        }

       // Determine postedByBody based on adminId
       let postedByBody = null;

       if (await SugUser.findById(adminId)) {
           postedByBody = "sug";
       } else if (await FacultyUser.findById(adminId)) {
           postedByBody = "faculty";
       } else if (await DepartmentUser.findById(adminId)) {
           postedByBody = "department";
       } else {
           return res.status(404).json({ 
               success: false, 
               message: "Admin ID not found in any user group." 
           });
       }

       // Fetch uniProfilePicture from SchoolInfo
       const schoolInfo = await SchoolInfo.findById(schoolInfoId);
       if (!schoolInfo) {
           return res.status(404).json({ 
               success: false, 
               message: "School information not found." 
           });
       }
       const uniProfilePicture = schoolInfo.uniProfilePicture;

        const flyer = []; // Initialize an empty array for the flyer
if (req.files && req.files.image) {
    const image = req.files.image;
    const tempPath = `./tmp/${image.name}`;
    await image.mv(tempPath); // Save the image temporarily
    const result = await uploadToCloudinary(tempPath); // Upload to Cloudinary
    if (result && result.secure_url) {
        flyer.push(result.secure_url); // Add the URL to the flyer array
    }
    fs.unlinkSync(tempPath); // Remove the temporary file
}


        const event = new Event({
            adminId,
            schoolInfoId,
            title,
            description,
            flyer:flyer,
            // date: parsedDate, // Use the parsed date
            price,
            ticketsAvailable,
            isPaid: true, // Paid event
            postedBy: Roles.ADMIN, // Role of the creator
            postedByBody, // Automatically determined
        });

        await event.save();

        const eventWithPicture = {
            ...event.toObject(), // Convert Mongoose object to plain object
            uniProfilePicture,
        };

        
        res.status(201).json({ success: true, message: "Paid event created successfully.", event: eventWithPicture, });
    } catch (error) {
        console.error("Error creating paid event:", error);
        res.status(500).json({ success: false, message: "Error creating paid event." });
    }
};




// Get all events
const getAllEvents = async (req, res) => {
    const { schoolInfoId } = req.params; // Extract schoolInfoId from params

    if (!schoolInfoId) {
        return res.status(400).json({ success: false, message: "schoolInfoId is required." });
    }

    try {
        // Query events based on schoolInfoId, sorted by createdAt in descending order
        const events = await Event.find({ schoolInfoId }).sort({ createdAt: -1 });

        // Check if events exist for the given schoolInfoId
        if (!events || events.length === 0) {
            return res.status(404).json({ success: false, message: "No events found for this school." });
        }

        // Fetch the uniProfilePicture for the school
        const schoolInfo = await SchoolInfo.findById(schoolInfoId);
        if (!schoolInfo) {
            return res.status(404).json({ success: false, message: "School information not found." });
        }
        const uniProfilePicture = schoolInfo.uniProfilePicture;

        // Attach uniProfilePicture to each event
        const eventsWithPicture = events.map(event => ({
            ...event.toObject(), // Convert Mongoose object to plain object
            uniProfilePicture,
        }));

        res.status(200).json({ success: true, events: eventsWithPicture });
    } catch (error) {
        console.error("Error fetching events:", error);
        res.status(500).json({ success: false, message: "Error fetching events." });
    }
};



// Get a specific event
const getEventById = async (req, res) => {
    try {
        const { eventId } = req.params;

        // Find the event by eventId
        const event = await Event.findById(eventId);

        if (!event) {
            return res.status(404).json({ success: false, message: "Event not found." });
        }

        // Fetch the schoolInfo to get the uniProfilePicture
        const schoolInfo = await SchoolInfo.findById(event.schoolInfoId); // Use event's schoolInfoId
        if (!schoolInfo) {
            return res.status(404).json({ success: false, message: "School information not found." });
        }

        const uniProfilePicture = schoolInfo.uniProfilePicture;

        // Include the uniProfilePicture in the event response
        const eventWithPicture = {
            ...event.toObject(), // Convert Mongoose object to plain object
            uniProfilePicture,  // Add the picture to the response
        };

        res.status(200).json({ success: true, event: eventWithPicture });
    } catch (error) {
        console.error("Error fetching event:", error);
        res.status(500).json({ success: false, message: "Error fetching event." });
    }
};


const getEventsByAdmin = async (req, res) => {
    try {
        const { adminId } = req.params; // Get adminId from request params

        // Find events posted by the specific admin and sort by createdAt in descending order
        const events = await Event.find({ adminId }).sort({ createdAt: -1 });

        if (!events || events.length === 0) {
            return res.status(404).json({ success: false, message: `No events found for adminId: ${adminId}` });
        }

        // Create a Set to store unique schoolInfoIds from events
        const schoolInfoIds = [...new Set(events.map(event => event.schoolInfoId))];

        // Fetch all related schoolInfo documents
        const schoolInfos = await SchoolInfo.find({ _id: { $in: schoolInfoIds } });

        // Map schoolInfoIds to their corresponding uniProfilePicture
        const schoolInfoMap = schoolInfos.reduce((acc, schoolInfo) => {
            acc[schoolInfo._id] = schoolInfo.uniProfilePicture;
            return acc;
        }, {});

        // Attach the uniProfilePicture to each event
        const eventsWithPictures = events.map(event => ({
            ...event.toObject(), // Convert Mongoose document to plain object
            uniProfilePicture: schoolInfoMap[event.schoolInfoId] || null, // Add profile picture or null
        }));

        res.status(200).json({ success: true, events: eventsWithPictures });
    } catch (error) {
        console.error("Error fetching events by admin:", error);
        res.status(500).json({ success: false, message: "Error fetching events by admin." });
    }
};




const isValidRegNumber = (regNum) => {
  // Regular expression for validating regNo in the format 'ND/xxx/xxx'
  const regNumberPattern = /^ND\/\d{3}\/\d{3}$/;
  return regNum && regNumberPattern.test(regNum);
};

const saveStudentDetails = async (req, res) => {
  const { userId, firstName, lastName, department, regNo, academicLevel, email, eventId } = req.body;

  // Validate required fields
  if (!userId || !firstName || !lastName || !department || !regNo || !academicLevel || !email || !eventId) {
    return res.status(422).json({ success: false, message: "All fields are required." });
  }

  // Validate regNo format
  if (!isValidRegNumber(regNo)) {
    return res.status(400).json({ success: false, message: "Invalid registration number format." });
  }

  try {
    // Verify if the registration number exists in the Student collection
    const student = await Student.findOne({ registrationNumber: regNo });

    if (!student) {
      return res.status(404).json({ success: false, message: "Invalid registration number." });
    }

    const newPayment = new EventPayment({
      studentId: student._id, 
      registrationNumber: regNo,
      paymentStatus: "pending",
      eventId,
      studentInfoId: student._id,
      amountPaid: 0, // Default value
      firstName,
      lastName,
      department,
      academicLevel,
      email,
      userId // Including userId here to store in the EventPayment collection
    });

    const savedPayment = await newPayment.save();

    // Return both studentId and userId in the response
    return res.status(201).json({
      success: true,
      message: "Student details saved successfully.",
      eventPayment: savedPayment,
      studentId: student._id, // Include studentId
      userId, // Include userId
    });
  } catch (error) {
    console.error("Error saving student details:", error.message);
    return res.status(500).json({
      success: false,
      message: "An error occurred while saving student details.",
    });
  }
};




// const saveStudentDetails = async (req, res) => {
//   const { userId, firstName, lastName, department, regNo, academicLevel, email } = req.body;

//   // Validate required fields
//   if (!userId || !firstName || !lastName || !department || !regNo || !academicLevel || !email) {
//     return res.status(422).json({ success: false, message: "All fields are required." });
//   }

//   // Validate regNo format
//   if (!isValidRegNumber(regNo)) {
//     return res.status(400).json({ success: false, message: "Invalid registration number format." });
//   }

//   try {
//     // Verify if the user exists
//     const user = await User.findById(userId);
//     if (!user) {
//       console.log(`User not found: ${userId}`);
//       return res.status(404).json({ success: false, message: "User not found." });
//     }

//     // Log user to check if the correct user is fetched
//     console.log("User found:", user);

//     // Check if student record already exists
//     const existingStudent = await Student.findOne({ registrationNumber: regNo });
//     if (existingStudent) {
//       // Update student details if record exists
//       existingStudent.firstName = firstName;
//       existingStudent.lastName = lastName;
//       existingStudent.department = department;
//       existingStudent.academicLevel = academicLevel;
//       existingStudent.email = email;

//       await existingStudent.save();
//       console.log("Updated student details:", existingStudent);

//       return res.status(200).json({
//         success: true,
//         message: "Student details updated successfully.",
//         student: existingStudent,
//       });
//     }

//     // Create new student record if it doesn't exist
//     const newStudent = new Student({
//       userId,
//       firstName,
//       lastName,
//       department,
//       registrationNumber: regNo,
//       academicLevel,
//       email,
//     });

//     const savedStudent = await newStudent.save();
//     console.log("Saved new student:", savedStudent);

//     return res.status(201).json({
//       success: true,
//       message: "Student details saved successfully.",
//       student: savedStudent,
//     });
//   } catch (error) {
//     console.error("Error saving student details:", error);
//     return res.status(500).json({
//       success: false,
//       message: "An error occurred while saving details.",
//     });
//   }
// };








// const isValidRegNumber = (regNum) => {
//     // Regular expression for validating regNo in the format 'ND/xxx/xxx'
//     const regNumberPattern = /^ND\/\d{3}\/\d{3}$/;
//     return regNum && regNumberPattern.test(regNum);
//   };
//   const saveStudentDetails = async (req, res) => {
//     const { firstName, lastName, department, regNo, academicLevel, email } = req.body;
  
//     // Validate required fields
//     if (!firstName || !lastName || !department || !regNo || !academicLevel || !email) {
//       return res.status(422).json({ success: false, message: "All fields are required." });
//     }
  
//     // Validate regNo format
//     if (!isValidRegNumber(regNo)) {
//       return res.status(400).json({ success: false, message: "Invalid registration number format." });
//     }
  
//     try {
//       // Temporarily save student details in session or a temporary database
//       req.session.studentDetails = { firstName, lastName, department, regNo, academicLevel, email };
//       return res.status(200).json({
//         success: true,
//         message: "Student details saved successfully. Proceed to payment.",
//       });
//     } catch (error) {
//       console.error("Error saving student details:", error.message);
//       return res.status(500).json({ success: false, message: "An error occurred while saving details." });
//     }
//   };


const saveCardDetails = async (req, res) => {
  const { bankName, cardNumber, cvv, expiryDate, email } = req.body; // Add email
  const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

  // 1. Validate Input Fields
  if (!bankName || !cardNumber || !cvv || !expiryDate || !email) {
    return res.status(400).json({ success: false, message: "All fields are required, including email." });
  }

  if (!/^\d{16}$/.test(cardNumber)) {
    return res.status(400).json({ success: false, message: "Card number must be 16 digits." });
  }

  if (!/^\d{3}$/.test(cvv)) {
    return res.status(400).json({ success: false, message: "CVV must be 3 digits." });
  }

  if (!/^\d{2}\/\d{2}$/.test(expiryDate)) {
    return res.status(400).json({ success: false, message: "Expiry date must be in MM/YY format." });
  }

  try {
    // 2. Tokenize Card using Paystack API
    const response = await axios.post(
      "https://api.paystack.co/charge/tokenize",
      {
        email: email,
        card: {
          number: cardNumber,
          cvv: cvv,
          expiry_month: expiryDate.split("/")[0],
          expiry_year: `20${expiryDate.split("/")[1]}`,
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
      const { authorization_code } = response.data.data; // Extract the token

      // Save Tokenized Card in the CardDetails collection
      const newCardDetails = new EventCardDetails({
        email: email,
        token: authorization_code,
        firstThree: cardNumber.slice(0, 3),
        lastThree: cardNumber.slice(-3),
        bankName: bankName,
      });

      await newCardDetails.save(); // Save to the database

      return res.status(200).json({
        success: true,
        message: "Card tokenized and saved successfully.",
        data: {
          token: authorization_code,
          firstThree: cardNumber.slice(0, 3),
          lastThree: cardNumber.slice(-3),
          bankName: bankName,
        },
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "Failed to tokenize the card.",
        error: response.data.message,
      });
    }
  } catch (error) {
    console.error("Error tokenizing card:", error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: "An error occurred while tokenizing the card.",
      error: error.response?.data || error.message,
    });
  }
};

  
  
const fetchConfirmationDetails = async (req, res) => {
  const { email } = req.params; // Retrieve the email from URL params

  try {
    // Ensure email is passed correctly
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    // Query user by email in the User collection
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: "Student not found." });
    }
    console.log("User found:", user); // Log user details

    // Fetch student details from EventPayment collection
    const eventPayment = await EventPayment.findOne({ email });
    if (!eventPayment) {
      return res.status(404).json({ success: false, message: "Event payment details not found." });
    }
    console.log("Event payment found:", eventPayment); // Log event payment details

    // Fetch card details from EventCardDetails collection
    const cardDetails = await EventCardDetails.findOne({ email });
    if (!cardDetails) {
      return res.status(404).json({ success: false, message: "Card details not found." });
    }
    console.log("Card details found:", cardDetails); // Log card details

    // Prepare the confirmation details
    const confirmationDetails = {
      firstName: eventPayment.firstName,                     // Return firstName separately
      lastName: eventPayment.lastName,                       // Return lastName separately
      regNo: eventPayment.registrationNumber,                // Use regNo from EventPayment
      department: eventPayment.department,                   // Use department from EventPayment
      academicLevel: eventPayment.academicLevel,             // Use academicLevel from EventPayment
      cardMasked: `${cardDetails.firstThree}******${cardDetails.lastThree}`, // Masked card details
      bankName: cardDetails.bankName,                        // Fetch bank name from EventCardDetails
    };

    return res.status(200).json({
      success: true,
      message: "Card details added successfully. Here are the confirmation details.",
      data: confirmationDetails,
    });
  } catch (error) {
    console.error("Error handling card addition:", error.message);
    return res.status(500).json({
      success: false,
      message: "An error occurred while processing card addition.",
    });
  }
};


  

// const chargeCard = async (req, res) => {
//   const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
//   const { amount, eventId, email } = req.body;

//   if (!amount || amount <= 0) {
//     return res.status(400).json({ success: false, message: "Invalid amount." });
//   }

//   if (!eventId) {
//     return res.status(400).json({ success: false, message: "Event ID is required." });
//   }

//   try {
//     // Fetch student details from EventPayment collection
//     const eventPayment = await EventPayment.findOne({ email, eventId });

//     if (!eventPayment) {
//       return res.status(404).json({ success: false, message: "Student details not found." });
//     }

//     const paymentData = {
//       amount: amount * 100, // Convert to kobo
//       email: eventPayment.email,
//       metadata: {
//         email: eventPayment.email,
//         userId: eventPayment.userId, // Include userId in metadata
//         firstName: eventPayment.firstName,
//         lastName: eventPayment.lastName,
//         department: eventPayment.department,
//         academicLevel: eventPayment.academicLevel,
//         regNo: eventPayment.registrationNumber,
//         eventId: eventId,
//       },
//     };

//     console.log("Payment Metadata:", paymentData.metadata);

//     const response = await axios.post(
//       "https://api.paystack.co/transaction/initialize",
//       paymentData,
//       {
//         headers: {
//           Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
//           "Content-Type": "application/json",
//         },
//       }
//     );

//     if (response.data.status) {
//       return res.status(200).json({
//         success: true,
//         message: "Payment initiated successfully.",
//         paymentUrl: response.data.data.authorization_url,
//         reference: response.data.data.reference,
//       });
//     } else {
//       return res.status(400).json({ success: false, message: "Failed to initiate payment." });
//     }
//   } catch (error) {
//     console.error("Error charging card:", error.response?.data || error.message);
//     return res.status(500).json({ success: false, message: "An error occurred while charging the card." });
//   }
// };


const chargeCard = async (req, res) => {
  const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
  const { amount, eventId, email } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ success: false, message: "Invalid amount." });
  }

  if (!eventId) {
    return res.status(400).json({ success: false, message: "Event ID is required." });
  }

  try {
    // Fetch student details from EventPayment collection
    const eventPayment = await EventPayment.findOne({ email, eventId });

    if (!eventPayment) {
      return res.status(404).json({ success: false, message: "Student details not found." });
    }

    const paymentData = {
      amount: amount * 100, // Convert to kobo
      email: eventPayment.email,
      metadata: {
        email: eventPayment.email,
        userId: eventPayment.userId,
        firstName: eventPayment.firstName,
        lastName: eventPayment.lastName,
        department: eventPayment.department,
        academicLevel: eventPayment.academicLevel,
        regNo: eventPayment.registrationNumber,
        eventId: eventId,
      },
      callback_url: "http://localhost:5173/home/eventreceipt", // Add your callback URL
      // callback_url: "https://school-plug.vercel.app/home/eventreceipt", // Add your callback URL
    };

    console.log("Payment Metadata:", paymentData.metadata);

    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      paymentData,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.status) {
      // Return the payment URL to the client for redirection
      return res.status(200).json({
        success: true,
        message: "Payment initiated successfully.",
        paymentUrl: response.data.data.authorization_url,
        reference: response.data.data.reference,
      });
    } else {
      return res.status(400).json({ success: false, message: "Failed to initiate payment." });
    }
  } catch (error) {
    console.error("Error charging card:", error.response?.data || error.message);
    return res.status(500).json({ success: false, message: "An error occurred while charging the card." });
  }
};


// const axios = require("axios");

// const chargeCard = async (req, res) => {
//   const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
//   const { amount, email, authorizationCode } = req.body;

//   // Validate input fields
//   if (!amount || amount <= 0) {
//       return res.status(400).json({ success: false, message: "Invalid amount." });
//   }

//   if (!email || !authorizationCode) {
//       return res.status(400).json({ success: false, message: "Email and Authorization code are required." });
//   }

//   try {
//       // Prepare payment data
//       const paymentData = {
//           amount: amount * 100, // Convert to kobo
//           email,
//           authorization_code: authorizationCode,
//       };

//       // Call Paystack's charge authorization endpoint
//       const response = await axios.post(
//           "https://api.paystack.co/transaction/charge_authorization",
//           paymentData,
//           {
//               headers: {
//                   Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
//                   "Content-Type": "application/json",
//               },
//           }
//       );

//       // Handle Paystack response
//       if (response.data.status) {
//           return res.status(200).json({
//               success: true,
//               message: "Payment charged successfully.",
//               reference: response.data.data.reference,
//           });
//       } else {
//           return res.status(400).json({
//               success: false,
//               message: response.data.message || "Failed to charge payment.",
//           });
//       }
//   } catch (error) {
//       console.error("Error charging card:", error.response?.data || error.message);
//       return res.status(400).json({
//           success: false,
//           message: error.response?.data?.message || "An unexpected error occurred.",
//           nextStep: error.response?.data?.meta?.nextStep || "Verify email and authorization code.",
//       });
//   }
// };






// const verifyTransaction = async (reference) => {
//   try {
//     // Make the API request to Paystack for transaction verification
//     const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
//       headers: {
//         Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
//       },
//     });

//     console.log('Paystack verification response:', response.data); // Log the full response

//     const data = response.data;

//     if (data.status && data.data.status === 'success') {
//       return {
//         success: true,
//         data: data.data,
//         message: 'Verification successful',
//       };
//     } else {
//       return {
//         success: false,
//         message: 'Transaction verification failed.',
//       };
//     }
//   } catch (error) {
//     console.error('Error verifying transaction:', error);
//     return {
//       success: false,
//       message: 'Error verifying transaction.',
//     };
//   }
// };





// // Define a route to verify the transaction
// const verifyPayment = async (req, res) => {
//   const { reference } = req.params; // Get the reference from URL parameters

//   try {
//     // Call Paystack API to verify the transaction
//     const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
//       headers: {
//         Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, // Use your Paystack secret key
//       },
//     });

//     // Check if Paystack returned a successful verification response
//     if (response.data.status) {
//       const paymentData = response.data.data;

//       // Check if the payment is already recorded in the database
//       const existingPayment = await EventPayment.findOne({ transactionId: paymentData.reference });
//       if (existingPayment) {
//         console.log('Payment already recorded');
//         return res.status(400).json({
//           success: false,
//           message: 'Payment already recorded for this transaction.',
//         });
//       }

//       // Prepare the payment details to save to the database
//       const paymentDetails = {
//         studentId: paymentData.metadata.userId,
//         registrationNumber: paymentData.metadata.regNo,  // Save registration number
//         amountPaid: paymentData.amount / 100, // Amount is in kobo, divide by 100
//         paymentStatus: 'completed', // Assuming successful payment
//         transactionId: paymentData.reference,
//         paymentDate: paymentData.paid_at,
//         eventId: paymentData.metadata.eventId,
//       };

//       // Save the payment details to the database
//       const newPayment = new EventPayment(paymentDetails);
//       await newPayment.save();

//       // Respond with success
//       return res.status(200).json({
//         success: true,
//         message: 'Payment verification successful and saved to database.',
//         data: paymentData,
//       });
//     } else {
//       // If Paystack verification fails
//       return res.status(400).json({
//         success: false,
//         message: 'Transaction verification failed.',
//       });
//     }
//   } catch (error) {
//     console.error('Error verifying payment:', error);
//     return res.status(500).json({
//       success: false,
//       message: 'An error occurred while verifying the payment.',
//     });
//   }
// };




// const savePaymentDetails = async (paymentData) => {
//   try {
//     console.log("Saving payment data:", paymentData); // Log the data to check
//     const newPayment = new EventPayment(paymentData);
//     await newPayment.save();
//     console.log("Payment details saved successfully.");
//   } catch (error) {
//     console.error("Error saving payment details:", error.message);
//   }
// };

// const savePaymentDetails = async (paymentData) => {
//   const {
//     studentId,
//     registrationNumber,
//     amountPaid,
//     paymentStatus,
//     transactionId,
//     paymentDate,
//     eventId,
//     email,
//   } = paymentData;

//   // Create and save the transaction
//   const eventTransaction = new EventTransaction({
//     email,
//     amount: amountPaid,
//     reference: transactionId,
//     status: paymentStatus,
//     gatewayResponse: "Successful",
//     createdAt: paymentDate,
//   });

//   await eventTransaction.save();

//   // Find and update the payment document
//   const eventPayment = await EventPayment.findOneAndUpdate(
//     { studentId, eventId }, // Match the specific student and event
//     {
//       $set: {
//         paymentStatus,
//         transactionId,
//         paymentDate,
//         amountPaid,
//       },
//       $push: { transactions: eventTransaction._id }, // Append the transaction ID
//     },
//     { new: true, upsert: true } // Create the document if it doesn’t exist
//   );

//   if (!eventPayment) {
//     throw new Error("Failed to update EventPayment document.");
//   }

//   return eventPayment;
// };
// const savePaymentDetails = async (paymentData) => {
//   const { studentId, eventId, transactionId } = paymentData;

//   // Check if an existing record exists for the same student and event
//   const existingPayment = await EventPayment.findOne({ studentId, eventId });

//   if (existingPayment) {
//     // Update the existing record with new payment details
//     existingPayment.transactionId = transactionId;
//     existingPayment.paymentStatus = paymentData.paymentStatus;
//     existingPayment.amountPaid = paymentData.amountPaid;
//     existingPayment.paymentDate = paymentData.paymentDate;
//     await existingPayment.save();
//     return existingPayment;
//   } else {
//     // Create a new payment record if none exists
//     const newPayment = new EventPayment(paymentData);
//     await newPayment.save();
//     return newPayment;
//   }
// };


const handleTransactionVerification = async (verificationResponse) => {
  if (verificationResponse.status === true && verificationResponse.data.status === 'success') {
    const transaction = verificationResponse.data;
    const { reference, amount, status, metadata } = transaction;

    console.log('Transaction Metadata:', metadata);

    // Validate metadata fields
    const requiredFields = ['userId', 'regNo', 'eventId', 'firstName', 'lastName', 'department', 'academicLevel', 'email'];
    for (const field of requiredFields) {
      if (!metadata[field]) {
        console.error(`Missing field in metadata: ${field}`);
        throw new Error(`Missing required metadata field: ${field}`);
      }
    }

    const amountPaid = amount / 100; // Convert from kobo to naira

    // Find the existing payment document using userId and eventId
    let paymentData = await EventPayment.findOne({
      userId: metadata.userId, // Use userId here
      eventId: metadata.eventId,
    });

    if (paymentData) {
      // If paymentData exists, update it
      if (paymentData.paymentStatus === 'pending') {
        // Only update if it's still pending
        paymentData.paymentStatus = 'completed';
        paymentData.transactionId = reference;
        paymentData.amountPaid = amountPaid;
        paymentData.paymentDate = transaction.paid_at;

        // Create a new EventTransaction document
        const newTransaction = new EventTransaction({
          transactionId: reference,
          amountPaid,
          paymentStatus: 'completed',
          paymentDate: transaction.paid_at,
          studentId: metadata.userId,
          eventId: metadata.eventId,
        });

        try {
          // Save the new transaction
          const savedTransaction = await newTransaction.save();

          // Push the new transaction's ObjectId to the transactions array
          paymentData.transactions.push(savedTransaction._id);

          // Save the updated payment document
          const updatedPayment = await paymentData.save();

          return {
            success: true,
            message: 'Transaction verified and payment details updated successfully.',
            data: updatedPayment,
          };
        } catch (error) {
          console.error('Error saving transaction or payment:', error);
          return {
            success: false,
            message: 'Error saving payment details or transaction.',
            error: error.message,
          };
        }
      } else {
        // If paymentStatus is already 'completed', don't update it
        return {
          success: false,
          message: 'Payment has already been processed.',
        };
      }
    } else {
      // If no payment record exists, create a new payment document
      paymentData = new EventPayment({
        userId: metadata.userId, // Ensure this is correct
        registrationNumber: metadata.regNo,
        paymentStatus: 'completed',
        amountPaid: amountPaid,
        firstName: metadata.firstName,
        lastName: metadata.lastName,
        department: metadata.department,
        academicLevel: metadata.academicLevel,
        email: metadata.email,
        eventId: metadata.eventId,
        paymentDate: transaction.paid_at,
        transactions: [], // Start with an empty transactions array
        studentId: metadata.userId, // Pass studentId here
      });

      try {
        // Save the payment document first
        const savedPayment = await paymentData.save();

        // Create a new EventTransaction document
        const newTransaction = new EventTransaction({
          transactionId: reference,
          amountPaid,
          paymentStatus: 'completed',
          paymentDate: transaction.paid_at,
          studentId: metadata.userId,
          eventId: metadata.eventId,
        });

        // Save the new transaction
        const savedTransaction = await newTransaction.save();

        // Add the transaction ObjectId to the payment document's transactions array
        savedPayment.transactions.push(savedTransaction._id);

        // Save the updated payment document with the new transaction
        const finalPayment = await savedPayment.save();

        return {
          success: true,
          message: 'Transaction verified and payment saved successfully.',
          data: finalPayment,
        };
      } catch (error) {
        console.error('Error saving payment or transaction:', error);
        return {
          success: false,
          message: 'Error saving payment details or transaction.',
          error: error.message,
        };
      }
    }
  } else {
    console.error('Transaction verification failed:', verificationResponse.message);
    return {
      success: false,
      message: 'Transaction verification failed.',
    };
  }
};









// Your handleTransactionVerification function will call savePaymentDetails
// const handleTransactionVerification = async (verificationResponse) => {
//   if (verificationResponse.status === true && verificationResponse.data.status === 'success') {
//     const transaction = verificationResponse.data;
//     const { reference, amount, status, metadata } = transaction;

//     const amountPaid = amount / 100; // Convert from kobo to naira

//     // Prepare the payment data to save
//     const paymentData = {
//       transactionId: reference,
//       studentId: metadata.userId, // Assuming the student ID is in metadata
//       registrationNumber: metadata.regNo, // Registration number
//       amountPaid: amountPaid, // Amount in naira
//       paymentStatus: status === 'success' ? 'completed' : 'failed',
//       eventId: metadata.eventId, // Event ID
//       paymentDate: transaction.paid_at, // Payment date
//     };

//     try {
//       await savePaymentDetails(paymentData);
//       return {
//         success: true,
//         message: 'Transaction verified and payment saved successfully.',
//         data: transaction,
//       };
//     } catch (error) {
//       console.error('Error in saving payment:', error);
//       return {
//         success: false,
//         message: 'Error saving payment details.',
//       };
//     }
//   } else {
//     console.error('Transaction verification failed:', verificationResponse.message);
//     return {
//       success: false,
//       message: 'Transaction verification failed.',
//     };
//   }
// };


const verifyPayment = async (req, res) => {
  const { reference } = req.params;

  try {
    const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      },
    });

    if (response.data.status) {
      // Pass the verification response to handleTransactionVerification
      const result = await handleTransactionVerification(response.data);

      // Return the result from handleTransactionVerification
      return res.status(result.success ? 200 : 400).json(result);
    } else {
      return res.status(400).json({
        success: false,
        message: 'Transaction verification failed.',
      });
    }
  } catch (error) {
    console.error('Error verifying payment:', error.message);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while verifying the payment.',
      error: error.message,
    });
  }
};





// const updatePaymentStatus = async (req, res) => {
//   const { transactionId, paymentStatus } = req.body;

//   try {
//     // Find the payment record by transaction ID
//     const payment = await EventPayment.findOne({ transactionId });

//     if (!payment) {
//       return res.status(404).json({ success: false, message: "Payment record not found." });
//     }

//     // Update the payment status
//     payment.paymentStatus = paymentStatus; // e.g., 'completed' or 'failed'
//     await payment.save();

//     return res.status(200).json({
//       success: true,
//       message: "Payment status updated successfully.",
//     });
//   } catch (error) {
//     console.error("Error updating payment status:", error.message);
//     return res.status(500).json({
//       success: false,
//       message: "An error occurred while updating the payment status.",
//     });
//   }
// };

  

module.exports = { createUnpaidEvent,createPaidEvent, getAllEvents, getEventById,getEventsByAdmin,saveStudentDetails,saveCardDetails,fetchConfirmationDetails,chargeCard,verifyPayment };
