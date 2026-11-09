// middleware/sanitizeRequest.js
// Global input sanitisation, applied to every request before it reaches
// validation or a controller.
//
//  1. NoSQL injection: object keys beginning with "$" (query operators such
//     as {"$gt": ""}) or containing "." (path traversal into documents) are
//     removed, as are prototype-pollution keys.
//  2. XSS: HTML tags/scripts are stripped from every string value, and
//     control characters / null bytes are removed.
//
// WHY NOT express-mongo-sanitize / xss-clean?
// This project runs Express 5. In Express 5 `req.query` is a read-only
// getter, and both packages try to assign to it, so every request crashes
// with "Cannot set property query of #<IncomingMessage> which has only a
// getter" (verified). xss-clean is also unmaintained. This middleware does
// the same job in a way that works on Express 5: it cleans the body and
// redefines `req.query` as an own property instead of assigning to it.
//
// Passwords are skipped for HTML stripping: they are never rendered, are
// hashed, and silently altering them would change what the user typed.

const sanitizeText = require('../utils/sanitize');
const { logEvent } = require('../config/logger');

const DO_NOT_TOUCH_STRINGS = new Set(['password']);
const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_DEPTH = 8;

const cleanValue = (value, key, stats, depth) => {
  if (typeof value === 'string') {
    return DO_NOT_TOUCH_STRINGS.has(key) ? value : sanitizeText(value);
  }
  if (depth >= MAX_DEPTH) {
    stats.removed += 1;
    return undefined;
  }
  if (Array.isArray(value)) {
    return value.map((item) => cleanValue(item, key, stats, depth + 1));
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (k.startsWith('$') || k.includes('.') || BLOCKED_KEYS.has(k)) {
        stats.removed += 1;
        continue;
      }
      // Reviewed: keys starting with $, containing '.', or named __proto__/constructor/prototype were skipped above.
      // eslint-disable-next-line security/detect-object-injection
      out[k] = cleanValue(v, k, stats, depth + 1);
    }
    return out;
  }
  return value;
};

const sanitizeRequest = (req, res, next) => {
  const stats = { removed: 0 };

  if (req.body && typeof req.body === 'object') {
    req.body = cleanValue(req.body, '', stats, 0);
  }

  // Express 5: req.query is a getter that re-parses on every access, so the
  // cleaned copy must be defined as an own property to persist.
  const cleanedQuery = cleanValue({ ...req.query }, '', stats, 0);
  Object.defineProperty(req, 'query', {
    value: cleanedQuery,
    writable: true,
    configurable: true,
    enumerable: true,
  });

  if (stats.removed > 0) {
    // Log that something suspicious happened - never the values themselves.
    logEvent(
      'security.input.sanitised',
      { requestId: req.id, method: req.method, path: req.path, ip: req.ip, removedKeys: stats.removed },
      'warn'
    );
  }

  next();
};

module.exports = sanitizeRequest;
