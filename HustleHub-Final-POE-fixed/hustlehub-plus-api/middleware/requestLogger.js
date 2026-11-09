// middleware/requestLogger.js
// One access-log entry per request, written when the response finishes.
// Records who (user id if authenticated, IP), what (method + route path, never
// the query string or body) and the outcome (status, duration). Server errors
// are logged as "error", client errors as "warn", the rest as "info".

const { logEvent } = require('../config/logger');

const requestLogger = (req, res, next) => {
  const started = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logEvent(
      'http.request',
      {
        requestId: req.id,
        method: req.method,
        path: req.baseUrl ? `${req.baseUrl}${req.route ? req.route.path : ''}` : req.path,
        status: res.statusCode,
        durationMs: Math.round(durationMs * 10) / 10,
        ip: req.ip,
        userId: req.user && req.user.id,
        userAgent: (req.headers['user-agent'] || '').slice(0, 120),
      },
      level
    );
  });

  next();
};

module.exports = requestLogger;
