const express = require('express')
const methodNotAllowed = require('../utils/methodNotAllowed')
const { createSugPost, toggleLike, addComment, fetchPostDetails, deletePost } = require('../controllers/sugPostController')
const verifySugToken = require('../middlewares/verifyAdmin')
const router = express.Router()


router.route('/create').post(createSugPost).all(methodNotAllowed)
router.route('/:postId/like').post(toggleLike).all(methodNotAllowed)
router.route('/posts/:adminId').get(fetchPostDetails).all(methodNotAllowed)
router.route('/deletePost/:postId').delete(verifySugToken,deletePost).all(methodNotAllowed)




module.exports = router