
const mongoose = require("mongoose");
const Roles = require("../middlewares/role");


const eventSchema = new mongoose.Schema({
    adminId: { type: String, required: true },
    schoolInfoId: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String },
    flyer: { type: [String], default: [] },
    isPaid: { type: Boolean, required: true },
    price: { type: Number, default: 0 }, 
    ticketsAvailable: { type: Number, default: 0 },
    postedBy: { type: String, enum: Object.values(Roles), required: true }, 
    createdAt: { type: Date, default: Date.now },
    postedByBody: { type: String, enum: ["sug", "faculty", "department"], required: true }, 
    virtualAccounts: {
  fcmb: {
    accountNumber: String,
    accountName: String,
    bankName: String,
  },
  fidelity: {
    accountNumber: String,
    accountName: String,
    bankName: String,
  },
},
});






module.exports = mongoose.model("Event", eventSchema);

