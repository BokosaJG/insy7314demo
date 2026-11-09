// middleware/validate.js
// Runs after an express-validator chain. On failure it returns a 400 with a
// list of {field, message} entries. It never echoes the submitted value
// back, so the error response cannot be used to reflect attacker input.
// On success req.body is REPLACED with only the fields that were validated
// (matchedData), so any extra field a client sends - e.g. "role",
// "freelancer", "_id", "amount" - is silently discarded (mass-assignment
// protection).

const { validationResult, matchedData } = require('express-validator');

const validate = (req, res, next) => {
  const result = validationResult(req);

  if (!result.isEmpty()) {
    const details = result
      .array({ onlyFirstError: true })
      .map((e) => ({ field: e.path, message: e.msg }));
    return res.status(400).json({ error: 'Validation failed', details });
  }

  req.body = matchedData(req, { locations: ['body'], includeOptionals: false });
  next();
};

module.exports = validate;
