const fs = require("fs");
const multer = require("multer");
const path = require("path");

// Set the uploads directory path for post image
const postUploadsDir = path.join(__dirname, "../uploads/posts");

// Check if posts directory exists, if not create it
if (!fs.existsSync(postUploadsDir)) {
    fs.mkdirSync(postUploadsDir);
}

// Set storage engine for post image uploads
const postStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, postUploadsDir); 
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); 
    }
});

// Initialize upload for post images
const uploadPostImage = multer({ 
    storage: postStorage,
    fileFilter: (req, file, cb) => {
        const fileTypes = /jpeg|jpg|png/;
        const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = fileTypes.test(file.mimetype);
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Images only!'));
        }
    }
});

// Export the multer upload middleware for post images
module.exports = uploadPostImage;
