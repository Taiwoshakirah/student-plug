const SugUser = require("../models/schoolSug");
const schoolInfo = require("../models/schoolInfo");
const jwt = require("jsonwebtoken");
const { parsePhoneNumberFromString } = require("libphonenumber-js");
const crypto = require("crypto");
const cloudinary = require("../config/cloudinaryConfig");
const fs = require("fs");
const path = require("path");
const Faculty = require("../models/faculties");
const Student = require("../models/studentRegNo");
const csv = require("csv-parser");
const pdfParse = require("pdf-parse");
const readXlsxFile = require("read-excel-file/node");
const mammoth = require("mammoth"); 
const bcrypt = require('bcrypt')

const schoolSugSignup = async (req, res) => {
  const {
    sugFullName,
    email,
    phoneNumber,
    password,
    confirmPassword,
    agreedToTerms,
  } = req.body;

  // Convertion of agreedToTerms to boolean if it's a string
  const agreedToTermsBool = agreedToTerms === "true" || agreedToTerms === true;

  if (
    !sugFullName ||
    !email ||
    !phoneNumber ||
    !password ||
    !confirmPassword ||
    !agreedToTerms
  ) {
    return res.status(422).json({ message: "Input all fields" });
  }
  if (!agreedToTermsBool) {
    return res
      .status(400)
      .json({
        success: false,
        message: "You must agree to the terms and conditions",
      });
  }

  if (password !== confirmPassword) {
    return res
      .status(400)
      .json({ success: false, message: "Passwords do not match" });
  }

  const existingUser = await SugUser.findOne({ email });
  if (existingUser) {
    return res
      .status(409)
      .json({ success: false, message: "User already exists" });
  }

  try {
    const newUser = await SugUser.create({
      sugFullName,
      email,
      phoneNumber,
      password,
      agreedToTerms: agreedToTermsBool,
    });

    const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, {
      expiresIn: "3d",
    });
    return res.json({
      success: true,
      message: "User created successfully",
      data: newUser,
      token,
    });
  } catch (error) {
    console.error("Normal sign-up error:", error);
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res
        .status(400)
        .json({ success: false, message: `Duplicate ${field} provided` });
    }
    next(error);
  }
};

const schoolInformation = async (req, res) => {
  const { userId, university, state, aboutUniversity } = req.body;

  const uniProfilePicture = req.files ? req.files.uniProfilePicture : null;

  console.log("Received files:", req.files);

  if (!university || !state || !aboutUniversity) {
    return res
      .status(422)
      .json({ message: "All fields except the profile picture are required" });
  }

  // Check if the profile picture is provided
  if (!uniProfilePicture) {
    return res.status(422).json({ message: "Profile picture is required" });
  }

  try {
    const user = await SugUser.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Define a path to temporarily store the file
    const tempPath = `${process.env.UPLOAD_PATH}${uniProfilePicture.name}`;

    // Move the uploaded file to the desired location
    await uniProfilePicture.mv(tempPath);

    // uploading the file to Cloudinary
    const uploadResult = await cloudinary.uploader.upload(tempPath);

    const newSchoolInfo = new schoolInfo({
      userId,
      university,
      state,
      aboutUniversity,
      uniProfilePicture: uploadResult.secure_url,
    });

    await newSchoolInfo.save();

    // Optionally, delete the temporary file after uploading to Cloudinary
    fs.unlink(tempPath, (err) => {
      if (err) console.error("Error deleting temp file:", err);
    });

    res
      .status(201)
      .json({ message: "School information saved", newSchoolInfo });
  } catch (error) {
    console.error("Error saving school information:", error);
    res
      .status(500)
      .json({ message: "Server error", error: error.message || error });
  }
};

const uploadStudentsRegNo = async (req, res) => {
    // Ensure that facultyName[] is treated as an array
    let facultyNames = req.body.facultyName;

    if (!Array.isArray(facultyNames)) {
        facultyNames = [facultyNames];
    }

    console.log("Incoming faculty names:", facultyNames);

    if (!facultyNames || !facultyNames.length) {
        return res.status(400).send("At least one faculty must be selected.");
    }

    const faculties = await Faculty.find({}, { facultyName: 1 });
    console.log("Faculties in DB:", faculties);

    const facultyDocs = await Faculty.find({
        facultyName: { $in: facultyNames.map(name => new RegExp(name, 'i')) }
    });

    console.log("Faculty documents retrieved:", facultyDocs);

    if (facultyDocs.length === 0) {
        return res.status(404).send("No faculties found.");
    }

    if (!req.files || !req.files.file) {
        return res.status(400).send("No files were uploaded.");
    }

    const file = req.files.file;

    // Validating the uploaded file type
    const allowedMimeTypes = [
        "text/csv",
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
        return res.status(400).send("Please upload a valid CSV, PDF, or Excel file.");
    }

    const registrationNumbers = [];
    const tempPath = `${process.env.UPLOAD_PATH}/${file.name}`;

    // Move the uploaded file to the desired location
    await file.mv(tempPath);

    try {
        if (file.mimetype === "text/csv") {
            // Handle CSV file
            fs.createReadStream(tempPath)
                .pipe(csv())
                .on("data", (data) => {
                    const regNum = data.registrationNumber?.trim();
                    if (isValidRegNumber(regNum) && !registrationNumbers.includes(regNum)) {
                        registrationNumbers.push(regNum);
                    }
                })
                .on("end", () => {
                    console.log("Extracted registration numbers:", registrationNumbers);
                    handleFileProcessingEnd(registrationNumbers, facultyDocs, tempPath, res);
                });
        } else if (file.mimetype === "application/pdf") {
            // Handle PDF file
            const dataBuffer = fs.readFileSync(tempPath);
            const pdfData = await pdfParse(dataBuffer);
            const lines = pdfData.text.split("\n");

            // Extract registration numbers using a regex pattern
            const regNoPattern = /ND\/\d{3}\/\d{3}/; // Adjust this to fit the actual registration number format
            lines.forEach((line) => {
                const match = line.match(regNoPattern);
                if (match) {
                    const regNum = match[0].trim();
                    if (isValidRegNumber(regNum) && !registrationNumbers.includes(regNum)) {
                        registrationNumbers.push(regNum);
                    }
                }
            });
            console.log("Extracted registration numbers:", registrationNumbers);
            handleFileProcessingEnd(registrationNumbers, facultyDocs, tempPath, res);
        } else if (file.mimetype.includes("spreadsheet") || file.mimetype.includes("excel")) {
            // Handle Excel file
            const rows = await readXlsxFile(tempPath);
            rows.forEach((row) => {
                const regNum = row[0]?.trim(); // Assuming registration number is in column 1
                if (isValidRegNumber(regNum) && !registrationNumbers.includes(regNum)) {
                    registrationNumbers.push(regNum);
                }
            });
            // console.log("Extracted registration numbers:", registrationNumbers);
            handleFileProcessingEnd(registrationNumbers, facultyDocs, tempPath, res);
        }
    } catch (error) {
        console.error("Error processing file:", error);
        return res.status(500).send("Error processing file.");
    }
};

// Function to validate registration numbers
const isValidRegNumber = (regNum) => {
    // Adjust this logic to fit your specific registration number format
    const regNumberPattern = /^ND\/\d{3}\/\d{3}$/; // Example pattern for registration numbers like ND/123/001
    return regNum && regNumberPattern.test(regNum);
};

// Function to handle file processing completion and saving to the database
const handleFileProcessingEnd = async (registrationNumbers, facultyDocs, tempPath, res) => {
    try {
        console.log("Registration numbers being processed:", registrationNumbers);
        
        // For each faculty selected
        for (const faculty of facultyDocs) {
            const facultyId = faculty._id;

            // Find existing students in bulk for the current faculty
            const existingStudents = await Student.find({
                registrationNumber: { $in: registrationNumbers },
                faculty: facultyId
            });

            const existingRegNums = existingStudents.map(student => student.registrationNumber);

            // Iterate through the registration numbers
            for (const regNum of registrationNumbers) {
                if (!existingRegNums.includes(regNum)) {
                    const student = new Student({ registrationNumber: regNum, faculty: facultyId });
                    await student.save();
                } else {
                    console.log(`Student with registration number ${regNum} already exists for faculty ${faculty.facultyName}`);
                }
            }
        }

        // Optionally delete the temporary file
        fs.unlink(tempPath, (err) => {
            if (err) console.error("Error deleting temp file:", err);
        });

        res.status(200).send("Students registration numbers uploaded successfully for all selected faculties.");
    } catch (error) {
        console.error("Error saving students:", error);
        res.status(500).send("Error saving students.");
    }
};


  
const getFaculty = async (req, res) => {
  console.log("Received request for faculty:", req.params.name);
  try {
    const faculty = await Faculty.findOne({ facultyName: req.params.name });
    console.log("Found faculty:", faculty);
    if (!faculty) {
      return res.status(404).send("Faculty not found");
    }
    res.status(200).json(faculty);
  } catch (error) {
    console.error("Error fetching faculty:", error);
    res.status(500).send("Internal Server Error");
  }
};

const getSugUser = async (req, res) => {
    const { userId } = req.user; 

    try {
        
        const user = await SugUser.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Fetch school information based on userId
        const school = await schoolInfo.findOne({ userId });

        // Prepare the profile photo URL from the schoolInfo model
        const profilePhotoUrl = school?.uniProfilePicture || null;

        res.status(200).json({
            message: "Authenticated",
            user: {
                _id: user._id,
                name: user.fullName,
                email: user.email,
                profilePicture: profilePhotoUrl, 
            },
            schoolInfo: school || null, 
        });
    } catch (error) {
        console.error("Error fetching user or school information:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

  


  const schoolSugSignin = async (req, res) => {
    const { email, password } = req.body;
  
    if (!email || !password) {
      return res.status(422).json({ message: "Email and password are required" });
    }
  
    try {
      const user = await SugUser.findOne({ email });
      if (!user) {
        return res.status(400).json({ message: "No user with this email" });
      }
  
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return res.status(401).json({ message: "Password incorrect" });
      }
  
      // Fetch schoolInfo to get the profile picture
      const school = await schoolInfo.findOne({ userId: user._id });
      if (!school) {
        console.log("No school information found for this user.");
        return res.status(404).json({ message: "School information not found" });
      }
  
      // Extract the correct profile picture URL
      const profilePhotoUrl = school.uniProfilePicture || null;
      console.log("Fetched profile picture:", profilePhotoUrl); 
  
      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
        expiresIn: "3d",
      });
  
      res.status(200).json({
        token,
        user: {
          _id: user._id,
          email: user.email,
          avatar: profilePhotoUrl, 
        },
      });
    } catch (error) {
      console.error("Error during sign-in:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  };
  
  
  
  

module.exports = {
  schoolSugSignup,
  schoolInformation,
  uploadStudentsRegNo,
  getFaculty,
  getSugUser,
  schoolSugSignin
};
