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
const mongoose = require('mongoose')

const schoolSugSignup = async (req, res,next) => {
    const {
        sugFullName,
        email,
        phoneNumber,
        password,
        confirmPassword,
        agreedToTerms,
        
    } = req.body;

    // Convert agreedToTerms to boolean if it's a string
    const agreedToTermsBool = agreedToTerms === "true" || agreedToTerms === true;

    // Input validation
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
        return res.status(400).json({
            success: false,
            message: "You must agree to the terms and conditions",
        });
    }

    if (password !== confirmPassword) {
        return res.status(400).json({ success: false, message: "Passwords do not match" });
    }

    const existingUser = await SugUser.findOne({ email });
    if (existingUser) {
        return res.status(409).json({ success: false, message: "User already exists" });
    }

    try {
        // Create new user in the database
        const newUser = await SugUser.create({
            sugFullName,
            email,
            phoneNumber,
            password,
            agreedToTerms: agreedToTermsBool,
        });

        // Store user ID temporarily (e.g., in session or cache)
        req.session.userId = newUser._id;  // Assuming you're using express-session

        const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, {
            expiresIn: "3d",
        });

        return res.json({
            success: true,
            message: "User created successfully, proceed to university info",
            data: newUser,
            token,
        });
    } catch (error) {
        console.error("Normal sign-up error:", error);
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            return res.status(400).json({ success: false, message: `Duplicate ${field} provided` });
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
  
      // Uploading the file to Cloudinary
      const uploadResult = await cloudinary.uploader.upload(tempPath);
  
      // Create a new school information document
      const newSchoolInfo = new schoolInfo({
        userId,
        university,
        state,
        aboutUniversity,
        uniProfilePicture: uploadResult.secure_url,
      });
  
      // Save the school information to the database
      await newSchoolInfo.save();
  
      // Store the schoolInfoId temporarily in the session
      req.session.schoolInfoId = newSchoolInfo._id;
  
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
    let facultyNames = req.body["facultyName[]"];
    if (!Array.isArray(facultyNames)) {
        facultyNames = facultyNames ? [facultyNames] : []; // If it's defined, convert to array, else make it empty
    }

    console.log("Incoming faculty names:", facultyNames);

    if (!facultyNames || facultyNames.length === 0 || facultyNames[0] === undefined) {
        return res.status(400).send("At least one faculty must be selected.");
    }

    // Fetch school information and ensure selectedFaculties is an array
    const { schoolInfoId } = req.body;
    let selectedFaculties = req.body["selectedFaculties[]"];
    
    // Convert selectedFaculties to an array if it isn’t already
    selectedFaculties = Array.isArray(selectedFaculties) ? selectedFaculties : [selectedFaculties];
    
    // Validate each ID in selectedFaculties to avoid CastError
    selectedFaculties = selectedFaculties.filter(id => mongoose.Types.ObjectId.isValid(id));
    console.log("Valid Selected Faculties:", selectedFaculties);

    if (selectedFaculties.length === 0) {
        return res.status(400).json({ message: "No valid faculties found for selection." });
    }

    const schoolData = await schoolInfo.findById(schoolInfoId);
    if (!schoolData) {
        return res.status(400).json({ message: "School info not found" });
    }

    // Fetch all faculties based on the selectedFaculties
    const faculties = await Faculty.find({
        _id: { $in: selectedFaculties },
    });

    console.log("Selected faculties retrieved:", faculties);

    if (faculties.length === 0) {
        return res.status(400).json({ message: "No valid faculties found for selection" });
    }

    // Proceed with file upload and processing
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
                    handleFileProcessingEnd(registrationNumbers, faculties, tempPath, res);
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
            handleFileProcessingEnd(registrationNumbers, faculties, tempPath, res);
        } else if (file.mimetype.includes("spreadsheet") || file.mimetype.includes("excel")) {
            // Handle Excel file
            const rows = await readXlsxFile(tempPath);
            rows.forEach((row) => {
                const regNum = row[0]?.trim(); // Assuming registration number is in column 1
                if (isValidRegNumber(regNum) && !registrationNumbers.includes(regNum)) {
                    registrationNumbers.push(regNum);
                }
            });
            handleFileProcessingEnd(registrationNumbers, faculties, tempPath, res);
        }
    } catch (error) {
        console.error("Error processing file:", error);
        return res.status(500).send("Error processing file.");
    }

    // Save the selected faculties with school information
    try {
        const updatedSchoolData = await schoolInfo.findByIdAndUpdate(
            schoolInfoId,
            { $addToSet: { faculties: { $each: faculties.map(faculty => faculty._id) } } }, // Save faculty IDs
            { new: true }
        );

        if (!updatedSchoolData) {
            return res.status(500).send("Failed to update school with selected faculties.");
        }

        return res.status(200).json({
            message: "Registration numbers processed and faculties updated successfully.",
            registrationNumbers,
            updatedSchoolData,
        });
    } catch (error) {
        console.error("Error updating school data:", error);
        return res.status(500).send("Error updating school data.");
    }
};

// Validate registration numbers
const isValidRegNumber = (regNum) => {
    const regNumberPattern = /^ND\/\d{3}\/\d{3}$/; // Example pattern for registration numbers like ND/123/001
    return regNum && regNumberPattern.test(regNum);
};

// Function to handle file processing completion and saving to the database
const handleFileProcessingEnd = async (registrationNumbers, facultyDocs, tempPath, res) => {
    try {
        console.log("Registration numbers being processed:", registrationNumbers);
        const studentsToInsert = [];

        for (const faculty of facultyDocs) {
            const facultyId = faculty._id;
            const existingStudents = await Student.find({
                registrationNumber: { $in: registrationNumbers },
                faculty: facultyId,
            });
            const existingRegNums = existingStudents.map(student => student.registrationNumber);

            for (const regNum of registrationNumbers) {
                if (!existingRegNums.includes(regNum)) {
                    studentsToInsert.push({
                        registrationNumber: regNum,
                        faculty: facultyId,
                    });
                } else {
                    console.log(`Student with registration number ${regNum} already exists for faculty ${faculty.facultyName}`);
                }
            }
        }

        // Insert the non-duplicate students in bulk
        if (studentsToInsert.length > 0) {
            try {
                await Student.insertMany(studentsToInsert, { ordered: false });
                console.log(`Successfully inserted ${studentsToInsert.length} students.`);
            } catch (error) {
                if (error.code === 11000) {
                    console.log("Duplicate registration numbers encountered during insertion.");
                } else {
                    throw error;
                }
            }
        }

        // Delete the temporary file
        fs.unlink(tempPath, (err) => {
            if (err) console.error("Error deleting temp file:", err);
        });

        // Ensure single response call
        if (!res.headersSent) {
            return res.status(200).send("Students registration numbers uploaded successfully for all selected faculties.");
        }
    } catch (error) {
        console.error("Error saving students:", error);
        if (!res.headersSent) {
            return res.status(500).send("Error saving students.");
        }
    }
};






// const addFaculty = async (req, res) => {
//     const { facultyName, schoolId } = req.body;

//     if (!facultyName || !schoolId) {
//         return res.status(400).json({ message: "Faculty name and school ID are required." });
//     }

//     try {
//         const newFaculty = new Faculty({ facultyName, schoolId });
//         await newFaculty.save();
//         res.status(201).json({ message: "Faculty added successfully.", newFaculty });
//     } catch (error) {
//         console.error("Error adding faculty:", error);
//         res.status(500).json({ message: "Server error.", error: error.message });
//     }
// };


const addFaculty = async (req, res) => {
    const { facultyNames } = req.body; // Expecting an array of faculty names

    if (!Array.isArray(facultyNames) || facultyNames.length === 0) {
        return res.status(400).json({ message: "An array of faculty names is required." });
    }

    try {
        // Create an array of faculty objects to be inserted
        const facultiesToAdd = facultyNames.map(name => ({ facultyName: name }));
        const newFaculties = await Faculty.insertMany(facultiesToAdd);
        
        res.status(201).json({ message: "Faculties added successfully.", newFaculties });
    } catch (error) {
        console.error("Error adding faculties:", error);
        res.status(500).json({ message: "Server error.", error: error.message });
    }
};




//, { _id: 1, facultyName: 1 }
  
// const getFaculty = async (req, res) => {
//     const { schoolId } = req.params;
//     try {
//         const faculties = await Faculty.find({ schoolId });
//         res.status(200).json(faculties);
//     } catch (error) {
//         console.error("Error fetching faculties:", error);
//         res.status(500).json({ message: "Error fetching faculties." });
//     }
// };

const getFaculty = async (req, res) => {
    try {
        const faculties = await Faculty.find({}, { facultyName: 1 });
        res.status(200).json(faculties);
    } catch (error) {
        console.error("Error fetching faculties:", error);
        res.status(500).json({ message: "Server error." });
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
  addFaculty,
  getFaculty,
  getSugUser,
  schoolSugSignin
};
