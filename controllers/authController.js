const User = require("../models/signUp");
const jwt = require("jsonwebtoken");
const StudentInfo = require("../models/studentInfo");
const bcrypt = require("bcrypt");
const { parsePhoneNumberFromString } = require("libphonenumber-js");
const crypto = require("crypto");
const sendMail = require("../utils/sendMail");
const fs = require('fs')
const path = require("path");
const cloudinary = require('../config/cloudinaryConfig')
const {uploadToCloudinary} = require('../config/cloudinaryConfig.js')
const SchoolInfo = require('../models/schoolInfo')

const admin = require('firebase-admin');

const signUp = async (req, res, next) => {
  const { idToken, fullName, email, phoneNumber, password, confirmPassword, agreedToTerms } = req.body;
  
  // Convert agreedToTerms to boolean if it's a string
  const agreedToTermsBool = agreedToTerms === "true" || agreedToTerms === true;

  // Validate required fields for non-Google sign-up
  if (!idToken && (!fullName || !email || !phoneNumber || !password || !confirmPassword || !agreedToTermsBool)) {
    return res.status(422).json({ success: false, message: "Input all fields" });
  }

  if (!agreedToTermsBool) {
    return res.status(400).json({ success: false, message: "You must agree to the terms and conditions" });
  }

  // Google sign-up logic
  if (idToken) {
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken, true);
      const { uid, email: googleEmail, name, picture } = decodedToken;

      // Check if the user already exists
      const existingUser = await User.findOne({ email: googleEmail });
      if (existingUser) {
        if (existingUser.googleId) {
          return res.status(409).json({ success: false, message: "User already exists, please log in." });
        } else {
          return res.status(409).json({ success: false, message: "User exists with that email. Please log in or use Google to link your account." });
        }
      }

      // Create new user with Google sign-up details
      const newUser = await User.create({
        fullName: name,
        email: googleEmail,
        googleId: uid,
        profilePicture: picture || null,
        agreedToTerms: agreedToTermsBool,
      });

      const token = jwt.sign({ userId: newUser._id, schoolId: newUser.schoolInfoId }, process.env.JWT_SECRET, { expiresIn: "3d" });
      return res.json({ success: true, message: "User created successfully", data: newUser, token, redirectUrl: `/dashboard/school/${newUser.schoolInfoId}` });

    } catch (error) {
      console.error("Google sign-up error:", error);
      if (error.code === "auth/id-token-revoked") {
        return res.status(401).json({ success: false, message: "Google ID token has been revoked" });
      }
      return res.status(401).json({ success: false, message: "Invalid Google ID token" });
    }
  } else {
    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: "Passwords do not match" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ success: false, message: "User already exists" });
    }

    try {
      const newUser = await User.create({
        fullName,
        email,
        phoneNumber,
        password,
        agreedToTerms: agreedToTermsBool,
      });
      
      const redirectUrl = `/dashboard/school/${newUser.schoolInfoId}`;
      const token = jwt.sign({ userId: newUser._id, schoolId: newUser.schoolInfoId }, process.env.JWT_SECRET, { expiresIn: "3d" });
      return res.json({ success: true, message: "User created successfully", data: newUser, token, redirectUrl });

    } catch (error) {
      console.error("Normal sign-up error:", error);
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        return res.status(400).json({ success: false, message: `Duplicate ${field} provided` });
      }
      next(error);
    }
  }
};


const isValidDate = (date) => {
  const regex = /^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/;
  if (!regex.test(date)) {
    return false;
  }
  const [_, day, month, year] = regex.exec(date);
  const fullYear = year.length === 2 ? `20${year}` : year;
  const parsedDate = new Date(`${fullYear}-${month}-${day}`);
  return !isNaN(parsedDate.getTime());
};

const validateAdmissionAndGraduationDates = (admissionDate, graduationDate) => {
  const admission = formatDate(admissionDate);
  const graduation = formatDate(graduationDate);

  return admission < graduation;
};

const formatDate = (date) => {
  const [day, month, year] = date.split("/");
  const fullYear = year.length === 2 ? `20${year}` : year;
  return new Date(`${fullYear}-${month}-${day}`);
};


const studentInformation = async (req, res) => {
  const { userId, university, faculty, department, level, yearOfAdmission, yearOfGraduation } = req.body;

  if (!university || !faculty || !department || !level || !yearOfAdmission || !yearOfGraduation) {
    return res.status(422).json({ message: "All fields are required" });
  }

  if (!isValidDate(yearOfAdmission) || !isValidDate(yearOfGraduation)) {
    return res.status(400).json({ message: "Invalid date format. Use dd/mm/yy" });
  }

  if (!validateAdmissionAndGraduationDates(yearOfAdmission, yearOfGraduation)) {
    return res.status(400).json({ message: "Graduation date must be after admission date" });
  }

  try {
    // Find the user by ID
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Find the schoolInfo based on university name
    const schoolInfo = await SchoolInfo.findOne({ university }).exec();
    if (!schoolInfo) {
      return res.status(404).json({ message: "School not found" });
    }

    // Create new StudentInfo
    const newStudentInfo = new StudentInfo({
      userId,
      university,
      faculty,
      department,
      level,
      yearOfAdmission: formatDate(yearOfAdmission),
      yearOfGraduation: formatDate(yearOfGraduation),
      schoolInfoId: schoolInfo._id, // Assign correct schoolInfoId
    });

    // Save StudentInfo
    const savedStudentInfo = await newStudentInfo.save();

    // Update the user's schoolInfoId
    user.studentInfo = savedStudentInfo._id;
    user.schoolInfoId = schoolInfo._id;
    await user.save();

    // Redirect URL
    const redirectUrl = `/dashboard/school/${schoolInfo.university}`;

    res.status(201).json({
      message: "Student information saved",
      newStudentInfo: savedStudentInfo,
      redirectUrl,
    });
  } catch (error) {
    console.error("Error in studentInformation:", error);
    res.status(500).json({ message: "Server error", error });
  }
};






const uploadProfilePicture = async (req, res) => {
  try {
    console.log("Request Body:", req.body);
    console.log("Uploaded Files:", req.files);

    const { userId, skipUpload } = req.body;

    if (skipUpload) {
      return res.status(200).json({ message: "Profile picture upload skipped" });
    }

    if (!req.files || !req.files.profilePhoto) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const profilePhoto = req.files.profilePhoto;

    // Define the upload path
    const uploadDir = path.join(__dirname, "uploads/profiles");
    const uploadPath = path.join(uploadDir, profilePhoto.name);

    // Ensure the uploads directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Move the file to the desired location
    await profilePhoto.mv(uploadPath);

    // Upload to Cloudinary using the helper function
    const result = await uploadToCloudinary(uploadPath);

    const profilePhotoPath = result.secure_url;

    // Update the user's profile photo in the database
    await User.findByIdAndUpdate(userId, { profilePhoto: profilePhotoPath }, { new: true });

    return res.status(200).json({
      message: "Profile picture uploaded successfully",
      profilePhoto: profilePhotoPath
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};



// Middleware to fetch school-specific data
const getSchoolDashboard = async (req, res) => {
  // Extract userId from the decoded token
  const userId = req.user.userId; // Corrected to use userId instead of id
  try {
    // Check if user is authenticated
    if (!req.user || !userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    // Fetch the user from the database and populate the schoolInfoId field
    const user = await User.findById(userId).populate("schoolInfoId");

    // Check if the user exists
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if the user has associated school information
    if (!user.schoolInfoId) {
      return res.status(400).json({ message: "School information not available" });
    }

    // Generate the dashboard URL using the university field
    const schoolDashboardUrl = `/dashboard/${user.schoolInfoId.university}`;
    res.json({ redirectUrl: schoolDashboardUrl });
  } catch (error) {
    console.error("Error in getSchoolDashboard:", error);
    res.status(500).json({ message: "Server error" });
  }
};





const signin = async (req, res) => {
  const { email, phoneNumber, password } = req.body;

  if ((!email && !phoneNumber) || !password) {
    return res
      .status(422)
      .json({ message: "Email or phone number and password are required" });
  }

  let user;
  if (email) {
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (isEmail) {
      user = await User.findOne({ email }).populate("schoolInfoId"); // Populate schoolInfoId
    }
  } else if (phoneNumber) {
    const parsedPhone = parsePhoneNumberFromString(phoneNumber, "NG");
    if (parsedPhone && parsedPhone.isValid()) {
      user = await User.findOne({ phoneNumber: parsedPhone.number }).populate("schoolInfoId"); // Populate schoolInfoId
    }
  }

  if (!user) {
    return res
      .status(400)
      .json({ message: "No user with this email or phone number" });
  }

  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) {
    return res.status(401).json({ message: "Password incorrect" });
  }

  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
    expiresIn: "3d",
  });

  // Assuming user's schoolInfoId contains their university or school name
  const redirectUrl = `/dashboard/school/${user.schoolInfoId?.university}`;


  res.status(200).json({
    token,
    redirectUrl, // Add the redirect URL to the response
    user: {
      _id: user._id,
      email: user.email,
      phone: user.phone,
      avatar: user.profilePhoto,
    },
  });
};


const googleSignIn = async (req, res) => {
  const { idToken } = req.body;

  if (!idToken) {
    return res.status(400).json({ message: "ID token is required" });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { uid, email, name, picture } = decodedToken;

    // Check if the user already exists
    let user = await User.findOne({ googleId: uid }).populate("schoolInfoId"); // Populate schoolInfoId


    if (!user) {
      user = await User.create({
        googleId: uid,
        email,
        fullName: name,
        profilePhoto: picture,
        agreedToTerms: true,
      });
      // Re-query to populate schoolInfoId for the new user
      user = await User.findOne({ googleId: uid }).populate("schoolInfoId");
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "3d" });
    // Assuming user's schoolInfoId contains their university or school name
  const redirectUrl = `/dashboard/school/${user.schoolInfoId?.university}`;


    return res.status(200).json({
      message: "Success",
      redirectUrl, // Add the redirect URL to the response
      user: {
        _id: user._id,
        email: user.email,
        fullName: user.fullName,
        profilePhoto: user.profilePhoto,
      },
      token,
    });
  } catch (error) {
    console.error("Error during Google sign-in:", error.message, error.stack);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};


const getUser = async (req, res) => {
  try {
    const { userId } = req.user;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const studentInfo = await StudentInfo.findOne({ userId });

    const profilePhotoUrl = user.profilePhoto || null;

    res.status(200).json({
      message: "Authenticated",
      user: {
        _id: user._id,
        name: user.fullName,
        email: user.email,
        profilePhoto: profilePhotoUrl,
      },
      studentInfo,
    });

  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};





const forgotPassword = async (req, res, next) => {
  const { email, phoneNumber, resend } = req.body;

  if (!email && !phoneNumber) {
    return res.status(400).json({ message: "Please provide either an email or phone number" });
  }

  try {
    let user;

    // Find the user by email or phone number
    if (email) {
      user = await User.findOne({ email });
    } else if (phoneNumber) {
      user = await User.findOne({ phoneNumber });
    }

    if (!user) {
      return res.status(400).json({ message: "User with this email or phone number does not exist" });
    }

    // Block password reset for Google accounts
    if (user.googleId) {
      return res.status(400).json({ message: "Password reset is not allowed for Google accounts" });
    }

    // Generate a new 4-digit reset code (regenerate on every resend request)
    const resetCode = Math.floor(1000 + Math.random() * 9000).toString();

    // Hash the reset code and set expiration
    user.resetPasswordCode = crypto.createHash('sha256').update(resetCode).digest('hex');
    user.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10-minute expiration
    await user.save();

    // Send the plain-text reset code via email or SMS
    if (email) {
      const options = {
        email: email,
        subject: "Password Reset Code",
        text: `Your password reset code is ${resetCode}`,  // Send the plain-text code
      };
      await sendMail(options);
    } else if (phoneNumber) {
      await sendSMS(phoneNumber, `Your password reset code is ${resetCode}`);  // Send the plain-text code
    }

    res.status(200).json({ message: "Password reset code sent successfully" });
  } catch (error) {
    console.error("Error in forgotPassword:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};





const verifyResetCode = async (req, res, next) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ message: "Verification code is required" });
  }

  try {
    const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
    const user = await User.findOne({
      resetPasswordCode: hashedCode,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired reset code" });
    }

    // Return the user ID or a temporary token after code verification
    res.status(200).json({ message: "Code verified successfully", userId: user._id });
  } catch (error) {
    console.error("Error in verifyResetCode:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};





const resetPassword = async (req, res, next) => {
  const { userId, password, confirmPassword } = req.body;

  // Check for required fields
  if (!userId || !password || !confirmPassword) {
    return res.status(400).json({ message: "User ID, Password, and Confirm Password are required" });
  }

  // Ensure the passwords match
  if (password !== confirmPassword) {
    return res.status(400).json({ message: "Passwords do not match" });
  }

  try {
    // Find the user by userId
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Prevent password reset for Google accounts
    if (user.googleId) {
      return res.status(400).json({ message: "Password reset is not allowed for Google accounts" });
    }

    // Proceed with password reset
    user.password = password; 
    user.resetPasswordCode = undefined;  
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).json({ message: "Password reset successful" });
  } catch (error) {
    console.error("Error in resetPassword:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};




module.exports = {
  signUp,
  uploadProfilePicture,
  studentInformation,
  signin,
  googleSignIn,
  forgotPassword,
  verifyResetCode,
  resetPassword,
  getUser,
  getSchoolDashboard
};
