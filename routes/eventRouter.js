const express = require('express')
const { createUnpaidEvent, createPaidEvent, getAllEvents, getEventById, saveStudentDetails, fetchConfirmationDetails, chargeCard, getEventsByAdmin, verifyPayment, updatePaymentStatus, handleTransactionVerification, receipt, fetchPaymentDetail, getReceipt } = require('../controllers/eventController')
const methodNotAllowed = require('../utils/methodNotAllowed')
const router = express.Router()

router.route('/create-unpaidevent').post(createUnpaidEvent).all(methodNotAllowed)
router.route('/create-paidevent').post(createPaidEvent).all(methodNotAllowed)
router.route('/get-events/:schoolInfoId').get(getAllEvents).all(methodNotAllowed)
router.route('/get-event/:eventId').get(getEventById).all(methodNotAllowed)
router.route('/eventbyadmin/:adminId').get(getEventsByAdmin).all(methodNotAllowed)
router.route('/saveStudent').post(saveStudentDetails).all(methodNotAllowed)
router.route('/get-eventPaidDetails').get(fetchPaymentDetail).all(methodNotAllowed)
router.route('/fetch-details/:email').get(fetchConfirmationDetails).all(methodNotAllowed)
router.route('/receipt/:reference').get(getReceipt).all(methodNotAllowed)



module.exports = router