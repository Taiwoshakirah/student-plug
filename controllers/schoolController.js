const SugUser = require("../models/schoolSug");
const SchoolInfo = require("../models/schoolInfo");
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
const sendMail = require('../utils/sendMail')

const schoolSugSignup = async (req, res,next) => {
    const { sugFullName, email, phoneNumber, password, confirmPassword, agreedToTerms } = req.body;

    if (!sugFullName || !email || !phoneNumber || !password || !confirmPassword || !agreedToTerms) {
        return res.status(422).json({ message: "Input all fields" });
    }

    if (password !== confirmPassword) {
        return res.status(400).json({ success: false, message: "Passwords do not match" });
    }

    try {
        const newUser = await SugUser.create({
            sugFullName,
            email,
            phoneNumber,
            password,
            agreedToTerms
        });

        req.session.userId = newUser._id; 

        res.json({
            success: true,
            message: "User created successfully, proceed to university info",
            userId: newUser._id
        });
    } catch (error) {
        console.error("User signup error:", error);
        next(error);
    }
};

const schoolInformation = async (req, res, next) => {
    // const { userId } = req.body; 
    const { university, state, aboutUniversity,userId } = req.body;

    const uniProfilePicture = req.files ? req.files.uniProfilePicture : null;

    console.log("Received files:", req.files);

    if (!uniProfilePicture) {
        return res.status(422).json({ message: "Profile picture is required" });
    }
    
    if (!university || !state || !aboutUniversity) {
        return res.status(422).json({ message: "All school details are required" });
    }

    //path to temporarily store the file
    const tempPath = `${process.env.UPLOAD_PATH}${uniProfilePicture.name}`;

    // Moving the uploaded file to the desired location
    await uniProfilePicture.mv(tempPath);

    try {
        const uploadResult = await cloudinary.uploader.upload(tempPath);

        // Extracting the URL from the upload result
        const imageUrl = uploadResult.secure_url; // Cloudinary returns a secure URL for the image

        // Creating the school data with the image URL
        const schoolData = await SchoolInfo.create({
            userId,
            university,
            state,
            aboutUniversity,
            uniProfilePicture: imageUrl, 
            faculties: [],
            students: [] 
        });

        await SugUser.findByIdAndUpdate(userId, { schoolInfo: schoolData._id });

        res.json({
            success: true,
            message: "School details added, proceed to faculty selection",
            schoolData
        });
    } catch (error) {
        console.error("Add school details error:", error);
        return res.status(500).json({ message: "Server error" });
    }
};



const uploadStudentsRegNo = async (req, res) => {
    // Process facultyName as an array
    let facultyNames = req.body["facultyName[]"];
    if (!Array.isArray(facultyNames)) {
        facultyNames = facultyNames ? [facultyNames] : [];
    }

    console.log("Incoming faculty names:", facultyNames);

    if (!facultyNames || facultyNames.length === 0 || facultyNames[0] === undefined) {
        return res.status(400).send("At least one faculty must be selected.");
    }

    // Fetch school information and ensure selectedFaculties is an array
    const { schoolInfoId } = req.body;
    let selectedFaculties = req.body["selectedFaculties[]"];
    selectedFaculties = Array.isArray(selectedFaculties) ? selectedFaculties : [selectedFaculties];
    selectedFaculties = selectedFaculties.filter(id => mongoose.Types.ObjectId.isValid(id));
    console.log("Valid Selected Faculties:", selectedFaculties);

    if (selectedFaculties.length === 0) {
        return res.status(400).json({ message: "No valid faculties found for selection." });
    }

    const schoolData = await SchoolInfo.findById(schoolInfoId);
    if (!schoolData) {
        return res.status(400).json({ message: "School info not found" });
    }

    // Fetch all faculties based on selectedFaculties
    const faculties = await Faculty.find({ _id: { $in: selectedFaculties } });
    console.log("Selected faculties retrieved:", faculties);

    if (faculties.length === 0) {
        return res.status(400).json({ message: "No valid faculties found for selection" });
    }

    // Proceed with file upload and processing
    if (!req.files || !req.files.file) {
        return res.status(400).send("No files were uploaded.");
    }

    const file = req.files.file;
    const allowedMimeTypes = ["text/csv", "application/pdf", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel"];

    if (!allowedMimeTypes.includes(file.mimetype)) {
        return res.status(400).send("Please upload a valid CSV, PDF, or Excel file.");
    }

    const registrationNumbers = [];
    const tempPath = `${process.env.UPLOAD_PATH}/${file.name}`;
    await file.mv(tempPath);

    try {
        if (file.mimetype === "text/csv") {
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
                    handleFileProcessingEnd(registrationNumbers, faculties,schoolInfoId, tempPath, res);
                });
        } else if (file.mimetype === "application/pdf") {
            const dataBuffer = fs.readFileSync(tempPath);
            const pdfData = await pdfParse(dataBuffer);
            const lines = pdfData.text.split("\n");

            const regNoPattern = /ND\/\d{3}\/\d{3}/;
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
            handleFileProcessingEnd(registrationNumbers, faculties,schoolInfoId, tempPath, res);
        } else if (file.mimetype.includes("spreadsheet") || file.mimetype.includes("excel")) {
            const rows = await readXlsxFile(tempPath);
            rows.forEach((row) => {
                const regNum = row[0]?.trim();
                if (isValidRegNumber(regNum) && !registrationNumbers.includes(regNum)) {
                    registrationNumbers.push(regNum);
                }
            });
            handleFileProcessingEnd(registrationNumbers, faculties,schoolInfoId, tempPath, res);
        }
    } catch (error) {
        console.error("Error processing file:", error);
        return res.status(500).send("Error processing file.");
    }

    // Save selected faculties with school information
try {
    const updatedSchoolData = await SchoolInfo.findByIdAndUpdate(
        schoolInfoId,
        { $addToSet: { faculties: { $each: faculties.map(faculty => faculty._id) } } },
        { new: true } // This option returns the modified document
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
    const regNumberPattern = /^ND\/\d{3}\/\d{3}$/;
    return regNum && regNumberPattern.test(regNum);
};

// Function to handle file processing completion and saving to the database
const handleFileProcessingEnd = async (registrationNumbers, facultyDocs, schoolInfoId, tempPath, res) => {
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
                        schoolInfo: schoolInfoId,  // Link to schoolInfo
                    });
                } else {
                    console.log(`Student with registration number ${regNum} already exists for faculty ${faculty.facultyName}`);
                }
            }
        }

        let insertedStudents = [];
        if (studentsToInsert.length > 0) {
            try {
                // Insert students and retrieve the inserted documents
                insertedStudents = await Student.insertMany(studentsToInsert, { ordered: false });
                console.log(`Successfully inserted ${insertedStudents.length} students.`);
            } catch (error) {
                if (error.code === 11000) {
                    console.log("Duplicate registration numbers encountered during insertion.");
                } else {
                    throw error;
                }
            }
        }

        // Push the newly created students' IDs to the SchoolInfo document
        if (insertedStudents.length > 0) {
            await SchoolInfo.findByIdAndUpdate(
                schoolInfoId,
                { $push: { students: { $each: insertedStudents.map(student => student._id) } } }
            );
        }

        fs.unlink(tempPath, (err) => {
            if (err) console.error("Error deleting temp file:", err);
        });

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
      const school = await SchoolInfo.findOne({ userId: user._id });
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


  const getSugUserDetails = async (req, res) => {
    try {
        const userId = req.params.userId; // Getting user ID from URL params

        if (!userId) {
            return res.status(400).json({ success: false, message: "User ID is required." });
        }

        // Fetch the user and populate schoolInfo along with faculties and students
        const user = await SugUser.findById(userId)
            .populate({
                path: 'schoolInfo',
                populate: [
                    { path: 'faculties', select: 'name' },
                    {
                        path: 'students',
                        select: 'registrationNumber faculty',
                        populate: { path: 'faculty', select: 'name' }
                    }
                ]
            });

        console.log("User with populated schoolInfo:", user); // Log the user object

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Additional test query directly on SchoolInfo
        const schoolInfoTest = await SchoolInfo.findById(user.schoolInfo._id).populate({
            path: 'students',
            select: 'registrationNumber faculty',
            populate: { path: 'faculty', select: 'name' }
        });
        console.log("SchoolInfo test with students populated:", schoolInfoTest); // Log the populated SchoolInfo

        // Check if schoolInfo exists
        if (!user.schoolInfo) {
            return res.status(404).json({ success: false, message: "School information not found for this user" });
        }

        // Extracting student data along with registration numbers
        const students = user.schoolInfo.students.map(student => ({
            registrationNumber: student.registrationNumber,
            faculty: student.faculty ? student.faculty.name : null
        }));

        return res.status(200).json({
            success: true,
            message: "User data retrieved successfully",
            data: {
                user: {
                    fullName: user.sugFullName,
                    email: user.email,
                    phoneNumber: user.phoneNumber,
                    faculties: user.schoolInfo.faculties.map(faculty => ({
                        facultyId: faculty._id,
                        facultyName: faculty.name
                    })),
                    students // Including the students with their registration numbers
                },
                university: user.schoolInfo.university,
                state: user.schoolInfo.state,
                aboutUniversity: user.schoolInfo.aboutUniversity,
                uniProfilePicture: user.schoolInfo.uniProfilePicture
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};


  
  const schoolForgotPassword = async (req, res, next) => {
    const { email, resend } = req.body;

    if (!email) {
        return res.status(400).json({ message: "Please provide an email" });
    }

    try {
        let user;

        // Find the user by email 
        if (email) {
            user = await SugUser.findOne({ email });
        }

        if (!user) {
            return res.status(400).json({ message: "User with this email does not exist" });
        }

        // Generate a new 4-digit reset code (regenerate on every resend request)
        const resetCode = Math.floor(1000 + Math.random() * 9000).toString();

        // Hash the reset code and set expiration
        user.resetPasswordCode = crypto.createHash('sha256').update(resetCode).digest('hex');
        user.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10-minute expiration

        // Log the hashed code and expiration time for debugging
        console.log("Hashed reset code saved:", user.resetPasswordCode);  // Log the hashed code
        console.log("Reset password expires at:", new Date(user.resetPasswordExpires)); // Log the expiration time

        await user.save(); // Ensure that you are saving the user document

        // Send the plain-text reset code via email 
        if (email) {
            const options = {
                email: email,
                subject: "Password Reset Code",
                text: `Your password reset code is ${resetCode}`,  // Send the plain-text code
            };
            await sendMail(options);
        }

        res.status(200).json({ message: "Password reset code sent successfully" });
    } catch (error) {
        console.error("Error in forgotPassword:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};


const schoolverifyResetCode = async (req, res, next) => {
    const { code } = req.body;

    if (!code) {
        return res.status(400).json({ message: "Verification code is required" });
    }

    try {
        const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
        console.log("Hashed code provided by user:", hashedCode);  // Log the hashed code for comparison

        // Find the user with the hashed code and valid expiration time
        const user = await SugUser.findOne({
            resetPasswordCode: hashedCode,
            resetPasswordExpires: { $gt: Date.now() },
        });

        // Log the current time and the expiration time for debugging
        console.log("Current time:", Date.now());
        console.log("Expiration time:", user ? user.resetPasswordExpires : null); // Log if user is found

        if (!user) {
            console.log("User not found or code expired");
            return res.status(400).json({ message: "Invalid or expired reset code" });
        }

        // Log the found user details for debugging
        console.log("User found for verification:", user);

        // Return the user ID or a temporary token after code verification
        res.status(200).json({ message: "Code verified successfully", userId: user._id });
    } catch (error) {
        console.error("Error in verifyResetCode:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};


const schoolresetPassword = async (req, res, next) => {
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
      const user = await SugUser.findById(userId);
  
      if (!user) {
        return res.status(404).json({ message: "User not found" });
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
  schoolSugSignup,
  schoolInformation,
  uploadStudentsRegNo,
  addFaculty,
  getFaculty,
  getSugUser,
  schoolSugSignin,
  getSugUserDetails,
  schoolForgotPassword,
  schoolverifyResetCode,
  schoolresetPassword

};
