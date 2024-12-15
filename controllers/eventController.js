const fs = require('fs')
const Event = require("../models/event");
const {uploadToCloudinary} = require('../config/cloudinaryConfig')
const axios = require('axios')
const Roles = require("../middlewares/role");
const SugUser = require('../models/schoolSug')
const SchoolInfo = require('../models/schoolInfo')



// const createUnpaidEvent = async (req, res) => {
//     try {
//         const { adminId, schoolInfoId, title, description, ticketsAvailable } = req.body;

//         if (!adminId || !schoolInfoId || !title) {
//             return res.status(400).json({ success: false, message: "Required fields are missing." });
//         }

//         let flyer = [];
//         if (req.files && req.files.image) {
//             const images = Array.isArray(req.files.image) ? req.files.image : [req.files.image];
//             for (const image of images) {
//                 const tempPath = `./tmp/${image.name}`;
//                 await image.mv(tempPath);
//                 const result = await uploadToCloudinary(tempPath);
//                 if (result && result.secure_url) {
//                     flyer.push(result.secure_url);
//                 }
//                 fs.unlinkSync(tempPath); // Clean up temporary file
//             }
//         }

//         const event = new Event({
//             adminId, // Admin traceability
//             schoolInfoId,
//             title,
//             description,
//             flyer,
//             ticketsAvailable,
//             isPaid: false, // Unpaid event
//             postedBy: Roles.ADMIN, // Role of the creator
//         });

//         await event.save();
//         res.status(201).json({ success: true, message: "Unpaid event created successfully.", event });
//     } catch (error) {
//         console.error("Error creating unpaid event:", error);
//         res.status(500).json({ success: false, message: "Error creating unpaid event." });
//     }
// };



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
        const event = await Event.findById(eventId);

        if (!event) {
            return res.status(404).json({ success: false, message: "Event not found." });
        }

        res.status(200).json({ success: true, event });
    } catch (error) {
        console.error("Error fetching event:", error);
        res.status(500).json({ success: false, message: "Error fetching event." });
    }
};


const isValidRegNumber = (regNum) => {
    // Regular expression for validating regNo in the format 'ND/xxx/xxx'
    const regNumberPattern = /^ND\/\d{3}\/\d{3}$/;
    return regNum && regNumberPattern.test(regNum);
  };
  const saveStudentDetails = async (req, res) => {
    const { firstName, lastName, department, regNo, academicLevel, email } = req.body;
  
    // Validate required fields
    if (!firstName || !lastName || !department || !regNo || !academicLevel || !email) {
      return res.status(422).json({ success: false, message: "All fields are required." });
    }
  
    // Validate regNo format
    if (!isValidRegNumber(regNo)) {
      return res.status(400).json({ success: false, message: "Invalid registration number format." });
    }
  
    try {
      // Temporarily save student details in session or a temporary database
      req.session.studentDetails = { firstName, lastName, department, regNo, academicLevel, email };
      return res.status(200).json({
        success: true,
        message: "Student details saved successfully. Proceed to payment.",
      });
    } catch (error) {
      console.error("Error saving student details:", error.message);
      return res.status(500).json({ success: false, message: "An error occurred while saving details." });
    }
  };


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
          email: email, // Add email
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
      
        // Save Tokenized Card in Session
        req.session.cardDetails = {
          token: authorization_code, // Use the tokenized code
          firstThree: cardNumber.slice(0, 3),
          lastThree: cardNumber.slice(-3),
          bankName: bankName,
        };
      
        return res.status(200).json({
          success: true,
          message: "Card tokenized and saved successfully.",
          data: {
            token: authorization_code, // Include token in response
            firstThree: cardNumber.slice(0, 3),
            lastThree: cardNumber.slice(-3),
            bankName: bankName,
          },
        });
      }
       else {
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
    // Retrieve student and card details from session
    const studentDetails = req.session.studentDetails;
    const cardDetails = req.session.cardDetails;
  
    if (!studentDetails || !cardDetails) {
      return res.status(400).json({ success: false, message: "Missing student or card details." });
    }
  
    try {
      // Prepare confirmation details
      const confirmationDetails = {
        name: `${studentDetails.firstName} ${studentDetails.lastName}`,
        regNo: studentDetails.regNo,
        department: studentDetails.department,
        academicLevel: studentDetails.academicLevel,
        cardMasked: `${cardDetails.firstThree}******${cardDetails.lastThree}`,
      };
  
      // Send confirmation details to the frontend
      return res.status(200).json({
        success: true,
        message: "Confirmation details fetched successfully.",
        data: confirmationDetails,
      });
    } catch (error) {
      console.error("Error fetching confirmation details:", error.message);
      return res.status(500).json({ success: false, message: "An error occurred while fetching confirmation details." });
    }
  };
  

const chargeCard = async (req, res) => {
    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
  
    // Retrieve student details from session
    const studentDetails = req.session.studentDetails;
  
    if (!studentDetails) {
      return res.status(400).json({ success: false, message: "Missing student details." });
    }
  
    const { amount } = req.body;
  
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid amount." });
    }
  
    try {
      // Prepare payment data
      const paymentData = {
        amount: amount * 100, // Convert to kobo (₦1 = 100 kobo)
        email: studentDetails.email,
        metadata: { ...studentDetails },
      };
  
      // Initialize payment via Paystack
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
        return res.status(200).json({
          success: true,
          message: "Payment initiated successfully.",
          paymentUrl: response.data.data.authorization_url, // URL for the user to complete payment
        });
      } else {
        return res.status(400).json({ success: false, message: "Failed to initiate payment." });
      }
    } catch (error) {
      console.error("Error charging card:", error.response?.data || error.message);
      return res.status(500).json({ success: false, message: "An error occurred while charging the card." });
    }
  };
  
  
  
//   const purchaseTicket = async (req, res) => {
//     const { eventId } = req.params;
//     const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
  
//     // Retrieve saved student details
//     const studentDetails = req.session.studentDetails;
//     if (!studentDetails) {
//       return res.status(400).json({ success: false, message: "Student details not found. Please provide them again." });
//     }
  
//     try {
//       // Find the event by ID
//       const event = await Event.findById(eventId);
//       if (!event) {
//         return res.status(404).json({ success: false, message: "Event not found." });
//       }
  
//       // Check ticket availability
//       if (event.ticketsAvailable <= 0) {
//         return res.status(400).json({ success: false, message: "Tickets sold out." });
//       }
  
//       // Initiate Paystack payment
//       const paymentData = {
//         amount: event.price * 100, // Convert to kobo (₦1 = 100 kobo)
//         email: studentDetails.email,
//         metadata: {
//           ...studentDetails,
//           eventName: event.name,
//         },
//         callback_url: `${process.env.BASE_URL}/api/events/${eventId}/payment-callback`,
//       };
  
//       const response = await axios.post(
//         "https://api.paystack.co/transaction/initialize",
//         paymentData,
//         {
//           headers: {
//             Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
//             "Content-Type": "application/json",
//           },
//         }
//       );
  
//       if (response.data.status) {
//         return res.status(200).json({
//           success: true,
//           message: "Payment initiated successfully.",
//           paymentUrl: response.data.data.authorization_url,
//         });
//       } else {
//         return res.status(400).json({ success: false, message: "Failed to initiate payment." });
//       }
//     } catch (error) {
//       console.error("Error initiating payment:", error.response?.data || error.message);
//       res.status(500).json({ success: false, message: "An error occurred while initiating payment." });
//     }
//   };
  

// // Handle payment callback
// const handlePaymentCallback = async (req, res) => {
//     try {
//         const { reference } = req.query;
//         const response = await Paystack.transaction.verify(reference);

//         if (response.data.status === "success") {
//             // Reduce ticket availability
//             const eventId = response.data.metadata.eventId;
//             const event = await Event.findById(eventId);

//             if (!event) {
//                 return res.status(404).json({ success: false, message: "Event not found." });
//             }

//             event.ticketsAvailable -= 1;
//             await event.save();

//             res.status(200).json({ success: true, message: "Payment successful, ticket purchased." });
//         } else {
//             res.status(400).json({ success: false, message: "Payment verification failed." });
//         }
//     } catch (error) {
//         console.error("Error handling payment callback:", error);
//         res.status(500).json({ success: false, message: "Error handling payment callback." });
//     }
// };

// const handlePaymentCallback = async (req, res) => {
//     try {
//         const { eventId } = req.params;

//         const reference = req.query.reference;

//         // Verify payment
//         const verificationResponse = await Paystack.transaction.verify(reference);

//         if (verificationResponse.data.status === "success") {
//             const event = await Event.findById(eventId);

//             if (!event) {
//                 return res.status(404).json({ success: false, message: "Event not found." });
//             }

//             // Update ticket count
//             event.ticketsAvailable -= 1;
//             await event.save();

//             res.status(200).json({ success: true, message: "Payment successful, ticket purchased." });
//         } else {
//             res.status(400).json({ success: false, message: "Payment verification failed." });
//         }
//     } catch (error) {
//         console.error("Error handling payment callback:", error);
//         res.status(500).json({ success: false, message: "Error handling payment callback." });
//     }
// };


module.exports = { createUnpaidEvent,createPaidEvent, getAllEvents, getEventById,saveStudentDetails,saveCardDetails,fetchConfirmationDetails,chargeCard };
