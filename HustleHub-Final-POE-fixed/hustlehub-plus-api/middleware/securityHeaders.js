// middleware/securityHeaders.js
// Helmet configuration plus a few headers Helmet does not set.
//
// This service only ever returns JSON - it never serves HTML, scripts or
// styles. The Content Security Policy therefore denies EVERYTHING by
// default ("default-src 'none'") and no resource type is re-enabled. If a
// response were ever rendered by a browser (e.g. an injected HTML error
// page), it could not load scripts, styles, images, frames or connections,
// and could not be framed by another site.

const helmet = require('helmet');

const USE_HTTPS = process.env.USE_HTTPS === 'true';

const cspDirectives = {
  defaultSrc: ["'none'"],
  scriptSrc: ["'none'"],
  styleSrc: ["'none'"],
  imgSrc: ["'none'"],
  fontSrc: ["'none'"],
  connectSrc: ["'none'"],
  mediaSrc: ["'none'"],
  objectSrc: ["'none'"],
  frameSrc: ["'none'"],
  workerSrc: ["'none'"],
  manifestSrc: ["'none'"],
  // These three do NOT fall back to default-src, so they are set explicitly.
  baseUri: ["'none'"],
  formAction: ["'none'"],
  frameAncestors: ["'none'"],
};

if (USE_HTTPS) {
  cspDirectives.upgradeInsecureRequests = [];
}

const helmetMiddleware = helmet({
  contentSecurityPolicy: { useDefaults: false, directives: cspDirectives },
  // Tell browsers to use HTTPS only for the next year (HTTPS deployments).
  strictTransportSecurity: { maxAge: 31536000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'no-referrer' },
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-site' },
  // Legacy clickjacking header, as a fallback for browsers without CSP.
  frameguard: { action: 'deny' },
});

// Extra headers: block powerful browser features and stop API responses
// (tokens, personal data) from being stored by browsers or shared caches.
const extraHeaders = (req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  next();
};

module.exports = [helmetMiddleware, extraHeaders];
