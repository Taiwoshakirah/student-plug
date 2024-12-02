const mongoose = require("mongoose");

const CardDetailsSchema = new mongoose.Schema({
    email: { type: String, required: true },
    bankName: { type: String, required: true },
    feeType: { type: String, required: true },
    first3: { type: String, required: true }, // First 3 digits of the card
    last3: { type: String, required: true },  // Last 3 digits of the card
    authorizationCode: { type: String, required: true }, // Token from Paystack
});

module.exports = mongoose.model("CardDetails", CardDetailsSchema);
