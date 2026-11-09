// validators/bookingValidators.js
const { body } = require('express-validator');
const { idParam } = require('./commonValidators');

// A booking request carries only the id of the gig. Price, client and
// freelancer always come from trusted server-side data.
const createBookingRules = [
  body('gigId')
    .exists().withMessage('gigId is required').bail()
    .isString().withMessage('gigId must be text').bail()
    .isMongoId().withMessage('gigId must be a valid id'),
];

const bookingIdRules = [idParam];

module.exports = { createBookingRules, bookingIdRules };
