const express = require('express')
const { studentCreatePost, likePost, commentOnPost, fetchUserPost, deleteUserPost, postNotify, markNotificationAsRead } = require('../controllers/postController')
const methodNotAllowed = require('../utils/methodNotAllowed')
const verifySugToken = require('../middlewares/verifyAdmin')
const authenticateToken = require('../middlewares/verifyToken')
const router = express.Router()

router.route('/create-post').post(studentCreatePost).all(methodNotAllowed)
router.route('/likepost/:postId').post(likePost).all(methodNotAllowed)
router.route('/getUserPost/:userId').get(fetchUserPost).all(methodNotAllowed)
router.route('/post-events').get(postNotify).all(methodNotAllowed)
router.route('/notifications/:notificationId').patch(markNotificationAsRead).all(methodNotAllowed)

module.exports = router