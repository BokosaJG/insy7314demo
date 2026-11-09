// validators/authValidators.js
// express-validator rules for the authentication endpoints. Each field is
// checked for presence, TYPE (a JSON object such as {"$gt": ""} is not a
// string, so NoSQL operator injection fails here even if it slipped past the
// sanitiser), length and format.

const { body } = require('express-validator');
const sanitizeText = require('../utils/sanitize');

// bcrypt only uses the first 72 bytes of a password, so longer is pointless
// and very long inputs are an easy way to waste CPU.
const PASSWORD_MAX = 72;

const registerRules = [
  body('name')
    .exists().withMessage('name is required').bail()
    .isString().withMessage('name must be text').bail()
    .customSanitizer(sanitizeText)
    .isLength({ min: 2, max: 60 }).withMessage('name must be between 2 and 60 characters'),

  body('email')
    .exists().withMessage('email is required').bail()
    .isString().withMessage('email must be text').bail()
    .trim()
    .isLength({ max: 254 }).withMessage('email is too long').bail()
    .isEmail().withMessage('a valid email address is required')
    .customSanitizer((v) => v.toLowerCase()),

  body('password')
    .exists().withMessage('password is required').bail()
    .isString().withMessage('password must be text').bail()
    .isLength({ min: 8 }).withMessage('password must be at least 8 characters long').bail()
    .isLength({ max: PASSWORD_MAX }).withMessage(`password must be at most ${PASSWORD_MAX} characters long`).bail()
    .matches(/[A-Z]/).withMessage('password must contain an uppercase letter').bail()
    .matches(/[a-z]/).withMessage('password must contain a lowercase letter').bail()
    .matches(/[0-9]/).withMessage('password must contain a number'),

  // Admin is deliberately NOT allowed: admins are created by the seed script.
  body('role')
    .exists().withMessage('role is required').bail()
    .isString().withMessage('role must be text').bail()
    .trim()
    .isIn(['Client', 'Freelancer']).withMessage('role must be Client or Freelancer'),
];

const loginRules = [
  body('email')
    .exists().withMessage('email is required').bail()
    .isString().withMessage('email must be text').bail()
    .trim()
    .isLength({ max: 254 }).withMessage('email is too long').bail()
    .isEmail().withMessage('a valid email address is required')
    .customSanitizer((v) => v.toLowerCase()),

  body('password')
    .exists().withMessage('password is required').bail()
    .isString().withMessage('password must be text').bail()
    .notEmpty().withMessage('password is required').bail()
    .isLength({ max: PASSWORD_MAX }).withMessage(`password must be at most ${PASSWORD_MAX} characters long`),
];

module.exports = { registerRules, loginRules };
