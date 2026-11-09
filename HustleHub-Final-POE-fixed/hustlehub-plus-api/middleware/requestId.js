// middleware/requestId.js
// Gives every request a random id, returned in the X-Request-Id header and
// written to the server log. When a client reports a problem they can quote
// the id and it can be matched to the (private) server-side log entry,
// without the response itself ever exposing internal detail.

const crypto = require('crypto');

const requestId = (req, res, next) => {
  req.id = crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
};

module.exports = requestId;
