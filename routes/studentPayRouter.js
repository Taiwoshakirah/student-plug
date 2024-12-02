const express = require('express')
const methodNotAllowed = require('../utils/methodNotAllowed')
const { studentPaymentDetails, addCard, chargeCard, retrieveStudentDetails, getStudentAndCardDetails } = require('../controllers/studentPmtController')
const router = express.Router()

router.route('/add-details').post(studentPaymentDetails).all(methodNotAllowed)
router.route('/tokenize-card').post(addCard).all(methodNotAllowed)
router.route('/charge-card').post(chargeCard).all(methodNotAllowed)
router.route('/payments-details/:email').get(retrieveStudentDetails).all(methodNotAllowed)
router.route('/card-details').get(getStudentAndCardDetails).all(methodNotAllowed)

module.exports = router