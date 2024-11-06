const express = require('express')
const { studentCreatePost, likePost, commentOnPost, fetchUserPost } = require('../controllers/postController')
const methodNotAllowed = require('../utils/methodNotAllowed')
const router = express.Router()

router.route('/create-post').post(studentCreatePost).all(methodNotAllowed)
router.route('/likepost/:postId').post(likePost).all(methodNotAllowed)
router.route('/comments/:postId').post(commentOnPost).all(methodNotAllowed)
router.route('/getUserPost/:userId').get(fetchUserPost).all(methodNotAllowed)

module.exports = router