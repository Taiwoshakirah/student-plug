const express = require('express')
const methodNotAllowed = require('../utils/methodNotAllowed')
const { studentPaymentDetails, retrieveStudentDetails, schoolPaymentStatus,  searchStudentByRegistrationNumber, generateVirtualAccount, makePayment, getStudentPaymentDetails, webhook } = require('../controllers/studentPmtController')
const router = express.Router()

router.route('/add-details').post(studentPaymentDetails).all(methodNotAllowed)
// router.route('/tokenize-card').post(addCard).all(methodNotAllowed)
// router.route('/charge-card').post(chargeCard).all(methodNotAllowed)
router.route('/payments-details/:email').get(retrieveStudentDetails).all(methodNotAllowed)
// router.route('/card-details').get(getStudentAndCardDetails).all(methodNotAllowed)
router.route('/payment-status/:schoolInfoId').get(schoolPaymentStatus).all(methodNotAllowed)
router.route('/student/:schoolInfoId/:registrationNumber([A-Z]{2}/\\d+/\\d+)').get(searchStudentByRegistrationNumber).all(methodNotAllowed)
router.route('/account-info').get(getStudentPaymentDetails).all(methodNotAllowed)
router.route('/webhook').post(webhook).all(methodNotAllowed)
// router.route('/payment-record').post(recordPayment).all(methodNotAllowed)
// router.route('/virtual-account').post(generateVirtualAccount).all(methodNotAllowed)
// router.route('/make-payment').post(makePayment).all(methodNotAllowed)

module.exports = router