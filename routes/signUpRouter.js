const express = require("express");
const { signUp, studentInformation, signin, forgotPassword, resetPassword, getUser, uploadProfilePicture, googleSignIn, verifyResetCode } = require("../controllers/authController"); 
const methodNotAllowed = require("../utils/methodNotAllowed");
const authenticateToken = require("../middlewares/verifyToken");
const router = express.Router();

router.route("/signin-google").post(googleSignIn).all(methodNotAllowed);
router.route("/signup1").post(signUp).all(methodNotAllowed);
router.route("/studentinfo").post(studentInformation).all(methodNotAllowed); 
router.route("/signin").post(signin).all(methodNotAllowed)
router.route('/getuser').get(authenticateToken, getUser).all(methodNotAllowed)
router.route('/forgot-password').post(forgotPassword).all(methodNotAllowed)
router.route('/verify-password').post(verifyResetCode).all(methodNotAllowed)
router.route('/reset-password').post(resetPassword).all(methodNotAllowed)
router.route("/upload-profile").post(authenticateToken, uploadProfilePicture).all(methodNotAllowed);
module.exports = router;
