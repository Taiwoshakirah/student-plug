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
const sendMail = require('../utils/sendMail')
const { v4: uuidv4 } = require("uuid");
const requestId = uuidv4(); // Generates a unique ID
const crypto = require("crypto");




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

const API_URL = "https://api.paygateplus.ng/v2/transact";
const FIDELITY_API_KEY = process.env.FIDELITY_API_KEY;
const FIDELITY_API_SECRET = process.env.FIDELITY_API_SECRET;


const fidelityVirtualAccount = async ({ name, email, phoneNumber, schoolInfoId }) => {
  console.log("✅ Fidelity account name passed:", name);
  const requestRef = `REQ-${Date.now()}`;
  const transactionRef = `TXN-${Date.now()}`;

  const rawSignature = `${requestRef};${FIDELITY_API_SECRET}`;
  const signatureHash = crypto.createHash("md5").update(rawSignature).digest("hex");
  const customerRef = `${schoolInfoId}-${Date.now()}`;


  const payload = {
    request_ref: requestRef,
    request_type: "open_account",
    auth: {
      type: null,
      secure: null,
      auth_provider: "FidelityVirtual",
      route_mode: null,
    },
    transaction: {
      transaction_ref: transactionRef,
      transaction_desc: "Virtual account for event payment",
      transaction_ref_parent: null,
      amount: 0,
      customer: {
      customer_ref: customerRef, //  unique
      firstname: "Monieplug",
      surname: `${name}/Event`,
      email,
      mobile_no: phoneNumber,
    },
      // customer: {
      //   customer_ref: phoneNumber,
      //   firstname: "Monieplug",
      //   surname: `${name}/Event`,
      //   email,
      //   mobile_no: phoneNumber,
      // },
      meta: {
        a_key: "a_meta_value_1",
        b_key: "a_meta_value_2",
      },
      details: {
        name_on_account: `Monieplug/${name}/Event`,
        middlename: "",
        dob: "2000-01-01",
        gender: "M",
        title: "Mr",
        address_line_1: "2, Akoka, Yaba",
        address_line_2: "Ikorodu",
        city: "Ikeja",
        state: "Lagos",
        country: "Nigeria",
      },
    },
  };

  try {
    const response = await axios.post(API_URL, payload, {
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${FIDELITY_API_KEY}`,
    Signature: signatureHash,
  },
});

console.log("Fidelity Raw Data:", JSON.stringify(response.data, null, 2));
console.log("Full Payload You Sent:", JSON.stringify(payload, null, 2));

const providerResponse = response.data?.data?.provider_response;

if (!providerResponse?.account_number) {
  throw new Error("Fidelity virtual account number not returned in response.");
}

return {
  accountNumber: providerResponse.account_number,
  accountName: `Monieplug/${name}/Event`,
  // accountName: providerResponse.account_name || `Monieplug/${name}/Event`,
  bankName: providerResponse.bank_name || "Fidelity Bank",
  bankCode: providerResponse.bank_code || "070",
  rawResponse: providerResponse,
};


  } catch (error) {
    console.error("Error creating Fidelity virtual account:", error.message);
    if (error.response) {
      console.error("Response:", error.response.data);
    }
    throw new Error(error.response?.data?.message || "Failed to create Fidelity virtual account.");
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

// before saving event
const virtualAccount = await fidelityVirtualAccount({
  name: `${title} - ${postedByBody}`,
  email: schoolInfo.email,
  phoneNumber: schoolInfo.phoneNumber || "08000000000",
   schoolInfoId
});

// include in Event
const event = new Event({
  adminId,
  schoolInfoId,
  title,
  description,
  flyer,
  price,
  ticketsAvailable,
  isPaid: true,
  postedBy: Roles.ADMIN,
  postedByBody,
  virtualAccounts: {
          // fcmb: {
          //   accountNumber: fcmbAccount.accountNumber,
          //   accountName: fcmbAccount.accountName,
          //   bankName: fcmbAccount.bankName,
          // },
          fidelity: {
            accountNumber: virtualAccount.accountNumber,
            accountName: virtualAccount.accountName,
            bankName: virtualAccount.bankName,
          },
        },
  // virtualAccount: {
  //   accountNumber: virtualAccount.accountNumber,
  //   accountName: virtualAccount.accountName,
  //   bankName: virtualAccount.bankName
  // }
});


        // const event = new Event({
        //     adminId,
        //     schoolInfoId,
        //     title,
        //     description,
        //     flyer:flyer,
        //     // date: parsedDate, // Use the parsed date
        //     price,
        //     ticketsAvailable,
        //     isPaid: true, // Paid event
        //     postedBy: Roles.ADMIN, // Role of the creator
        //     postedByBody, // Automatically determined
        // });

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


const generateRequestId = () => {
  return uuidv4().replace(/[^a-zA-Z0-9]/g, "").slice(0, 16);
};

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

const generateFCMBVirtualAccount = async () => {
const requestId = generateRequestId();
const utcDate = new Date();
const clientID = "250";
const password = "Tt9=dEB$4FdruOjlg1j1^sNR";

//Format for header needs to be yyyy-MM-ddTHH:mm:ss.fff
const utctimestamp = utcDate.toISOString().replace("Z", "").slice(0, 23); 

const xToken = generateXToken(utcDate, clientID, password);

const payload = {
  requestId: requestId,
  collectionAccount: "1000058072",
  preferredName: "SchoolPlugEvent",
  clientId: clientID,
  external_Name_Validation_Required: false,
  productId: 34,
};

const config = {
  method: "post",
  url: "https://devapi.fcmb.com/ClientVirtualAcct/VirtualAccounts/v1/openVirtualAccount",
  headers: {
      "Content-Type": "application/json",
      "Ocp-Apim-Subscription-Key": process.env.FCMB_SUBSCRIPTION_KEY,
      "client_id": clientID,
      "x-token": xToken,
      "utctimestamp": utctimestamp
  },
  data: payload,
};

console.log("Request Headers:", config.headers);
console.log("Payload:", payload);

try {
  const response = await axios(config);
  console.log("Virtual account created successfully:", response.data);
  return {
      accountNumber: response.data.data,
      accountName: payload.preferredName,  
      bankName: "FCMB",
  };
} catch (error) {
  // console.error("Error creating virtual account:", error.response?.data || error.message);
  console.error("FCMB API Error:", error.response?.data || error.message);

  throw new Error("Failed to create virtual account.");
}
};



const verifyFidelitySignature = (requestRef, receivedSignature, secretKey) => {
  const hashInput = `${requestRef};${secretKey}`;
  const computedHash = crypto.createHash("md5").update(hashInput).digest("hex");
  return computedHash.toLowerCase() === receivedSignature.toLowerCase();
};


const fidelityWebhook = async (req, res) => {
  try {
    const payload = req.body;
    const receivedSignature = req.headers["signature"];
    const requestRef = payload.request_ref;

    if (!verifyFidelitySignature(requestRef, receivedSignature, process.env.FIDELITY_API_SECRET)) {
      return res.status(401).json({
        code: "F01",
        description: "Invalid webhook signature from Fidelity",
        data: {},
      });
    }

    console.log("Received Fidelity Webhook:", JSON.stringify(payload, null, 2));

    const details = payload.details || {};
    const data = details.data || {};
    const meta = details.meta || {};

    const senderAccountNumber = meta.originator_account_number || data.originatoraccountnumber;
    const senderAccountName = meta.originator_account_name || data.originatorname;
    const senderBank = meta.originator_bank_name || data.bankname;
    const accountNumber = meta.cr_account || data.craccount;
    const accountName = meta.cr_account_name || data.craccountname;
    const narration = meta.narration || data.narration;
    const reference = details.transaction_ref || data.paymentreference;
    const amount = String(details.amount || data.amount || "0");

    const transactionType = details.transaction_type || "collect";
    const status = details.status || data.statusmessage;
    const provider = details.provider || payload.requester;
    const customerRef = details.customer_ref || data.customer_mobile_no || "Unknown";
    const customerEmail = details.customer_email || "N/A";
    const transactionDesc = details.transaction_desc || data.narration;

    // Validate required fields
    if (!senderAccountNumber || !accountNumber || !amount || !reference) {
      return res.status(400).json({
        code: "F05",
        description: "Missing required fields from Fidelity webhook",
        data: {},
      });
    }

    // Saving to DB
    await FidelityNotification.create({
      amount,
      narration,
      accountNumber,
      accountName,
      senderAccountNumber,
      senderAccountName,
      senderBank,
      reference,
      transactionType,
      status,
      provider,
      customerRef,
      customerEmail,
      transactionDesc,
      webhookRaw: payload, 
    });

    await recordTransaction(senderAccountNumber);

    return res.status(200).json({
      success: true,
      message: "Fidelity transaction logged and recorded successfully",
      request_ref: requestRef,
      transaction_ref: reference,
    });

  } catch (error) {
    console.error("Fidelity webhook error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};




const isValidRegNumber = (regNum) => {
  // Regular expression for validating regNo in the format 'ND/xxx/xxx'
  const regNumberPattern = /^ND\/\d{3}\/\d{3}$/;
  return regNum && regNumberPattern.test(regNum);
};

const saveStudentDetails = async (req, res) => {
  const {
    userId,
    firstName,
    lastName,
    department,
    regNo,
    academicLevel,
    email,
    eventId,
    feeType,
    feeAmount,
    schoolInfoId,
    senderAccountNumber
  } = req.body;

  if (
    !userId ||
    !firstName ||
    !lastName ||
    !department ||
    !regNo ||
    !academicLevel ||
    !email ||
    !eventId ||
    !feeType ||
    !feeAmount ||
    !schoolInfoId ||
    !senderAccountNumber
  ) {
    return res.status(422).json({ success: false, message: "All fields are required." });
  }

  if (!isValidRegNumber(regNo)) {
    return res.status(400).json({ success: false, message: "Invalid registration number format." });
  }

  try {
    const student = await Student.findOne({ registrationNumber: regNo });

    if (!student) {
      return res.status(404).json({ success: false, message: "Invalid registration number." });
    }

    // const fcmbAccount = await generateFCMBVirtualAccount({
    //   email: req.body.email,
    //   phoneNumber: req.body.phoneNumber, 
    // });

    // Fetch school info
const school = await SchoolInfo.findById(schoolInfoId);
if (!school) {
  return res.status(404).json({ success: false, message: "Invalid schoolInfoId." });
}

// const phoneNumber = req.body.phoneNumber || "08000000000"
//     const fidelityAccount = await fidelityVirtualAccount({
//   name: school.university, 
//   email: req.body.email,
//   phoneNumber, 
// });
const event = await Event.findById(eventId);
if (!event) {
  return res.status(404).json({ success: false, message: "Event not found." });
}

const virtualAccount = event.virtualAccounts;
if (!virtualAccount) {
  return res.status(500).json({ success: false, message: "Event does not have a virtual account assigned." });
}



    const newPayment = await EventPayment.findOneAndUpdate(
  { registrationNumber: regNo, eventId },
  {
    studentId: student._id,
    registrationNumber: regNo,
    paymentStatus: "pending",
    eventId,
    studentInfoId: student._id,
    schoolInfoId,
    amountPaid: 0,
    firstName,
    lastName,
    department,
    academicLevel,
    email,
    userId,
    feeType,
    feeAmount,
    virtualAccounts: virtualAccount,
    senderAccountNumber  
  },
  { new: true, upsert: true }
);


    return res.status(201).json({
      success: true,
      message: "Student details saved successfully.",
      eventPayment: newPayment,
      virtualAccounts: newPayment.virtualAccounts,
      studentId: student._id,
      userId,
    });
  } catch (error) {
    console.error("Error saving student details:", error.message);
    return res.status(500).json({
      success: false,
      message: "An error occurred while saving student details.",
    });
  }
};




const fetchPaymentDetail = async (req, res) => {
  const { email, eventId } = req.query;

  if (!email || !eventId) {
    return res.status(400).json({ error: "Email and eventId are required" });
  }

  try {
    const studentDetails = await EventPayment.findOne({ email, eventId });

    console.log("Found student payment:", studentDetails ? {
      email: studentDetails.email,
      eventId: studentDetails.eventId,
      schoolInfoId: studentDetails.schoolInfoId
    } : "not found");

    if (!studentDetails) {
      return res.status(404).json({ error: "Student payment details not found for this event" });
    }

    if (!studentDetails.schoolInfoId) {
      return res.status(400).json({ error: "Student payment record is missing schoolInfoId" });
    }

    const schoolInfo = await SchoolInfo.findById(studentDetails.schoolInfoId);

    console.log("Found schoolInfo:", schoolInfo ? {
      _id: schoolInfo._id,
      university: schoolInfo.university
    } : "not found");

    if (!schoolInfo) {
      return res.status(404).json({ 
        error: "School information not found",
        searchedId: studentDetails.schoolInfoId
      });
    }

    const { accountNumber, accountName, bankName } =
  studentDetails.virtualAccounts?.fidelity || {};


    const serviceCharge = 100;
    const totalFee = parseFloat(studentDetails.feeAmount) + serviceCharge;

    res.status(200).json({
      success: true,
      student: {
        firstName: studentDetails.firstName,
        lastName: studentDetails.lastName,
        department: studentDetails.department,
        regNo: studentDetails.registrationNumber,
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
      firstName: eventPayment.firstName,                     
      lastName: eventPayment.lastName,                       
      regNo: eventPayment.registrationNumber,                
      department: eventPayment.department,                   
      academicLevel: eventPayment.academicLevel,             
      cardMasked: `${cardDetails.firstThree}******${cardDetails.lastThree}`, 
      bankName: cardDetails.bankName,                        
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

    // Fetch the admin user from SugUser based on the role or any criteria
    const adminUser = await SugUser.findOne({ role: "admin" });

    if (!adminUser || !adminUser.email) {
        return res.status(404).json({ success: false, message: "Admin email not found." });
    }

    // Send email to the admin once payment is processed
    const mailOptions = {
        email: adminUser.email, // Admin email for the school
        subject: `Payment Received for Event ${eventId}`,
        text: `A payment of ₦${amount} has been successfully made for event with ID: ${eventId}. Student Details:\nName: ${eventPayment.firstName} ${eventPayment.lastName}\nDepartment: ${eventPayment.department}\nRegistration No: ${eventPayment.registrationNumber}\nEmail: ${eventPayment.email}`,
    };

    // Call sendMail function to notify the admin
    await sendMail(mailOptions);

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

  //   // Send email to the admin once payment is processed
  //   const mailOptions = {
  //     email: process.env.ADMIN_EMAIL, // Admin email address
  //     subject: `Payment Received for Event ${eventId}`,
  //     text: `A payment of ₦${amount} has been successfully made for event with ID: ${eventId}. Student Details:\nName: ${eventPayment.firstName} ${eventPayment.lastName}\nDepartment: ${eventPayment.department}\nRegistration No: ${eventPayment.registrationNumber}\nEmail: ${eventPayment.email}`,
  // };

  // // Call sendMail function to notify the admin
  // await sendMail(mailOptions);

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

  

module.exports = { createUnpaidEvent,createPaidEvent, getAllEvents, getEventById,getEventsByAdmin,saveStudentDetails,fetchPaymentDetail,fetchConfirmationDetails,chargeCard,verifyPayment };
