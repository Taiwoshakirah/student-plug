const express = require("express");
const { mongoose } = require("mongoose");
const cors = require('cors')
const path = require("path");
const fileUpload = require("express-fileupload"); // Import express-fileupload
require("dotenv").config();
const admin = require('firebase-admin')
const serviceAccount = require('./config/serviceAccount')

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(fileUpload()); 
admin.initializeApp({
credential: admin.credential.cert(serviceAccount),
});
// Serve static files (for the uploads folder)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Debugging: Log the path being served as static
console.log("Serving static files from:", path.join(__dirname, 'uploads'));

const signUpRouter = require("./routes/signUpRouter");
const postRouter = require('./routes/postRouter');
const notFound = require("./middlewares/notFound");
const methodNotAllowed = require("./utils/methodNotAllowed");

app.use("/api/auth", signUpRouter);
app.use(notFound);
app.use(methodNotAllowed);

// Start the server
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
