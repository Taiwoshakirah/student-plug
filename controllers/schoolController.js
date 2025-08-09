const SugUser = require("../models/schoolSug");
const SchoolInfo = require("../models/schoolInfo");
const jwt = require("jsonwebtoken");
const { parsePhoneNumberFromString } = require("libphonenumber-js");
const crypto = require("crypto");
const cloudinary = require("../config/cloudinaryConfig");
const { uploadToCloudinary } = require("../config/cloudinaryConfig");
const fs = require("fs");
const path = require("path");
const Faculty = require("../models/faculties");
const Student = require("../models/studentRegNo");
const csv = require("csv-parser");
const pdfParse = require("pdf-parse");
const readXlsxFile = require("read-excel-file/node");
const mammoth = require("mammoth");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const sendMail = require("../utils/sendMail");
require("dotenv").config();
const { v4: uuidv4 } = require("uuid");
const requestId = uuidv4();
const axios = require("axios");

const schoolSugSignup = async (req, res, next) => {
  const {
    sugFullName,
    email,
    phoneNumber,
    password,
    confirmPassword,
    agreedToTerms,
  } = req.body;

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

  if (password !== confirmPassword) {
    return res
      .status(400)
      .json({ success: false, message: "Passwords do not match" });
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

    const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, {
      expiresIn: "3d",
    });

    res.json({
      success: true,
      message: "User created successfully, proceed to university info",
      userId: newUser._id,
      role: "admin",
      token,
    });
  } catch (error) {
    console.error("User signup error:", error);
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res
        .status(400)
        .json({ success: false, message: "User already exists" });
    }
    next(error);
  }
};



const generateToken = async () => {
    const tokenPayload = new URLSearchParams();
    tokenPayload.append('grant_type', 'client_credentials');
    tokenPayload.append('client_id', process.env.FCMB_CLIENT_ID);
    tokenPayload.append('client_secret', process.env.FCMB_CLIENT_SECRET);
    tokenPayload.append('scope', 'profile');
  
    try {
      const tokenResponse = await axios({
        method: 'post',
        url: 'https://baas.dev.getrova.co.uk/token',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: tokenPayload
      });
  
      return tokenResponse.data.access_token;
    } catch (error) {
      console.error('Token generation error:', error.response?.data || error.message);
      throw new Error('Failed to generate token');
    }
  };

const generateFCMBVirtualAccount = async ({ name, email, phoneNumber }) => {
  try {
    // Generate new token
    const token = await generateToken();
    
    // Format the account name as Monieplug/schoolname/SUG
    const formattedAccountName = `Monieplug/${name}/SUG`;
    
    const payload = {
      email: email || "cantoned.field@gmail.com",
      firstName: "Monieplug",
      lastName: `${name}/SUG`,
      phone: phoneNumber || 52767210801,
    };

    const config = {
      method: "post",
      url: "https://baas.dev.getrova.co.uk/virtual-account/static",
      headers: {
        "x-organization-id": "test_client",
        "authorization": `Bearer ${token}`, 
      },
      data: payload,
    };

    const response = await axios(config);
    
    const { successfulVirtualAccounts } = response.data.data;

    if (!successfulVirtualAccounts || successfulVirtualAccounts.length === 0) {
      throw new Error("No successful virtual accounts were created.");
    }

    const virtualAccount = successfulVirtualAccounts[0];
    
    if (!virtualAccount.virtualAccountNumber) {
      throw new Error("No account number found in the response.");
    }

    return {
      accountNumber: virtualAccount.virtualAccountNumber,
      accountName: formattedAccountName,
      bankName: "FCMB"
    };
  } catch (error) {
    console.error("FCMB API Error:", error.response?.data || error.message);
    throw new Error("Failed to create virtual account.");
  }
};



const API_URL = "https://api.paygateplus.ng/v2/transact";
const FIDELITY_API_KEY = process.env.FIDELITY_API_KEY;
const FIDELITY_API_SECRET = process.env.FIDELITY_API_SECRET;


const createFidelityVirtualAccount = async ({ name, email, phoneNumber }) => {
  const requestRef = `REQ-${Date.now()}`;
  const transactionRef = `TXN-${Date.now()}`;

  // Generating MD5 signature
  const rawSignature = `${requestRef};${FIDELITY_API_SECRET}`;
  const signatureHash = crypto.createHash("md5").update(rawSignature).digest("hex");

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
      transaction_desc: "Virtual account for school",
      transaction_ref_parent: null,
      amount: 0,
      customer: {
        customer_ref: phoneNumber,
        firstname: "Monieplug",
        surname: `${name}/SUG`,
        email,
        mobile_no: phoneNumber,
      },
      meta: {
        a_key: "a_meta_value_1",
        b_key: "a_meta_value_2",
      },
      details: {
        name_on_account: `Monieplug/${name}/SUG`,
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

    const providerResponse = response.data?.data?.provider_response;

if (!providerResponse?.account_number) {
  throw new Error("Fidelity virtual account number not returned in response.");
}

return {
  accountNumber: providerResponse.account_number,
  accountName: `Monieplug/${name}/SUG`,
  // accountName: providerResponse.account_name || `Monieplug/${name}/SUG`,
  bankName: providerResponse.bank_name || "Fidelity Bank",
  bankCode: providerResponse.bank_code || "070",
  rawResponse: providerResponse,
};


    return {
      accountNumber: accountData.account_number,
      accountName: `Monieplug/${name}/SUG`,
      bankName: "Fidelity Bank",
      bankCode: accountData.bank_code || "070",
      rawResponse: accountData,
    };
  } catch (error) {
    console.error("Error creating Fidelity virtual account:", error.message);
    if (error.response) {
      console.error("Response:", error.response.data);
    }
    throw new Error(error.response?.data?.message || "Failed to create Fidelity virtual account.");
  }
};



  

  const schoolInformation = async (req, res, next) => {
  try {
    const { university, state, aboutUniversity, userId, email, phoneNumber } = req.body;
    const uniProfilePicture = req.files ? req.files.uniProfilePicture : null;

    if (!uniProfilePicture) {
      return res.status(422).json({ message: "Profile picture is required" });
    }

    if (!university || !state || !aboutUniversity) {
      return res.status(422).json({ message: "All school details are required" });
    }

    const tempPath = `${process.env.UPLOAD_PATH}${uniProfilePicture.name}`;
    await uniProfilePicture.mv(tempPath);

    const uploadResult = await uploadToCloudinary(tempPath);
    const imageUrl = uploadResult.secure_url;

    // Check if school already exists with a virtual account
    const existingSchool = await SchoolInfo.findOne({ university });

    let virtualAccountDetails;
    let fidelityVirtualAccountDetails;

    if (existingSchool) {
      // Reuse existing accounts
      virtualAccountDetails = existingSchool.virtualAccount;
      fidelityVirtualAccountDetails = existingSchool.OtherVirtualAccount;
    } else {
      // Generate FCMB & Fidelity virtual accounts
      virtualAccountDetails = await generateFCMBVirtualAccount({
        name: university,
        email,
        phoneNumber,
      });

      fidelityVirtualAccountDetails = await createFidelityVirtualAccount({
        name: university,
        email,
        phoneNumber,
      });
    }

    // Create new school if not already created
    const schoolData = existingSchool || await SchoolInfo.create({
      userId,
      university,
      state,
      aboutUniversity,
      uniProfilePicture: imageUrl,
      faculties: [],
      students: [],
      virtualAccount: virtualAccountDetails,
      OtherVirtualAccount: fidelityVirtualAccountDetails,
    });

    await SugUser.findByIdAndUpdate(userId, { schoolInfo: schoolData._id });

    return res.json({
      success: true,
      message: "School details added, proceed to faculty selection",
      schoolData,
    });

  } catch (error) {
    console.error("Add school details error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to add school details",
      error: error.message,
    });
  }
};




const isValidRegNumber = (regNum) => {
  if (!regNum || typeof regNum !== 'string') {
    return false;
  }
  
  const trimmedRegNum = regNum.trim();
  
  // More flexible patterns to match your actual data
  const validPatterns = [
    /^ND\/\d{2,4}\/\d{2,4}$/,        
    /^[A-Z]{2,3}\/\d{2,4}\/\d{2,4}$/,  
    /^\d{2,3}\/\d{2,4}\/\d{2,4}$/     
  ];
  
  const isValid = validPatterns.some(pattern => pattern.test(trimmedRegNum));
  
  // Additional checks
  if (isValid) {
    // Check minimum length to avoid very short numbers
    if (trimmedRegNum.length < 7) {
      console.log(`Rejecting too short: ${trimmedRegNum}`);
      return false;
    }
    
    // Check if it contains only valid characters
    if (!/^[A-Z0-9\/]+$/i.test(trimmedRegNum)) {
      console.log(`Rejecting invalid characters: ${trimmedRegNum}`);
      return false;
    }
    
    return true;
  }
  
  console.log(`Rejecting invalid format: ${trimmedRegNum}`);
  return false;
};

// // Test your validation
// console.log('Testing validation:');
// console.log('ND/126/199:', isValidRegNumber('ND/126/199'));   // Should be true
// console.log('ND/126/1999:', isValidRegNumber('ND/126/1999')); // Should be true
// console.log('ND/001/001:', isValidRegNumber('ND/001/001'));   // Should be true

const extractFacultyNameFromLine = (line, faculties) => {
  console.log(`Extracting faculty from line: "${line}"`);
  for (const faculty of faculties) {
    if (line.toLowerCase().includes(faculty.facultyName.toLowerCase().trim())) {
      return faculty.facultyName;
    }
  }
   const extractedFaculty = faculties.find((faculty) =>
     line.toLowerCase().includes(faculty.facultyName.toLowerCase().trim())
   );
  console.log(`Extracted faculty: "${extractedFaculty}"`);
  return extractedFaculty;
};


const getSchoolStudentModel = (schoolName) => {
  const collectionName = `students_${schoolName.toLowerCase().replace(/\s+/g, '_')}`;

  if (mongoose.models[collectionName]) {
    return mongoose.models[collectionName];
  }

  const schoolStudentSchema = new mongoose.Schema({
    registrationNumber: {
      type: String,
      required: true,
      unique: true,
    },
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty',
    },
    schoolInfo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SchoolInfo',
    },
    transactions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction',
      },
    ],
  }, {
    collection: collectionName,
  });

  schoolStudentSchema.index({ registrationNumber: 1 });
  schoolStudentSchema.index({ faculty: 1 });

  return mongoose.model(collectionName, schoolStudentSchema);
};


// Updated processFacultyRegistrationNumbers function
const processFacultyRegistrationNumbers = async (
  facultyRegMap,
  faculties,
  schoolInfoId,
  tempPath,
  res,
  schoolData
  
) => {
  try {
    console.log('Starting optimized bulk processing with school-specific collection...');
    const SchoolStudent = getSchoolStudentModel(schoolData.university);
    console.log(`Using collection: students_${schoolData.university}`);

    // Ensure all faculties are included
    faculties.forEach((faculty) => {
      facultyRegMap[faculty.facultyName] = facultyRegMap[faculty.facultyName] || [];
    });

    // Collect ALL registration numbers for bulk checking
    const allRegNumbers = [];
    Object.values(facultyRegMap).forEach(regNums => {
      allRegNumbers.push(...regNums);
    });

    console.log(`Processing ${allRegNumbers.length} total registration numbers...`);

    // BULK CHECK: Find all existing students in school-specific collection
    const existingStudents = await SchoolStudent.find({
      registrationNumber: { $in: allRegNumbers }
    }).select('registrationNumber');

    const existingRegNumbers = new Set(
      existingStudents.map(student => student.registrationNumber)
    );

    console.log(`Found ${existingRegNumbers.size} existing students in school collection`);

    // Prepare bulk operations
    const newStudents = [];
    const addedFaculties = [];

    // Process each faculty
    for (const facultyName in facultyRegMap) {
      const faculty = faculties.find((f) => f.facultyName === facultyName);
      
      if (faculty) {
        const registrationNumbers = facultyRegMap[facultyName];
        addedFaculties.push(faculty._id);

        // Filter out existing students
        const newRegNumbers = registrationNumbers.filter(
          regNum => !existingRegNumbers.has(regNum)
        );

        console.log(`${facultyName}: ${newRegNumbers.length} new students out of ${registrationNumbers.length} total`);

        // Prepare new student documents
        newRegNumbers.forEach(regNum => {
          const studentData = {
            registrationNumber: regNum,
            faculty: faculty._id,
            schoolInfo: schoolInfoId,
          };
          newStudents.push(studentData);
        });
      }
    }

    console.log(`Preparing to create ${newStudents.length} new students...`);

    let savedStudents = [];

    if (newStudents.length > 0) {
      // BULK INSERT: Handle large datasets with chunking
      if (newStudents.length > 5000) {
        const chunkSize = 5000;
        console.log(`Large dataset detected. Processing ${newStudents.length} students in chunks...`);
        
        for (let i = 0; i < newStudents.length; i += chunkSize) {
          const chunk = newStudents.slice(i, i + chunkSize);
          const savedChunk = await SchoolStudent.insertMany(chunk, { ordered: false });
          savedStudents.push(...savedChunk);
          
          console.log(`Processed chunk ${Math.floor(i/chunkSize) + 1}/${Math.ceil(newStudents.length/chunkSize)}: ${savedChunk.length} students`);
        }
      } else {
        // For smaller datasets, process all at once
        savedStudents = await SchoolStudent.insertMany(newStudents, { 
          ordered: false 
        });
        
        console.log(`Successfully created ${savedStudents.length} students`);
      }

      const regNumbersToAdd = savedStudents.map(student => student.registrationNumber);

await SchoolInfo.findByIdAndUpdate(
  schoolInfoId,
  {
    $addToSet: {
      students: { $each: regNumbersToAdd }
    }
  },
  { new: true }
);


      // Update SchoolInfo with student count (not individual IDs since they're in separate collection)
      await SchoolInfo.findByIdAndUpdate(
        schoolInfoId,
        { 
          $inc: { studentCount: savedStudents.length }, 
          $set: { lastStudentUpload: new Date() } 
        },
        { new: true }
      );
      
      console.log(`Updated school info with ${savedStudents.length} new students`);
    }

    // Update school's faculties array
    if (addedFaculties.length > 0) {
      await SchoolInfo.findByIdAndUpdate(
        schoolInfoId,
        { $addToSet: { faculties: { $each: addedFaculties } } },
        { new: true }
      );
      console.log(`Updated school with ${addedFaculties.length} faculties`);
    }

    // Log final results
    Object.keys(facultyRegMap).forEach(facultyName => {
      console.log(`Final: ${facultyName} - ${facultyRegMap[facultyName].length} registration numbers`);
    });

    // Clean up the temporary file
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }

    console.log('Bulk processing completed successfully!');

    // Get updated school data with student count
    const updatedSchoolData = await SchoolInfo.findById(schoolInfoId);

    // Respond with processed data
    return res.status(200).json({
      message: "Registration numbers processed successfully.",
      totalProcessed: allRegNumbers.length,
      newStudentsCreated: savedStudents.length,
      existingStudentsFound: existingRegNumbers.size,
      school: {
        ...updatedSchoolData.toObject(),
        collectionName: `students_${schoolInfoId}` 
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

    return res.status(500).json({ 
      message: "Error processing registration numbers.",
      error: error.message 
    });
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

  if (
    !facultyNames ||
    facultyNames.length === 0 ||
    facultyNames[0] === undefined
  ) {
    return res.status(400).send("At least one faculty must be selected.");
  }

  const { schoolInfoId } = req.body;
  let selectedFaculties = req.body["selectedFaculties[]"];
  selectedFaculties = Array.isArray(selectedFaculties)
    ? selectedFaculties
    : [selectedFaculties];
  selectedFaculties = selectedFaculties.filter((id) =>
    mongoose.Types.ObjectId.isValid(id)
  );

  if (selectedFaculties.length === 0) {
    return res
      .status(400)
      .json({ message: "No valid faculties found for selection." });
  }

  const schoolData = await SchoolInfo.findById(schoolInfoId);
  const SchoolStudent = getSchoolStudentModel(schoolData.university);
  // Remove null or invalid entries from students array
  schoolData.students = schoolData.students.filter(
    (student) => student !== null
  );
  if (!schoolData) {
    return res.status(400).json({ message: "School info not found" });
  }

  const faculties = await Faculty.find({ _id: { $in: selectedFaculties } });
  if (faculties.length === 0) {
    return res
      .status(400)
      .json({ message: "No valid faculties found for selection" });
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
    return res
      .status(400)
      .send("Please upload a valid CSV, PDF, or Excel file.");
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
              if (
                faculty.facultyName.toLowerCase() === facultyName.toLowerCase()
              ) {
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
            schoolData,
            SchoolStudent 
          );
        });
      }else if (file.mimetype === "application/pdf") {
  const dataBuffer = fs.readFileSync(tempPath);
  const pdfData = await pdfParse(dataBuffer);
  let lines = pdfData.text.split("\n");

  // Merge faculty lines before processing
  lines = mergeFacultyLines(lines);
  console.log("PDF Parsed Lines:", lines);
  console.log(`Total lines after merging: ${lines.length}`);

  // More flexible regex patterns - try multiple patterns
  const regNoPatterns = [
    /ND\/\d{3}\/\d{3}/g,           
    /ND\/\d{2,4}\/\d{2,4}/g,      
    /[A-Z]{2,3}\/\d{2,4}\/\d{2,4}/g, 
    /\b\d{2,3}\/\d{2,4}\/\d{2,4}\b/g, 
  ];

  let totalMatches = 0;
  let processedRegNums = new Set(); 

  lines.forEach((line, lineIndex) => {
    console.log(`\nProcessing line ${lineIndex + 1}: "${line}"`);
    
    // Try each regex pattern
    let foundMatch = false;
    
    regNoPatterns.forEach((pattern, patternIndex) => {
      const matches = line.match(pattern);
      if (matches) {
        console.log(`Pattern ${patternIndex + 1} found matches:`, matches);
        
        matches.forEach(match => {
          const regNum = match.trim();
          
          // Skip if already processed (avoid duplicates)
          if (processedRegNums.has(regNum)) {
            console.log(`Skipping duplicate: ${regNum}`);
            return;
          }
          
          console.log(`Processing regNum: "${regNum}"`);
          
          if (isValidRegNumber(regNum)) {
            const facultyName = extractFacultyNameFromLine(line, faculties);
            console.log(`Faculty extracted: "${facultyName}"`);
            
            if (facultyName) {
              facultyRegMap[facultyName].push(regNum);
              processedRegNums.add(regNum);
              totalMatches++;
              foundMatch = true;
              console.log(`✓ Added ${regNum} to ${facultyName}. Total so far: ${totalMatches}`);
            } else {
              console.log(`✗ No faculty found for regNum: ${regNum}`);
            }
          } else {
            console.log(`✗ Invalid regNum: ${regNum}`);
          }
        });
      }
    });
    
    if (!foundMatch) {
      console.log(`No registration numbers found in this line`);
    }
  });

  console.log(`\nPDF Processing Complete:`);
  console.log(`Total registration numbers found: ${totalMatches}`);
  console.log(`Unique registration numbers: ${processedRegNums.size}`);
  
  // Log final counts per faculty
  Object.keys(facultyRegMap).forEach(facultyName => {
    console.log(`${facultyName}: ${facultyRegMap[facultyName].length} registration numbers`);
  });

  await processFacultyRegistrationNumbers(
    facultyRegMap,
    faculties,
    schoolInfoId,
    tempPath,
    res,
    schoolData
  );
}else if(

      file.mimetype.includes("spreadsheet") ||
      file.mimetype.includes("excel")
    ) {
      const rows = await readXlsxFile(tempPath);
      console.log("Excel Rows:", rows);
      rows.forEach((row) => {
        const regNum = row[0]?.trim();
        const facultyName = row[1]?.trim();

        if (isValidRegNumber(regNum) && facultyName) {
          faculties.forEach((faculty) => {
            if (
              faculty.facultyName.toLowerCase() === facultyName.toLowerCase()
            ) {
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
    fs.unlinkSync(tempPath); 
    return res.status(500).send("Error processing file.");
  }
};

const addFaculty = async (req, res) => {
  const { facultyNames } = req.body;

  if (!Array.isArray(facultyNames) || facultyNames.length === 0) {
    return res
      .status(400)
      .json({ message: "An array of faculty names is required." });
  }

  try {
    const facultiesToAdd = facultyNames.map((name) => ({ facultyName: name }));
    const newFaculties = await Faculty.insertMany(facultiesToAdd);

    res
      .status(201)
      .json({ message: "Faculties added successfully.", newFaculties });
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

    const school = await SchoolInfo.findOne({ userId });
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
      message: "You have successfully signed in",
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
      return res
        .status(400)
        .json({ success: false, message: "User ID is required." });
    }

    // Fetching the user and populating schoolInfo along with faculties and students
    const user = await SugUser.findById(userId).populate({
      path: "schoolInfo",
      populate: [
        { path: "faculties", select: "_id facultyName" },
        {
          path: "students",
          select: "registrationNumber faculty",
          populate: { path: "faculty", select: "_id facultyName" },
        },
      ],
    });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (!user.schoolInfo) {
      return res
        .status(404)
        .json({
          success: false,
          message: "School information not found for this user",
        });
    }

    // Filtering out of duplicate registration numbers in students
    const uniqueStudents = [];
    const seenRegistrationNumbers = new Set();

    user.schoolInfo.students.forEach((student) => {
      if (!seenRegistrationNumbers.has(student.registrationNumber)) {
        seenRegistrationNumbers.add(student.registrationNumber);
        uniqueStudents.push({
          registrationNumber: student.registrationNumber,
        });
      }
    });

    // Maping faculties to include both facultyId and facultyName
    const faculties = user.schoolInfo.faculties.map((faculty) => ({
      facultyId: faculty._id,
      facultyName: faculty.facultyName,
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
          students: uniqueStudents,
        },
        university: user.schoolInfo.university,
        state: user.schoolInfo.state,
        aboutUniversity: user.schoolInfo.aboutUniversity,
        uniProfilePicture: user.schoolInfo.uniProfilePicture,
      },
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
      return res
        .status(400)
        .json({ message: "User with this email does not exist" });
    }

    const resetCode = Math.floor(1000 + Math.random() * 9000).toString();

    user.resetPasswordCode = crypto
      .createHash("sha256")
      .update(resetCode)
      .digest("hex");
    user.resetPasswordExpires = Date.now() + 10 * 60 * 1000;

    console.log("Hashed reset code saved:", user.resetPasswordCode);
    console.log(
      "Reset password expires at:",
      new Date(user.resetPasswordExpires)
    );

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
    const hashedCode = crypto.createHash("sha256").update(code).digest("hex");
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

    res
      .status(200)
      .json({ message: "Code verified successfully", userId: user._id });
  } catch (error) {
    console.error("Error in verifyResetCode:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const schoolresetPassword = async (req, res, next) => {
  const { userId, password, confirmPassword } = req.body;

  if (!userId || !password || !confirmPassword) {
    return res
      .status(400)
      .json({
        message: "User ID, Password, and Confirm Password are required",
      });
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
  getAllRegisteredSchools,
};
