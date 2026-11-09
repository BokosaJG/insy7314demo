// controllers/bookingController.js
// Clients book gigs. A simulated payment confirmation is returned and a
// Transaction record is created automatically for every booking.

const Booking = require('../models/Booking');
const Transaction = require('../models/Transaction');
const Gig = require('../models/Gig');
const { audit } = require('../utils/audit');
const { logEvent } = require('../config/logger');

const createBooking = async (req, res, next) => {
  try {
    const gig = await Gig.findById(req.body.gigId);
    if (!gig) {
      return res.status(404).json({ error: 'Gig not found' });
    }

    // Amount, freelancer and gig title come from the database, not the client.
    const booking = await Booking.create({
      gig: gig._id,
      gigTitle: gig.title,
      client: req.user.id,
      freelancer: gig.freelancer,
      amount: gig.price,
    });

    let transaction;
    try {
      transaction = await Transaction.create({
        booking: booking._id,
        client: booking.client,
        freelancer: booking.freelancer,
        amount: booking.amount,
        reference: `TXN-${Date.now()}-${booking._id.toString().slice(-6).toUpperCase()}`,
      });
    } catch (txnErr) {
      // Keep data consistent: no booking without a transaction.
      await booking.deleteOne();
      throw txnErr;
    }

    await audit(req, 'booking.created', { bookingId: booking.id, gigId: gig.id, amount: booking.amount });
    await audit(req, 'transaction.created', { transactionId: transaction.id, reference: transaction.reference, bookingId: booking.id, amount: transaction.amount });

    return res.status(201).json({
      message: 'Booking confirmed (simulated payment successful)',
      data: { booking, transaction },
    });
  } catch (err) {
    next(err);
  }
};

// Clients see their own bookings, Freelancers see bookings made on their
// gigs, Admins see everything.
const getBookings = async (req, res, next) => {
  try {
    const filter = {};
    if (req.user.role === 'Client') filter.client = req.user.id;
    if (req.user.role === 'Freelancer') filter.freelancer = req.user.id;

    const bookings = await Booking.find(filter)
      .populate('client', 'name')
      .populate('freelancer', 'name')
      .sort({ createdAt: -1 });

    return res.status(200).json({ data: bookings });
  } catch (err) {
    next(err);
  }
};

const getBookingById = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('client', 'name')
      .populate('freelancer', 'name');
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Ownership check: only the two parties involved (or an Admin).
    const isParty =
      booking.client._id.toString() === req.user.id ||
      booking.freelancer._id.toString() === req.user.id;
    if (!isParty && req.user.role !== 'Admin') {
      logEvent('authz.denied', { requestId: req.id, userId: req.user.id, role: req.user.role, resource: 'booking', resourceId: booking.id, ip: req.ip }, 'warn');
      return res.status(403).json({ error: 'You do not have access to this booking' });
    }

    return res.status(200).json({ data: booking });
  } catch (err) {
    next(err);
  }
};

module.exports = { createBooking, getBookings, getBookingById };
