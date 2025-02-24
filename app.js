const http = require("http")
const express = require("express");
const { mongoose } = require("mongoose");
const cors = require('cors');
const path = require("path");
const fs = require("fs");
const fileUpload = require("express-fileupload"); 
require("dotenv").config();
const admin = require('firebase-admin');
const session = require("express-session");
const MongoStore = require("connect-mongo");
const  {setupWebSocket}  = require('./utils/websocket');



const corsOptions = {
  origin: [
    "http://localhost:5173",
    "https://schoolplug.ng", 
  ],
  methods: ["GET", "POST", "PUT", "DELETE","PATCH"], 
  allowedHeaders: ["Content-Type", "Authorization"], 
  credentials: true, 
};


const tempDir = path.join(__dirname, 'tmp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}


const app = express();
// const server = http.createServer(app);
const server = http.createServer(app)
setupWebSocket(server);

console.log("HTTP Server:", server);



const port = process.env.PORT || 5000;
const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'), 
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI,
  token_uri: process.env.FIREBASE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
};


app.use(cors(corsOptions));
app.use(express.json({verify: (req, res, buf) => {
  req.rawBody = buf; 
}}));
app.use(express.urlencoded({ extended: true }))
app.use(fileUpload({
  createParentPath: true,
  useTempFiles: true,
  tempFileDir: tempDir
}));


// Initializing Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;

// Serve static files (for the uploads folder)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
console.log("Serving static files from:", path.join(__dirname, 'uploads'));

//MONGOdb session store
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    collectionName: 'sessions', 
  }),
  
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, 
  },
}));

const signUpRouter = require("./routes/signUpRouter");
const schoolRouter = require('./routes/schoolRouter')
const sugPostRouter = require('./routes/sugPostRouter')
const postRouter = require('./routes/postRouter')
const postComment = require('./routes/postComment')
const trendRouter = require('./routes/trendRouter')
const studentPayRouter = require('./routes/studentPayRouter')
const eventRouter = require('./routes/eventRouter')
const getNotificationsRouter = require('./routes/getNotificationsRouter')
// const fcmRouter = require('./routes/fcmRouter')
const notFound = require("./middlewares/notFound");
const methodNotAllowed = require("./utils/methodNotAllowed");



app.use("/api/auth", signUpRouter);
app.use('/api/school',schoolRouter)
app.use('/api/sugPost',sugPostRouter)
app.use('/api/students',postRouter)
app.use('/api/add',postComment)
app.use('/api/getting',trendRouter)
app.use('/api/payment',studentPayRouter)
app.use('/api/schoolEvent',eventRouter)
app.use('/api/plug',getNotificationsRouter)
// app.use('/api/notify',fcmRouter)
app.use(notFound);
app.use(methodNotAllowed);





const start = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log("DB Connected");
    server.listen(port, () => {
      console.log(`Server is listening on port: ${port}`);
    });
  } catch (error) {
    console.log(`Could not connect due to ${error.message}`);
    process.exit(1);
  }
};

start();
