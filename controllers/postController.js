const Post = require('../models/post')

const post =async(req,res)=>{
    try {
        const { text } = req.body;
        const image = req.file ? req.file.path : null; // Get the image path if uploaded

        const post = new Post({
            user: req.user.id,  // Assuming req.user.id is the authenticated user ID
            text,
            image  // Save the image URL (or path)
        });

        await post.save();

        res.status(201).json({ message: 'Post created', post });
    } catch (error) {
        res.status(500).json({ message: 'Failed to create post', error });
    }
}





    module.exports = post
    
