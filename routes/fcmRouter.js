const express = require('express')
const methodNotAllowed = require('../utils/methodNotAllowed')
const updateFcmToken = require('../controllers/fcmTokenController')
const router = express.Router()


router.route('/update-fcm-token').put(updateFcmToken).all(methodNotAllowed)


module.exports = router