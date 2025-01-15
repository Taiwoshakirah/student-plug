const express = require('express')
const methodNotAllowed = require('../utils/methodNotAllowed')
const {schoolSugSignup,schoolInformation, uploadStudentsRegNo, getFaculty, getSugUser, schoolSugSignin, addFaculty, schoolForgotPassword, schoolverifyResetCode, schoolresetPassword, getSugUserDetails, getAllRegisteredSchools} = require('../controllers/schoolController')
const authenticateToken = require("../middlewares/verifyToken");
const { fetchPostsForSchool } = require('../controllers/sugPostController');
const verifySugToken = require('../middlewares/verifyAdmin');
const router = express.Router()

router.route('/sug-signup').post(schoolSugSignup).all(methodNotAllowed)
router.route('/sug-signin').post(schoolSugSignin).all(methodNotAllowed)
router.route('/schoolInfo').post(schoolInformation).all(methodNotAllowed)
router.route('/faculty/reg-upload').post(uploadStudentsRegNo).all(methodNotAllowed)
router.route('/faculty/add-faculty').post(addFaculty).all(methodNotAllowed)
router.route('/faculty/faculties').get(getFaculty).all(methodNotAllowed)
router.route('/faculty/sug-user').get(authenticateToken,getSugUser).all(methodNotAllowed)
router.route('/get-schools').get(getAllRegisteredSchools).all(methodNotAllowed)
router.route('/forgot').post(schoolForgotPassword).all(methodNotAllowed)
router.route('/code-verification').post(schoolverifyResetCode).all(methodNotAllowed)
router.route('/passwordReset').post(schoolresetPassword).all(methodNotAllowed)
router.route('/getSug/:userId').get(verifySugToken,getSugUserDetails).all(methodNotAllowed)
router.route('/:schoolInfoId').get(authenticateToken,fetchPostsForSchool).all(methodNotAllowed)



module.exports = router