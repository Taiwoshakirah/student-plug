const express = require('express')
const methodNotAllowed = require('../utils/methodNotAllowed')
const { getTrendingPosts } = require('../controllers/trendingController')
const router = express.Router()

router.route('/trend').get(getTrendingPosts).all(methodNotAllowed)

module.exports = router