const express = require('express')
const methodNotAllowed = require('../utils/methodNotAllowed')
const fetchNotification = require('../controllers/getNotification')
const router = express.Router()

router.route('/notifications/:userId').get(fetchNotification).all(methodNotAllowed)


module.exports = router