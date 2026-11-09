// middleware/rateLimiters.js
// Rate limiting with express-rate-limit. Every limiter answers with a
// meaningful HTTP 429 (JSON body + Retry-After header + standard
// RateLimit-* headers) so legitimate clients know when to try again.
//
// Limits are read from .env so they can be tuned per environment; the
// defaults below are the values used for the POE evidence run.
//
// Counters are held in memory (fine for one server process). A multi-server
// deployment would use a shared store such as Redis - noted as a limitation.

const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { logEvent } = require('../config/logger');

const positiveInt = (value, fallback) => {
  const n = parseInt(value, 10);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

const MINUTE = 60 * 1000;

const limits = {
  api: { windowMs: 15 * MINUTE, limit: positiveInt(process.env.RATE_LIMIT_API_MAX, 300) },
  loginIp: { windowMs: 15 * MINUTE, limit: positiveInt(process.env.RATE_LIMIT_LOGIN_IP_MAX, 20) },
  loginAccount: { windowMs: 15 * MINUTE, limit: positiveInt(process.env.RATE_LIMIT_LOGIN_ACCOUNT_MAX, 5) },
  register: { windowMs: 60 * MINUTE, limit: positiveInt(process.env.RATE_LIMIT_REGISTER_MAX, 5) },
  booking: { windowMs: MINUTE, limit: positiveInt(process.env.RATE_LIMIT_BOOKING_MAX, 10) },
};

// Shared 429 response. Retry-After is calculated from the limiter's reset time.
const tooMany = (message) => (req, res) => {
  const resetTime = req.rateLimit && req.rateLimit.resetTime;
  const retryAfter = resetTime
    ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
    : 60;
  logEvent('ratelimit.exceeded', { requestId: req.id, method: req.method, path: req.originalUrl.split('?')[0], ip: req.ip, userId: req.user && req.user.id }, 'warn');
  res.set('Retry-After', String(retryAfter));
  res.status(429).json({ error: message, retryAfterSeconds: retryAfter });
};

const base = {
  standardHeaders: 'draft-7', // RateLimit + RateLimit-Policy headers
  legacyHeaders: false,       // no X-RateLimit-* headers
};

// Broad safety net across the whole API, per IP address.
const apiLimiter = rateLimit({
  ...base,
  ...limits.api,
  handler: tooMany('Too many requests from this address. Please slow down and try again later.'),
});

// Login layer 1: failed attempts per IP address (stops one machine trying
// many different accounts). Successful logins are not counted.
const loginIpLimiter = rateLimit({
  ...base,
  ...limits.loginIp,
  skipSuccessfulRequests: true,
  handler: tooMany('Too many failed login attempts from this address. Please try again later.'),
});

// Login layer 2: failed attempts per IP + email pair (stops password
// guessing against one account). Locks out after a handful of failures.
const loginAccountLimiter = rateLimit({
  ...base,
  ...limits.loginAccount,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const email =
      req.body && typeof req.body.email === 'string'
        ? req.body.email.trim().toLowerCase().slice(0, 254)
        : 'unknown';
    return `${ipKeyGenerator(req.ip)}|${email}`;
  },
  handler: tooMany('Too many failed login attempts for this account. Please try again later.'),
});

// Registration: only SUCCESSFUL sign-ups count (they are the expensive ones:
// password hashing + a database write), which stops mass account creation.
// Rejected attempts (validation errors, duplicates) do not use up the quota.
const registerLimiter = rateLimit({
  ...base,
  ...limits.register,
  skipFailedRequests: true,
  handler: tooMany('Too many accounts created from this address. Please try again later.'),
});

// Booking creation: per authenticated user (falls back to IP), every attempt
// counts. Prevents scripted booking floods.
const bookingLimiter = rateLimit({
  ...base,
  ...limits.booking,
  keyGenerator: (req) => (req.user && req.user.id ? `user:${req.user.id}` : ipKeyGenerator(req.ip)),
  handler: tooMany('Too many booking requests. Please wait a moment before booking again.'),
});

module.exports = { apiLimiter, loginIpLimiter, loginAccountLimiter, registerLimiter, bookingLimiter, limits };
