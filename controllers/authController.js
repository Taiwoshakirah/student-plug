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

const admin = require('firebase-admin');

const signUp = async (req, res, next) => {
  const { idToken, fullName, email, phoneNumber, password, confirmPassword, agreedToTerms } = req.body;

  // Convert agreedToTerms to boolean if it's a string
  const agreedToTermsBool = agreedToTerms === "true" || agreedToTerms === true;

  if (!idToken && (!fullName || !email || !phoneNumber || !password || !confirmPassword || !agreedToTermsBool)) {
    return res.status(422).json({ success: false, message: "Input all fields" });
  }

  if (!agreedToTermsBool) {
    return res.status(400).json({ success: false, message: "You must agree to the terms and conditions" });
  }

  if (idToken) {
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken, true);
      console.log(decodedToken);

      const { uid, email: googleEmail, name, picture } = decodedToken;

      const existingUser = await User.findOne({ email: googleEmail });
      if (existingUser) {
        return res.status(409).json({ success: false, message: "User already exists" });
      }

      const newUser = await User.create({
        fullName: name || fullName,  
        email: googleEmail,
        googleId: uid,
        profilePicture: picture || null,  
        agreedToTerms: agreedToTermsBool,
      });

      const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, { expiresIn: "3d" });
      return res.json({ success: true, message: "User created successfully", data: newUser, token });

    } catch (error) {
      console.error("Google sign-up error:", error);
      if (error.code === "auth/id-token-revoked") {
        return res.status(401).json({ success: false, message: "Google ID token has been revoked" });
      }
      return res.status(401).json({ success: false, message: "Invalid Google ID token" });
    }
  } 

  // If Normal sign-up
  else {
    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: "Passwords do not match" });
    }

    // Check if the user already exists by email
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ success: false, message: "User already exists" });
    }

    try {
      // Create new user with normal sign-up details
      const newUser = await User.create({
        fullName,
        email,
        phoneNumber,
        password,  // Ensure that the password is hashed before saving (using bcrypt or similar)
        agreedToTerms: agreedToTermsBool,
      });

      // Generate JWT token for the user
      const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, { expiresIn: "3d" });
      return res.json({ success: true, message: "User created successfully", data: newUser, token });

    } catch (error) {
      console.error("Normal sign-up error:", error);
      if (error.code === 11000) {
        // Handle duplicate key error (e.g., email or phone number already exists)
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
  const {
    userId,
    university,
    course,
    department,
    level,
    yearOfAdmission,
    yearOfGraduation,
  } = req.body;

  if (
    !university ||
    !course ||
    !department ||
    !level ||
    !yearOfAdmission ||
    !yearOfGraduation
  ) {
    return res.status(422).json({ message: "All fields are required" });
  }

  if (!isValidDate(yearOfAdmission) || !isValidDate(yearOfGraduation)) {
    return res
      .status(400)
      .json({ message: "Invalid date format. Use dd/mm/yy" });
  }

  if (!validateAdmissionAndGraduationDates(yearOfAdmission, yearOfGraduation)) {
    return res
      .status(400)
      .json({ message: "Graduation date must be after admission date" });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const newStudentInfo = new StudentInfo({
      userId,
      university,
      course,
      department,
      level,
      yearOfAdmission: formatDate(yearOfAdmission),
      yearOfGraduation: formatDate(yearOfGraduation),
    });

    await newStudentInfo.save();
    res
      .status(201)
      .json({ message: "Student information saved", newStudentInfo });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

const uploadProfilePicture = async (req, res) => {
  try {
    console.log("Request Body:", req.body);
    console.log("Uploaded Files:", req.files);

    const { userId } = req.body; 
    const { skipUpload } = req.body;

    if (skipUpload) {
      return res.status(200).json({ message: "Profile picture upload skipped" });
    }

    if (!req.files || !req.files.profilePhoto) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const profilePhoto = req.files.profilePhoto;

    // Define the upload pat
    const uploadDir = path.join(__dirname, "uploads/profiles"); 
    const uploadPath = path.join(uploadDir, profilePhoto.name); 

    // Check if the uploads directory exists, and create it if it doesn't
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true }); 
    }

    // Use the mv method to move the file to the desired location
    await profilePhoto.mv(uploadPath); 

    const result = await cloudinary.uploader.upload(uploadPath, {
      folder: "profiles", 
      public_id: `${userId}_profile_photo_${Date.now()}`, 
      use_filename: true
    });

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
      user = await User.findOne({ email });
    }
  } else if (phoneNumber) {
    const parsedPhone = parsePhoneNumberFromString(phoneNumber, "NG");
    if (parsedPhone && parsedPhone.isValid()) {
      user = await User.findOne({ phoneNumber: parsedPhone.number });
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

  res.status(200).json({
    token,
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

    let user = await User.findOne({ googleId: uid });

    if (!user) {
      user = await User.create({
        googleId: uid,
        email,
        fullName: name,
        profilePhoto: picture,
        agreedToTerms: true,
      });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "3d" });

    return res.status(200).json({
      message: "Success",
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
  const { email, phoneNumber } = req.body;

  if (!email && !phoneNumber) {
    return res.status(400).json({ message: "Please provide either an email or phone number" });
  }

  try {
    let user;

    if (email) {
      user = await User.findOne({ email });
    } else if (phoneNumber) {
      user = await User.findOne({ phoneNumber });
    }

    if (!user) {
      return res.status(400).json({ message: "User with this email or phone number does not exist" });
    }

    // Generate a 4-digit reset code
    const resetCode = Math.floor(1000 + Math.random() * 9000).toString();

    // Hash the reset code and set expiration
    user.resetPasswordCode = crypto.createHash('sha256').update(resetCode).digest('hex');
    user.resetPasswordExpires = Date.now() + 10 * 60 * 1000; 
    await user.save();

    if (email) {
      const options = {
        email: email,
        subject: "Password Reset Code",
        text: `Your password reset code is ${resetCode}`,
      };
      await sendMail(options); 
    } else if (phoneNumber) {
      await sendSMS(phoneNumber, `Your password reset code is ${resetCode}`); 
    }

    res.status(200).json({ message: "Password reset code sent successfully" });
  } catch (error) {
    console.error("Error in forgotPassword:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const resetPassword = async (req, res, next) => {
  const { code, password } = req.body;

  if (!code || !password) {
    return res.status(400).json({ message: "Code and new password are required" });
  }

  try {
    const hashedCode = crypto.createHash('sha256').update(code).digest('hex');

    // Find user with matching reset code and check expiry
    const user = await User.findOne({
      resetPasswordCode: hashedCode,
      resetPasswordExpires: { $gt: Date.now() }, 
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired reset code" });
    }

    // Reset the password and clear the reset fields
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
  resetPassword,
  getUser,
};
