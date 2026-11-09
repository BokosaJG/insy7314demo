// config/logger.js
// Central structured logger (Winston). Every log line is one JSON object:
//   { timestamp, level, service, env, event, message, requestId, ... }
//
// Destinations:
//   1. Console           - always (JSON; Docker / hosting platforms collect stdout)
//   2. logs/app.log      - all events, rotated by size (kept on disk / Docker volume)
//   3. logs/security.log - warn + error events only (what a security team reviews first)
//   4. Better Stack      - cloud log platform, ONLY when LOGTAIL_SOURCE_TOKEN and
//                          LOGTAIL_INGESTING_HOST are set (see README "Logging")
//
// Safety rules:
//   * Secrets are redacted by key name before anything is written, so a
//     password, token or Authorization header can never reach a log, even
//     if a developer logs a whole request object by mistake.
//   * Messages are JSON-encoded, so a user supplying "\n" cannot forge a
//     second log line (log injection).
//   * Under NODE_ENV=test the logger is silent.

const path = require('path');
const winston = require('winston');

const SENSITIVE_KEYS = /^(password|passwordhash|token|authorization|jwt_secret|secret|cookie|set-cookie|logtail_source_token|mongo_uri)$/i;
const MAX_STRING = 500;
const MAX_DEPTH = 5;

const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const redact = (value, depth = 0) => {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}...[truncated]` : value;
  if (typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  if (depth >= MAX_DEPTH) return '[max depth]';
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (BLOCKED_KEYS.has(k)) continue; // never copy prototype-related keys
    // Reviewed: k is an own key of the object being logged and prototype keys are skipped above.
    // eslint-disable-next-line security/detect-object-injection
    out[k] = SENSITIVE_KEYS.test(k) ? '[REDACTED]' : redact(v, depth + 1);
  }
  return out;
};

// Mutates the log entry in place (Winston stores internal symbol keys on it, so
// it must not be replaced by a new object).
const redactFormat = winston.format((info) => {
  for (const key of Object.keys(info)) {
    if (key === 'level' || key === 'message') continue; // fixed fields stay as they are
    // Reviewed: key comes from Object.keys(info) of an entry built by our own code.
    // eslint-disable-next-line security/detect-object-injection
    info[key] = SENSITIVE_KEYS.test(key) ? '[REDACTED]' : redact(info[key]);
  }
  return info;
});

const isTest = process.env.NODE_ENV === 'test';
const logDir = process.env.LOG_DIR || path.join(__dirname, '..', 'logs');

const baseFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: false }), // stacks stay out of structured logs sent to third parties
  redactFormat(),
  winston.format.json()
);

const transports = [new winston.transports.Console({ silent: isTest })];

if (!isTest && process.env.LOG_TO_FILE !== 'false') {
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'app.log'),
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
      tailable: true,
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'security.log'),
      level: 'warn',
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
      tailable: true,
    })
  );
}

// Cloud logging (Better Stack). Optional: the app runs fine without it.
let logtail = null;
if (!isTest && process.env.LOGTAIL_SOURCE_TOKEN && process.env.LOGTAIL_INGESTING_HOST) {
  const { Logtail } = require('@logtail/node');
  const { LogtailTransport } = require('@logtail/winston');
  logtail = new Logtail(process.env.LOGTAIL_SOURCE_TOKEN, {
    endpoint: `https://${process.env.LOGTAIL_INGESTING_HOST}`,
  });
  transports.push(new LogtailTransport(logtail));
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: { service: process.env.APP_NAME || 'HustleHub+ API', env: process.env.NODE_ENV || 'development' },
  format: baseFormat,
  transports,
});

// logEvent('auth.login.failure', { requestId, reason }, 'warn')
// "event" is a stable machine-readable name used for searching and alerting.
const logEvent = (event, meta = {}, level = 'info') => {
  logger.log(level, event, { event, ...meta });
};

// Send any buffered cloud logs before the process exits.
const flushLogs = async () => {
  if (logtail) await logtail.flush();
};

module.exports = { logger, logEvent, flushLogs, redact, cloudLoggingEnabled: Boolean(logtail) };
