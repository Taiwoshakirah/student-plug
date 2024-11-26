const express = require('express')
const methodNotAllowed = require('../utils/methodNotAllowed')
const { studentPaymentDetails, addCard, chargeCard } = require('../controllers/studentPmtController')
const router = express.Router()

router.route('/add-details').post(studentPaymentDetails).all(methodNotAllowed)
router.route('/tokenize-card').post(addCard).all(methodNotAllowed)
router.route('/charge-card').post(chargeCard).all(methodNotAllowed)

module.exports = router