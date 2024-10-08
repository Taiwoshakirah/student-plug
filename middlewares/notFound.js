const notFound = (req,res)=>{
    res.status(400).json({message:'Route Not Found'})
}

module.exports = notFound