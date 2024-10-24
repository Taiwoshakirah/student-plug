const express = require('express')
const methodNotAllowed = require('../utils/methodNotAllowed')
const {schoolSugSignup,schoolInformation, uploadStudentsRegNo, getFaculty, getSugUser, schoolSugSignin, addFaculty} = require('../controllers/schoolController')
const authenticateToken = require("../middlewares/verifyToken");
const router = express.Router()

router.route('/sug-signup').post(schoolSugSignup).all(methodNotAllowed)
router.route('/sug-signin').post(schoolSugSignin).all(methodNotAllowed)
router.route('/schoolInfo').post(schoolInformation).all(methodNotAllowed)
router.route('/faculty/reg-upload').post(uploadStudentsRegNo).all(methodNotAllowed)
router.route('/faculty/add-faculty').post(addFaculty).all(methodNotAllowed)
router.route('/faculty/faculties/:name').get(getFaculty).all(methodNotAllowed)
router.route('/faculty/sug-user').get(authenticateToken,getSugUser).all(methodNotAllowed)


module.exports = router