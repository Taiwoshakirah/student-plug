
const mongoose = require("mongoose");
const Roles = require("../middlewares/role");


const eventSchema = new mongoose.Schema({
    adminId: { type: String, required: true },
    schoolInfoId: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String },
    flyer: { type: [String], default: [] },// Array of image URLs
    // date: { type: Date, required: true },
    isPaid: { type: Boolean, required: true },
    price: { type: Number, default: 0 }, // Only required for paid events
    ticketsAvailable: { type: Number, default: 0 },
    postedBy: { type: String, enum: Object.values(Roles), required: true }, // Accepts "admin", "user", etc.
    createdAt: { type: Date, default: Date.now },
    postedByBody: { type: String, enum: ["sug", "faculty", "department"], required: true }, // Body
});


// const eventSchema = new mongoose.Schema({
//     adminId: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: "SugUser", 
//         required: true,
//     },
//     text: { 
//         type: String, 
//         required: false 
//     },
//     images: [
//         String
//     ],
//     createdAt: { 
//         type: Date, 
//         default: Date.now 
//     },
//     schoolInfoId: {  
//         type: mongoose.Schema.Types.ObjectId,
//         ref: "SchoolInfo",
//         required: true
//     },
    
// });



module.exports = mongoose.model("Event", eventSchema);

