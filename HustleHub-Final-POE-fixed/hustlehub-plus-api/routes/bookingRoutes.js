// routes/bookingRoutes.js
// Booking creation order: JWT -> role (Client only) -> rate limit (per user)
// -> validation -> controller. The limiter sits after authentication so it can
// count per user rather than per IP.

const express = require('express');
const router = express.Router();

const { createBooking, getBookings, getBookingById } = require('../controllers/bookingController');
const { authenticateToken, requireRole } = require('../middleware/authenticateToken');
const { createBookingRules, bookingIdRules } = require('../validators/bookingValidators');
const validate = require('../middleware/validate');
const { bookingLimiter } = require('../middleware/rateLimiters');

router.use(authenticateToken);

router.post('/', requireRole('Client'), bookingLimiter, createBookingRules, validate, createBooking);
router.get('/', getBookings);
router.get('/:id', bookingIdRules, validate, getBookingById);

module.exports = router;
