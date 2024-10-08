// const fs = require('fs');
// const multer = require('multer');
// const path = require('path');

// // Configure Multer Storage
// const storage = multer.diskStorage({
//     destination: (req, file, cb) => {
//         const uploadsDir = path.join(__dirname, "../uploads/profiles");

//         // Create the directory if it does not exist
//         if (!fs.existsSync(uploadsDir)) {
//             fs.mkdirSync(uploadsDir, { recursive: true });
//             console.log("Uploads directory created.");
//         }

//         cb(null, uploadsDir);
//     },
//     filename: (req, file, cb) => {
//         cb(null, Date.now() + path.extname(file.originalname)); 
//     }
// });

// // Multer middleware for profile photo upload
// const uploadProfileImage = multer({ storage: storage }).single("profilePhoto");

// module.exports = uploadProfileImage;




// const upload = (req, res) => {
//     if (!req.files || Object.keys(req.files).length === 0) {
//         return res.status(400).send('No files were uploaded.');
//     }

//     const profilePhoto = req.files.profilePhoto;
//     const uploadsDir = path.join(__dirname, "../uploads/profiles");

//     // Create the directory if it does not exist
//     if (!fs.existsSync(uploadsDir)) {
//         fs.mkdirSync(uploadsDir, { recursive: true });
//         console.log("Uploads directory created.");
//     }

//     // Move the uploaded file to the uploads directory
//     const uploadPath = path.join(uploadsDir, Date.now() + path.extname(profilePhoto.name));

//     profilePhoto.mv(uploadPath, (err) => {
//         if (err) {
//             return res.status(500).send(err);
//         }
//         res.send('File uploaded successfully!');
//     });
// }
