// models/Booking.js
// Links a Client to a Freelancer's Gig. The amount is copied from the
// gig on the server so a client can never choose their own price.
// gigTitle is stored so the booking record stays readable even if the
// gig is later deleted.

const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    gig: { type: mongoose.Schema.Types.ObjectId, ref: 'Gig', required: true },
    gigTitle: { type: String, required: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    freelancer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['Confirmed'], default: 'Confirmed' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Booking', bookingSchema);
