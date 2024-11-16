const express = require('express')
const methodNotAllowed = require('../utils/methodNotAllowed')
const { addComment, fetchComments } = require('../controllers/sugPostController')
const authenticateToken = require('../middlewares/verifyToken')
const verifySugToken = require('../middlewares/verifyAdmin')
const router = express.Router()


router.route('/posts/:postId/comments').post(addComment).all(methodNotAllowed)
router.route('/posts/:postId').get(fetchComments).all(methodNotAllowed)

module.exports = router