const mongoose = require('mongoose');

const EventCardDetailsSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  token: { type: String, required: true },
  firstThree: { type: String, required: true },
  lastThree: { type: String, required: true },
  bankName: { type: String, required: true },
});

const EventCardDetails = mongoose.model('EventCardDetails', EventCardDetailsSchema);

module.exports = EventCardDetails;
