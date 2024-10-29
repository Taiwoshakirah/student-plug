const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadToCloudinary = async (filePath) => {
  return new Promise((resolve, reject) => {
      cloudinary.uploader.upload(filePath, (error, result) => {
          if (error) return reject(error);
          resolve(result);
      });
  });
};

module.exports = {cloudinary,uploadToCloudinary};

