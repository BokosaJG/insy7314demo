// validators/transactionValidators.js
const { query } = require('express-validator');
const { SUPPORTED_TAX_YEARS } = require('../config/taxTables');

// ?taxYear=2027 (optional). Only years we hold SARS tables for are accepted;
// isString() also rejects repeated params (?taxYear=1&taxYear=2) and
// operator objects (?taxYear[$ne]=1).
const dashboardRules = [
  query('taxYear')
    .optional()
    .isString().withMessage('taxYear must be a single value').bail()
    .isInt({ allow_leading_zeroes: false }).withMessage('taxYear must be a whole number').bail()
    .toInt()
    .isIn(SUPPORTED_TAX_YEARS).withMessage(`taxYear must be one of: ${SUPPORTED_TAX_YEARS.join(', ')}`),
];

module.exports = { dashboardRules };
