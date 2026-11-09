// validators/gigValidators.js
const { body } = require('express-validator');
const sanitizeText = require('../utils/sanitize');
const { idParam } = require('./commonValidators');

// Only these three fields are ever accepted. The owner ("freelancer") is
// taken from the verified JWT, never from the request body.
const gigBodyRules = [
  body('title')
    .exists().withMessage('title is required').bail()
    .isString().withMessage('title must be text').bail()
    .customSanitizer(sanitizeText)
    .isLength({ min: 3, max: 100 }).withMessage('title must be between 3 and 100 characters'),

  body('description')
    .exists().withMessage('description is required').bail()
    .isString().withMessage('description must be text').bail()
    .customSanitizer(sanitizeText)
    .isLength({ min: 10, max: 1000 }).withMessage('description must be between 10 and 1000 characters'),

  // Must be a real JSON number (a string such as "100" is rejected), between
  // 1 and 1,000,000, with at most two decimal places.
  body('price')
    .exists().withMessage('price is required').bail()
    .custom((v) => typeof v === 'number' && Number.isFinite(v))
    .withMessage('price must be a number').bail()
    .custom((v) => v >= 1 && v <= 1000000)
    .withMessage('price must be between 1 and 1000000').bail()
    .custom((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6)
    .withMessage('price can have at most 2 decimal places'),
];

const createGigRules = gigBodyRules;
const updateGigRules = [idParam, ...gigBodyRules];
const gigIdRules = [idParam];

module.exports = { createGigRules, updateGigRules, gigIdRules };
