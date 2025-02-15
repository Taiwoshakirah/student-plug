const SugUser = require("../models/schoolSug");
const SchoolInfo = require("../models/schoolInfo");
const jwt = require("jsonwebtoken");
const { parsePhoneNumberFromString } = require("libphonenumber-js");
const crypto = require("crypto");
// const cloudinary = require("../config/cloudinaryConfig");
const cloudinary = require('../config/cloudinaryConfig')
const { uploadToCloudinary } = require("../config/cloudinaryConfig");
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
require('dotenv').config()
const { v4: uuidv4 } = require("uuid");
const requestId = uuidv4(); // Generates a unique ID
const axios = require('axios')




const schoolSugSignup = async (req, res, next) => {
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
            agreedToTerms,
            role: "admin", 
        });


        // Set session user ID 
        req.session.userId = newUser._id; 

        const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, { expiresIn: "3d" }); 

        res.json({
            success: true,
            message: "User created successfully, proceed to university info",
            userId: newUser._id,
            role:"admin",
            token 
        });
    } catch (error) {
        console.error("User signup error:", error);
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            return res.status(400).json({ success: false, message: "User already exists" });
        }
        next(error); 
    }
};

// process of generating virtual account starts here because of the helper functions



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
            preferredName: "SchoolPlug",
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
                accountName: payload.preferredName,  // Added this to return account name
                bankName: "FCMB",
            };
        } catch (error) {
            // console.error("Error creating virtual account:", error.response?.data || error.message);
            console.error("FCMB API Error:", error.response?.data || error.message);

            throw new Error("Failed to create virtual account.");
        }
    };


const schoolInformation = async (req, res, next) => {
    const { university, state, aboutUniversity, userId } = req.body;

    const uniProfilePicture = req.files ? req.files.uniProfilePicture : null;

    console.log("Received files:", req.files);

    if (!uniProfilePicture) {
        return res.status(422).json({ message: "Profile picture is required" });
    }
    
    if (!university || !state || !aboutUniversity) {
        return res.status(422).json({ message: "All school details are required" });
    }

    //  to temporarily store the file
    const tempPath = `${process.env.UPLOAD_PATH}${uniProfilePicture.name}`;

    // Moving the uploaded file to the desired location
    await uniProfilePicture.mv(tempPath);

    try {
        const uploadResult = await uploadToCloudinary(tempPath); 

        const imageUrl = uploadResult.secure_url; 

        

        // Generate FCMB Virtual Account
        // const virtualAccountNumber = await generateFCMBVirtualAccount({
        //     name: university,
        //     email: req.body.email,
        //     phoneNumber: req.body.phoneNumber,
        //   });

      // Define bank name 
    // const bankName = "FCMB";

    const { accountNumber, accountName, bankName } = await generateFCMBVirtualAccount({
        name: university,
        email: req.body.email,
        phoneNumber: req.body.phoneNumber,
    });
    

    const schoolData = await SchoolInfo.create({
        userId,
        university,
        state,
        aboutUniversity,
        uniProfilePicture: imageUrl, 
        faculties: [],
        students: [],
        virtualAccount: {
            accountNumber,
            accountName,
            bankName,
        },
    });

      // Update school information with virtual account details
      schoolData.virtualAccount = {
        accountNumber, 
       accountName,
       bankName,  
    };
    
    await schoolData.save();

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





const isValidRegNumber = (regNum) => {
    const regNumberPattern = /^ND\/\d{3}\/\d{3}$/;
    return regNum && regNumberPattern.test(regNum);
};

const extractFacultyNameFromLine = (line, faculties) => {
    for (const faculty of faculties) {
        if (line.toLowerCase().includes(faculty.facultyName.toLowerCase().trim())) {
            return faculty.facultyName;
        }
    }
    return null;
};

const processFacultyRegistrationNumbers = async (
    facultyRegMap,
    faculties,
    schoolInfoId,
    tempPath,
    res,
    schoolData
  ) => {
    try {
      // Ensure all faculties are included, even if no registration numbers are found
      faculties.forEach((faculty) => {
        facultyRegMap[faculty.facultyName] =
          facultyRegMap[faculty.facultyName] || [];
      });
  
      // Log results for debugging
      faculties.forEach((faculty) => {
        const facultyName = faculty.facultyName;
        const registrationNumbers = facultyRegMap[facultyName];
        console.log(
          `Processed ${registrationNumbers.length} registration numbers for ${facultyName}`
        );
      });
  
      const addedFaculties = []; // Keep track of faculties added to the school
  
      // Create or update students in the database
      for (const facultyName in facultyRegMap) {
        const faculty = faculties.find((f) => f.facultyName === facultyName);
  
        if (faculty) {
          const registrationNumbers = facultyRegMap[facultyName];
  
          // Add the faculty ID to the school's faculties array if not already present
          addedFaculties.push(faculty._id);
  
          for (const regNum of registrationNumbers) {
            // Check if the student already exists
            const existingStudent = await Student.findOne({
              registrationNumber: regNum,
            });
  
            if (!existingStudent) {
              // Create a new student document
              const newStudent = new Student({
                registrationNumber: regNum,
                faculty: faculty._id, // Reference to the faculty
                schoolInfo: schoolInfoId, // Reference to the schoolInfo
              });
  
              const savedStudent = await newStudent.save();
  
              // Add the new student to the school's students array
              await SchoolInfo.findByIdAndUpdate(
                schoolInfoId,
                { $push: { students: savedStudent._id } },
                { new: true } // Return updated document
              );
            }
          }
  
          console.log(
            `Processed ${registrationNumbers.length} registration numbers for ${facultyName}`
          );
        }
      }
  
      // Update the school's faculties array with unique faculties
      await SchoolInfo.findByIdAndUpdate(
        schoolInfoId,
        { $addToSet: { faculties: { $each: addedFaculties } } },
        { new: true } // Return the updated document
      );
  
      // Clean up the temporary file
      fs.unlinkSync(tempPath);
  
      // Respond with processed data
      return res.status(200).json({
        message: "Registration numbers processed successfully.",
        school: {
          ...schoolData.toObject(),
          students: schoolData.students.filter((student) => student !== null),
        },
        faculties: faculties.map((faculty) => ({
          id: faculty._id,
          name: faculty.facultyName,
        })),
        data: facultyRegMap,
      });
    } catch (error) {
      console.error("Error processing faculty registration numbers:", error);
  
      // Handle cleanup in case of an error
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
  
      return res
        .status(500)
        .json({ message: "Error processing registration numbers." });
    }
  };
  
  

const mergeFacultyLines = (lines) => {
    const mergedLines = [];
    let tempLine = "";

    // Loop through the parsed lines
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Check if the line contains a faculty name
        if (line.includes("Faculty of")) {
            // If there is an accumulated tempLine, push it to the mergedLines
            if (tempLine) {
                mergedLines.push(tempLine.trim());
            }
            // Start a new faculty line
            tempLine = line;
        } else {
            // Append additional information to the current faculty line
            tempLine += " " + line;
        }
    }

    // Add any remaining text to the result
    if (tempLine.trim()) {
        mergedLines.push(tempLine.trim());
    }

    return mergedLines;
};


const uploadStudentsRegNo = async (req, res) => {
    let facultyNames = req.body["facultyName[]"];
    if (!Array.isArray(facultyNames)) {
        facultyNames = facultyNames ? [facultyNames] : [];
    }

    if (!facultyNames || facultyNames.length === 0 || facultyNames[0] === undefined) {
        return res.status(400).send("At least one faculty must be selected.");
    }

    const { schoolInfoId } = req.body;
    let selectedFaculties = req.body["selectedFaculties[]"];
    selectedFaculties = Array.isArray(selectedFaculties) ? selectedFaculties : [selectedFaculties];
    selectedFaculties = selectedFaculties.filter((id) => mongoose.Types.ObjectId.isValid(id));

    if (selectedFaculties.length === 0) {
        return res.status(400).json({ message: "No valid faculties found for selection." });
    }

    const schoolData = await SchoolInfo.findById(schoolInfoId);
    // Remove null or invalid entries from students array
schoolData.students = schoolData.students.filter((student) => student !== null);
    if (!schoolData) {
        return res.status(400).json({ message: "School info not found" });
    }

    const faculties = await Faculty.find({ _id: { $in: selectedFaculties } });
    if (faculties.length === 0) {
        return res.status(400).json({ message: "No valid faculties found for selection" });
    }

    if (!req.files || !req.files.file) {
        return res.status(400).send("No files were uploaded.");
    }

    const file = req.files.file;
    const allowedMimeTypes = [
        "text/csv",
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
    ];
    if (!allowedMimeTypes.includes(file.mimetype)) {
        return res.status(400).send("Please upload a valid CSV, PDF, or Excel file.");
    }

    const tempPath = `${process.env.UPLOAD_PATH}/${file.name}`;
    await file.mv(tempPath);

    try {
        const facultyRegMap = faculties.reduce((acc, faculty) => {
            acc[faculty.facultyName] = [];
            return acc;
        }, {});

        if (file.mimetype === "text/csv") {
            fs.createReadStream(tempPath)
                .pipe(csv())
                .on("data", (data) => {
                    console.log("CSV Data Row:", data);
                    const regNum = data.registrationNumber?.trim();
                    const facultyName = data.facultyName?.trim();

                    if (isValidRegNumber(regNum) && facultyName) {
                        faculties.forEach((faculty) => {
                            if (faculty.facultyName.toLowerCase() === facultyName.toLowerCase()) {
                                facultyRegMap[faculty.facultyName].push(regNum);
                            }
                        });
                    }
                })
                .on("end", async () => {
                    await processFacultyRegistrationNumbers(
                        facultyRegMap,
                        faculties,
                        schoolInfoId,
                        tempPath,
                        res,
                        schoolData
                    );
                });
        } else if (file.mimetype === "application/pdf") {
            const dataBuffer = fs.readFileSync(tempPath);
            const pdfData = await pdfParse(dataBuffer);
            let lines = pdfData.text.split("\n");

            // Merge faculty lines before processing
            lines = mergeFacultyLines(lines);
            console.log("PDF Parsed Lines:", lines);

            const regNoPattern = /ND\/\d{3}\/\d{3}/;
            lines.forEach((line) => {
                const match = line.match(regNoPattern);
                if (match) {
                    const regNum = match[0].trim();
                    const facultyName = extractFacultyNameFromLine(line, faculties);

                    if (isValidRegNumber(regNum) && facultyName) {
                        facultyRegMap[facultyName].push(regNum);
                    }
                }
            });
            await processFacultyRegistrationNumbers(
                facultyRegMap,
                faculties,
                schoolInfoId,
                tempPath,
                res,
                schoolData
            );
        } else if (file.mimetype.includes("spreadsheet") || file.mimetype.includes("excel")) {
            const rows = await readXlsxFile(tempPath);
            console.log("Excel Rows:", rows);
            rows.forEach((row) => {
                const regNum = row[0]?.trim();
                const facultyName = row[1]?.trim();

                if (isValidRegNumber(regNum) && facultyName) {
                    faculties.forEach((faculty) => {
                        if (faculty.facultyName.toLowerCase() === facultyName.toLowerCase()) {
                            facultyRegMap[faculty.facultyName].push(regNum);
                        }
                    });
                }
            });
            await processFacultyRegistrationNumbers(
                facultyRegMap,
                faculties,
                schoolInfoId,
                tempPath,
                res,
                schoolData
            );
        }
    } catch (error) {
        console.error("Error processing file:", error);
        fs.unlinkSync(tempPath); // Cleanup temp file in case of error
        return res.status(500).send("Error processing file.");
    }
};





const addFaculty = async (req, res) => {
    const { facultyNames } = req.body; 

    if (!Array.isArray(facultyNames) || facultyNames.length === 0) {
        return res.status(400).json({ message: "An array of faculty names is required." });
    }

    try {
        const facultiesToAdd = facultyNames.map(name => ({ facultyName: name }));
        const newFaculties = await Faculty.insertMany(facultiesToAdd);
        
        res.status(201).json({ message: "Faculties added successfully.", newFaculties });
    } catch (error) {
        console.error("Error adding faculties:", error);
        res.status(500).json({ message: "Server error.", error: error.message });
    }
};






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
    if (!req.user) {
        return res.status(401).json({ message: "Token has expired or is invalid" });
    }

    const { userId } = req.user;

    try {
        const user = await SugUser.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const school = await schoolInfo.findOne({ userId });
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
  
      // Fetching schoolInfo to get the profile picture
      const school = await SchoolInfo.findOne({ userId: user._id });
      if (!school) {
        console.log("No school information found for this user.");
        return res.status(404).json({ message: "School information not found" });
      }
  
      // Extracting the correct profile picture URL
      const profilePhotoUrl = school.uniProfilePicture || null;
      console.log("Fetched profile picture:", profilePhotoUrl); 
  
      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
        expiresIn: "3d",
      });
      res.status(200).json({
        success: true,
        token,
        userId: user._id,
        message: "You have successfully signed in"
      });
  
    } catch (error) {
      console.error("Error during sign-in:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  };


  const getSugUserDetails = async (req, res) => {
    try {
        const userId = req.params.userId;

        if (!userId) {
            return res.status(400).json({ success: false, message: "User ID is required." });
        }

        // Fetching the user and populating schoolInfo along with faculties and students
        const user = await SugUser.findById(userId)
            .populate({
                path: 'schoolInfo',
                populate: [
                    { path: 'faculties', select: '_id facultyName' },  
                    {
                        path: 'students',
                        select: 'registrationNumber faculty',
                        populate: { path: 'faculty', select: '_id facultyName' } 
                    }
                ]
            });

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        if (!user.schoolInfo) {
            return res.status(404).json({ success: false, message: "School information not found for this user" });
        }

        // Filtering out of duplicate registration numbers in students
        const uniqueStudents = [];
        const seenRegistrationNumbers = new Set();

        user.schoolInfo.students.forEach(student => {
            if (!seenRegistrationNumbers.has(student.registrationNumber)) {
                seenRegistrationNumbers.add(student.registrationNumber);
                uniqueStudents.push({
                    registrationNumber: student.registrationNumber,
                });
            }
        });

        // Maping faculties to include both facultyId and facultyName
        const faculties = user.schoolInfo.faculties.map(faculty => ({
            facultyId: faculty._id,
            facultyName: faculty.facultyName 
        }));

        return res.status(200).json({
            success: true,
            message: "User data retrieved successfully",
            data: {
                user: {
                    fullName: user.sugFullName,
                    email: user.email,
                    phoneNumber: user.phoneNumber,
                    faculties: faculties, 
                    students: uniqueStudents
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

        if (email) {
            user = await SugUser.findOne({ email });
        }

        if (!user) {
            return res.status(400).json({ message: "User with this email does not exist" });
        }

        const resetCode = Math.floor(1000 + Math.random() * 9000).toString();

        user.resetPasswordCode = crypto.createHash('sha256').update(resetCode).digest('hex');
        user.resetPasswordExpires = Date.now() + 10 * 60 * 1000; 

        console.log("Hashed reset code saved:", user.resetPasswordCode);  
        console.log("Reset password expires at:", new Date(user.resetPasswordExpires)); 

        await user.save(); 

        // Send the plain-text reset code via email 
        if (email) {
            const options = {
                email: email,
                subject: "Password Reset Code",
                text: `Your password reset code is ${resetCode}`,  
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
        console.log("Hashed code provided by user:", hashedCode);  

        // Find the user with the hashed code and valid expiration time
        const user = await SugUser.findOne({
            resetPasswordCode: hashedCode,
            resetPasswordExpires: { $gt: Date.now() },
        });

        console.log("Current time:", Date.now());
        console.log("Expiration time:", user ? user.resetPasswordExpires : null); 

        if (!user) {
            console.log("User not found or code expired");
            return res.status(400).json({ message: "Invalid or expired reset code" });
        }

        console.log("User found for verification:", user);

        res.status(200).json({ message: "Code verified successfully", userId: user._id });
    } catch (error) {
        console.error("Error in verifyResetCode:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};


const schoolresetPassword = async (req, res, next) => {
    const { userId, password, confirmPassword } = req.body;
  
    if (!userId || !password || !confirmPassword) {
      return res.status(400).json({ message: "User ID, Password, and Confirm Password are required" });
    }
  
    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }
  
    try {
      const user = await SugUser.findById(userId);
  
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
  
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

  const getAllRegisteredSchools = async (req, res) => {
    console.log("Received request:", req.method, req.url);
    try {
        const schools = await SchoolInfo.find()
            .populate("faculties", "name")
            .populate("students", "name registrationNumber");

        console.log("Schools found:", schools);
        res.status(200).json({ message: "Schools fetched successfully", schools });
    } catch (error) {
        console.error("Error fetching schools:", error);
        res.status(500).json({ message: "Error fetching schools", error });
    }
};

// const generateRequestId = () => {
//     return uuidv4().replace(/[^a-zA-Z0-9]/g, "").slice(0, 16);
// };

// const sha512 = (input) => {
//     const hash = crypto.createHash("sha512");
//     hash.update(input, "utf8");
//     return hash.digest("hex");
// };

// const getXTokenHeader = (utcDate, clientID, password) => {
//     const date = utcDate.toISOString().replace("Z", ""); 
//     // const data = date + clientID + password;
//     const data = `${date}${clientID}${password}`;
//     return sha512(data);
// };

// const generateFCMBVirtualAccount = async () => {
//     const requestId = generateRequestId();
//     const utcDate = new Date();
//     const clientID = "250";
//     const password = "Tt9=dEB$4FdruOjlg1j1^sNR";
//     const utctimestamp = utcDate.toISOString().replace("Z", ""); 
//     const xToken = getXTokenHeader(utcDate, clientID, password);

//     console.log("Generated x-token:", xToken);

//     const payload = {
//         requestId: requestId,
//         collectionAccount: "1000058072",
//         preferredName: "OSB TEST",
//         clientId: clientID,
//         external_Name_Validation_Required: false,
//         productId: 34,
//     };

//     const config = {
//         method: "post",
//         url: "https://devapi.fcmb.com/ClientVirtualAcct/VirtualAccounts/v1/openVirtualAccount",
//         headers: {
//             "Content-Type": "application/json",
//             "Ocp-Apim-Subscription-Key": process.env.FCMB_SUBSCRIPTION_KEY,
//             "client_id": clientID,
//             "x-token": xToken,
//             "utctimestamp": utctimestamp, // Use corrected UTCTimestamp format
//         },
//         data: payload,
//     };

//     console.log("Request Headers:", config.headers);
//     console.log("Payload:", payload);

//     try {
//         const response = await axios(config);
//         console.log("Virtual account created successfully:", response.data);
//         return response.data.data; // Return response data
//     } catch (error) {
//         console.error("Error creating virtual account:", error.response?.data || error.message);
//         throw new Error("Failed to create virtual account.");
//     }
// };







  
  
  

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
  schoolresetPassword,
  getAllRegisteredSchools

};
