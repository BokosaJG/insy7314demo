// validators/adminValidators.js
const { query } = require('express-validator');

// ?limit=50&event=auth.login.failure - both optional.
const auditLogRules = [
  query('limit')
    .optional()
    .isString().withMessage('limit must be a single value').bail()
    .isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100')
    .toInt(),
  query('event')
    .optional()
    .isString().withMessage('event must be text').bail()
    .matches(/^[a-z0-9._]{1,60}$/).withMessage('event may only contain lowercase letters, digits, dots and underscores'),
];

module.exports = { auditLogRules };
