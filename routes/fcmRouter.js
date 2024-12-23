const express = require('express')
const methodNotAllowed = require('../utils/methodNotAllowed')
const updateFcmToken = require('../controllers/fcmTokenController')
const authenticateToken = require('../middlewares/verifyToken')
const router = express.Router()


router.route('/update-fcm-token').put(authenticateToken,updateFcmToken).all(methodNotAllowed)


module.exports = router