const express = require('express')
const methodNotAllowed = require('../utils/methodNotAllowed')
const { studentPaymentDetails, retrieveStudentDetails, schoolPaymentStatus,  searchStudentByRegistrationNumber, generateVirtualAccount, makePayment, getStudentPaymentDetails, webhook, fidelityWebhook, getReceipt } = require('../controllers/studentPmtController')
const router = express.Router()

router.route('/add-details').post(studentPaymentDetails).all(methodNotAllowed)
router.route('/payments-details/:email').get(retrieveStudentDetails).all(methodNotAllowed)
router.route('/payment-status/:schoolInfoId').get(schoolPaymentStatus).all(methodNotAllowed)
router.route('/payment-receipt/:reference').get(getReceipt).all(methodNotAllowed)
router.route('/student/:schoolInfoId/:registrationNumber([A-Z]{2}/\\d+/\\d+)').get(searchStudentByRegistrationNumber).all(methodNotAllowed)
router.route('/account-info').get(getStudentPaymentDetails).all(methodNotAllowed)
router.route('/webhook').post(webhook).all(methodNotAllowed)
router.route('/webhook/fidelity').post(fidelityWebhook).all(methodNotAllowed)

module.exports = router