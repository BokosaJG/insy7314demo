// models/Transaction.js
// Created automatically for every booking (simulated payment). Linked
// to both the client and the freelancer. Freelancer income is the sum
// of these records.

const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    freelancer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['Completed'], default: 'Completed' },
    reference: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Transaction', transactionSchema);
