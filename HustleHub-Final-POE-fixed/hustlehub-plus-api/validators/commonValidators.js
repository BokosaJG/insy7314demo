// validators/commonValidators.js
const { param } = require('express-validator');

// :id in the URL must be a genuine 24-character MongoDB ObjectId.
const idParam = param('id').isMongoId().withMessage('id must be a valid id');

module.exports = { idParam };
