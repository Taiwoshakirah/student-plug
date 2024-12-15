const express = require('express')
const { createUnpaidEvent, createPaidEvent, getAllEvents, getEventById, saveStudentDetails, saveCardDetails, fetchConfirmationDetails, chargeCard } = require('../controllers/eventController')
const methodNotAllowed = require('../utils/methodNotAllowed')
const router = express.Router()

router.route('/create-unpaidevent').post(createUnpaidEvent).all(methodNotAllowed)
router.route('/create-paidevent').post(createPaidEvent).all(methodNotAllowed)
router.route('/get-events/:schoolInfoId').get(getAllEvents).all(methodNotAllowed)
router.route('/get-event/:eventId').get(getEventById).all(methodNotAllowed)
router.route('/saveStudent').post(saveStudentDetails).all(methodNotAllowed)
// router.route('/purchase/:eventId').post(purchaseTicket).all(methodNotAllowed)
router.route('/card').post(saveCardDetails).all(methodNotAllowed)
router.route('/fetch-details').get(fetchConfirmationDetails).all(methodNotAllowed)
router.route('/charging').post(chargeCard).all(methodNotAllowed)


module.exports = router