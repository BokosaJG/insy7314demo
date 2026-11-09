// middleware/authenticateToken.js
// Protects routes by requiring a valid JWT in the Authorization header.
// Expected header format: Authorization: Bearer <token>
//
// Checks, in order:
//   1. a Bearer token is present                              (401 otherwise)
//   2. signature + expiry are valid, HS256 only                (403 otherwise)
//   3. the user still exists and the token's version "tv" matches the user's
//      current tokenVersion - this is what makes logout / revocation work
//      (403 otherwise). The role is also re-read from the database, so a role
//      change takes effect immediately instead of when the token expires.

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const { logEvent } = require('../config/logger');

const reject = (req, res, reason) => {
  logEvent('auth.token.rejected', { requestId: req.id, reason, ip: req.ip, path: req.originalUrl.split('?')[0] }, 'warn');
  // One generic message: never reveal whether the token expired, was
  // tampered with or was revoked.
  return res.status(403).json({ error: 'Invalid or expired token' });
};

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : null;

  if (!token) {
    logEvent('auth.token.missing', { requestId: req.id, ip: req.ip, path: req.originalUrl.split('?')[0] }, 'warn');
    return res.status(401).json({ error: 'Access token is required' });
  }

  // Pin the accepted algorithm so a token signed any other way is rejected.
  jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] }, async (err, decoded) => {
    if (err) return reject(req, res, err.name);

    try {
      if (!decoded || !mongoose.isValidObjectId(decoded.id)) return reject(req, res, 'BadPayload');

      const user = await User.findById(decoded.id).select('role tokenVersion');
      if (!user) return reject(req, res, 'UnknownUser');
      if (decoded.tv !== user.tokenVersion) return reject(req, res, 'Revoked');

      // Attach id + role (from the database) for controllers and requireRole.
      req.user = { id: user.id, role: user.role, exp: decoded.exp };
      return next();
    } catch (e) {
      return next(e);
    }
  });
};

// Role-based access control: only the listed roles may continue.
const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    logEvent(
      'authz.denied',
      { requestId: req.id, userId: req.user && req.user.id, role: req.user && req.user.role, required: allowedRoles, method: req.method, path: req.originalUrl.split('?')[0], ip: req.ip },
      'warn'
    );
    return res.status(403).json({ error: 'You do not have permission to perform this action' });
  }
  next();
};

module.exports = { authenticateToken, requireRole };
