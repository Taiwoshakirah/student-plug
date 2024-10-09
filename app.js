const express = require("express");
const { mongoose } = require("mongoose");
const cors = require('cors');
const path = require("path");
const fs = require("fs");
const fileUpload = require("express-fileupload"); 
require("dotenv").config();
const admin = require('firebase-admin');

const app = express();
const port = process.env.PORT || 5000;


app.use(cors());
app.use(express.json());
app.use(fileUpload());

// const serviceAccountPath = process.env.SERVICE_ACCOUNT_PATH;

// const serviceAccount = JSON.parse(fs.readFileSync(path.join(__dirname, serviceAccountPath)));

// Initializing Firebase Admin
admin.initializeApp({
  projectId: process.env.FIREBASE_PROJECT_ID
});

// Serve static files (for the uploads folder)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
console.log("Serving static files from:", path.join(__dirname, 'uploads'));

const signUpRouter = require("./routes/signUpRouter");
const postRouter = require('./routes/postRouter');
const notFound = require("./middlewares/notFound");
const methodNotAllowed = require("./utils/methodNotAllowed");

app.use("/api/auth", signUpRouter);
app.use(notFound);
app.use(methodNotAllowed);

const start = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log("DB Connected");
    app.listen(port, () => {
      console.log(`Server is listening on port: ${port}`);
    });
  } catch (error) {
    console.log(`Could not connect due to ${error.message}`);
    process.exit(1);
  }
};

start();
