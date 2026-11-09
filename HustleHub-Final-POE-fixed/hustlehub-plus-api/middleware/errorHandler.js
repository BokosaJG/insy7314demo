// middleware/errorHandler.js
// Central error handling. Rules:
//  * The full error (message + stack) is logged on the SERVER only, tagged
//    with the request id.
//  * The client only ever receives a short, generic message chosen here -
//    never err.message, a stack trace, a file path, a query or a database
//    error text.
//  * Every error response has the same shape: { "error": "<message>" }
//    (plus "details" for validation errors and "retryAfterSeconds" for 429s).

const { logEvent } = require('../config/logger');

const sendError = (res, status, message) => res.status(status).json({ error: message });

// 404 for routes that do not exist (registered after all real routes).
const notFound = (req, res) => sendError(res, 404, 'Route not found');

const errorHandler = (err, req, res, next) => {
  // If a response has already started we can only hand over to Express.
  if (res.headersSent) return next(err);

  // Full detail goes to the server log only (stack traces never go to the
  // cloud platform or the client; they are kept for local debugging).
  const serverFault = !(err.status && err.status < 500) && !err.type && !['ValidationError', 'CastError', 'JsonWebTokenError', 'TokenExpiredError'].includes(err.name) && err.code !== 11000;
  logEvent(
    'error.unhandled',
    {
      requestId: req.id,
      method: req.method,
      path: req.path,
      errorName: err.name || 'Error',
      errorMessage: err.message,
      userId: req.user && req.user.id,
      stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
    },
    serverFault ? 'error' : 'warn'
  );

  // --- Request body problems (body-parser) ---
  if (err.type === 'entity.too.large' || err.status === 413) {
    return sendError(res, 413, 'Request payload is too large');
  }
  if (err.type === 'entity.parse.failed') {
    return sendError(res, 400, 'Request body must be valid JSON');
  }
  if (err.type === 'encoding.unsupported' || err.type === 'charset.unsupported') {
    return sendError(res, 415, 'Unsupported content encoding or charset');
  }
  if (err.type === 'request.aborted' || err.type === 'request.size.invalid') {
    return sendError(res, 400, 'Request could not be read');
  }

  // --- Database problems ---
  if (err.code === 11000) {
    return sendError(res, 409, 'A record with these details already exists');
  }
  if (err.name === 'ValidationError') {
    return sendError(res, 400, 'Submitted data failed validation');
  }
  if (err.name === 'CastError') {
    return sendError(res, 400, 'Invalid id format');
  }
  if (
    err.name === 'MongoNetworkError' ||
    err.name === 'MongooseServerSelectionError' ||
    err.name === 'MongoServerSelectionError'
  ) {
    return sendError(res, 503, 'Service temporarily unavailable. Please try again later.');
  }

  // --- Token problems that reach the handler ---
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return sendError(res, 403, 'Invalid or expired token');
  }

  // --- Anything else is a server fault: generic message only ---
  return sendError(res, 500, 'Something went wrong. Please try again later.');
};

module.exports = errorHandler;
module.exports.notFound = notFound;
