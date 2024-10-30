const express = require('express')
const methodNotAllowed = require('../utils/methodNotAllowed')
const { createSugPost, toggleLike, addComment, fetchPostDetails } = require('../controllers/sugPostController')
const router = express.Router()


router.route('/create').post(createSugPost).all(methodNotAllowed)
router.route('/:postId/like').post(toggleLike).all(methodNotAllowed)
router.route('/:postId/comment').post(addComment).all(methodNotAllowed)
router.route('/posts/:adminId').get(fetchPostDetails).all(methodNotAllowed)


module.exports = router