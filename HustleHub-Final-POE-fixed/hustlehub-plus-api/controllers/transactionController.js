// controllers/transactionController.js
// Transaction history, per-freelancer income tracking and the income / tax
// dashboard (final part).

const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const Booking = require('../models/Booking');
const { buildDashboard } = require('../utils/dashboard');
const { taxYearOf, taxYearRange } = require('../utils/tax');

// Clients see transactions they paid, Freelancers see ones they earned,
// Admins see all.
const getTransactions = async (req, res, next) => {
  try {
    const filter = {};
    if (req.user.role === 'Client') filter.client = req.user.id;
    if (req.user.role === 'Freelancer') filter.freelancer = req.user.id;

    const transactions = await Transaction.find(filter).sort({ createdAt: -1 });
    return res.status(200).json({ data: transactions });
  } catch (err) {
    next(err);
  }
};

// Income for the logged-in freelancer: the sum of their transactions.
const getMyIncome = async (req, res, next) => {
  try {
    const result = await Transaction.aggregate([
      { $match: { freelancer: new mongoose.Types.ObjectId(req.user.id) } },
      { $group: { _id: '$freelancer', totalIncome: { $sum: '$amount' }, transactionCount: { $sum: 1 } } },
    ]);

    const summary = result[0] || { totalIncome: 0, transactionCount: 0 };
    return res.status(200).json({
      data: { totalIncome: summary.totalIncome, transactionCount: summary.transactionCount },
    });
  } catch (err) {
    next(err);
  }
};

// Income + estimated tax for one SA tax year (1 March - end of February).
// The freelancer id always comes from the verified token, so a freelancer can
// only ever see their own figures.
const getDashboard = async (req, res, next) => {
  try {
    const now = new Date();
    const taxYear = req.query.taxYear || taxYearOf(now);
    const { start, end } = taxYearRange(taxYear);

    // The app sets mongoose sanitizeFilter=true (NoSQL-injection defence), which
    // neutralises query operators. These operators are built on the server from
    // validated values, so they are explicitly marked as trusted.
    const transactions = await Transaction.find({
      freelancer: req.user.id,
      createdAt: mongoose.trusted({ $gte: start, $lt: end }),
    })
      .select('amount createdAt booking')
      .lean();

    // Gig titles live on the booking (kept even if the gig is deleted).
    const bookings = await Booking.find({ _id: mongoose.trusted({ $in: transactions.map((t) => t.booking) }) })
      .select('gigTitle')
      .lean();
    const titles = new Map(bookings.map((b) => [String(b._id), b.gigTitle]));

    return res.status(200).json({ data: buildDashboard(transactions, titles, taxYear, now) });
  } catch (err) {
    next(err);
  }
};

module.exports = { getTransactions, getMyIncome, getDashboard };
