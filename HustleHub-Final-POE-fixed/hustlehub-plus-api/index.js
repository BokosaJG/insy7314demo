// index.js
// Main entry point for the HustleHub+ backend API.
// Final part adds: structured logging (config/logger.js), an audit trail, the
// income/tax dashboard, account lockout and token revocation.
// Part 2 (Security Hardening) adds: request ids, a restrictive CSP and extra
// security headers, rate limiting, request sanitisation, express-validator
// validation (see routes/ and validators/) and a hardened error handler.

require('dotenv').config({ quiet: true });

const express = require('express');
const cors = require('cors');
const https = require('https');
const fs = require('fs');
const path = require('path');

const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const gigRoutes = require('./routes/gigRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const adminRoutes = require('./routes/adminRoutes');
const requestLogger = require('./middleware/requestLogger');
const { logEvent, flushLogs } = require('./config/logger');
const errorHandler = require('./middleware/errorHandler');
const { notFound } = errorHandler;
const requestId = require('./middleware/requestId');
const securityHeaders = require('./middleware/securityHeaders');
const { apiLimiter } = require('./middleware/rateLimiters');
const requireJson = require('./middleware/requireJson');
const sanitizeRequest = require('./middleware/sanitizeRequest');

const app = express();

const PORT = process.env.PORT || 4000;
const USE_HTTPS = process.env.USE_HTTPS === 'true';
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

// Hide the technology stack from response headers.
app.disable('x-powered-by');

// Behind a reverse proxy / load balancer the real client IP is in
// X-Forwarded-For. Rate limiting needs the right IP, so set TRUST_PROXY to the
// number of proxies in front of the app (leave unset when not behind one).
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
}

// 1. Identify the request, then set security headers (Helmet + extras).
app.use(requestId);
app.use(requestLogger);
app.use(securityHeaders);

// 2. Only the configured frontend origin may call this API from a browser.
app.use(
  cors({
    origin: CLIENT_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// 3. General rate limit on the whole API, applied BEFORE body parsing so a
//    flood of large requests is rejected cheaply.
app.use('/api', apiLimiter);

// 4. Body handling: JSON only, small size limit, then sanitise everything.
app.use(requireJson);
app.use(express.json({ limit: '10kb' }));
app.use(sanitizeRequest);

// Root route - simple confirmation that the API is running.
app.get('/', (req, res) => {
  res.status(200).json({
    app: process.env.APP_NAME || 'HustleHub+',
    message: 'API is running securely',
  });
});

// Health route - useful for developers and deployment platforms.
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    protocol: USE_HTTPS ? 'HTTPS' : 'HTTP',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/gigs', gigRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/admin', adminRoutes);

// Unknown routes, then the central error handler (must be registered last).
app.use(notFound);
app.use(errorHandler);

// Refuse to start with a missing or weak signing secret.
const checkEnvironment = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not defined in the environment');
  if (secret.length < 32) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be at least 32 characters in production');
    }
    logEvent('config.weak_secret', { message: 'JWT_SECRET is shorter than 32 characters - use a long random value' }, 'warn');
  }
};

const startServer = async () => {
  checkEnvironment();
  await connectDB();

  if (USE_HTTPS) {
    const keyPath = process.env.SSL_KEY_PATH || path.join(__dirname, 'certs', 'localhost-key.pem');
    const certPath = process.env.SSL_CERT_PATH || path.join(__dirname, 'certs', 'localhost-cert.pem');

    // Reviewed: both paths come from operator-set environment variables, never from a request.
    /* eslint-disable security/detect-non-literal-fs-filename */
    const tlsOptions = { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
    /* eslint-enable security/detect-non-literal-fs-filename */

    server = https
      .createServer(tlsOptions, app)
      .listen(PORT, () => logEvent('server.started', { protocol: 'HTTPS', port: Number(PORT) }));
  } else {
    server = app.listen(PORT, () => logEvent('server.started', { protocol: 'HTTP', port: Number(PORT) }));
  }
};

// Finish in-flight requests and flush cloud logs before exiting (Docker sends
// SIGTERM on "docker stop").
let server;
const shutdown = (signal) => {
  logEvent('server.shutdown', { signal });
  const done = () => flushLogs().finally(() => process.exit(0));
  if (server) server.close(done); else done();
  setTimeout(() => process.exit(1), 10000).unref();
};

// Last-resort safety nets: log server-side, never crash silently.
process.on('unhandledRejection', (reason) => {
  logEvent('process.unhandled_rejection', { reason: reason instanceof Error ? reason.message : String(reason) }, 'error');
});

// Only start listening when run directly (so the app can also be imported by tests).
if (require.main === module) {
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  startServer().catch((err) => {
    logEvent('server.start_failed', { error: err.message }, 'error');
    flushLogs().finally(() => process.exit(1));
  });
}

module.exports = app;
