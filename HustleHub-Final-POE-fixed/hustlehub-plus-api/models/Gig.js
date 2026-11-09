// models/Gig.js
// A service listing created by a Freelancer. The "freelancer" field is
// the owner and is what ownership checks compare against.

const mongoose = require('mongoose');

const gigSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 1 },
    freelancer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Gig', gigSchema);
