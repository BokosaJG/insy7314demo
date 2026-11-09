// utils/audit.js
// audit(req, 'gig.deleted', { gigId }) writes ONE audit record AND the matching
// structured log line. It never throws: failing to write an audit entry must
// not break the user's request (the failure itself is logged).

const crypto = require('crypto');
const AuditLog = require('../models/AuditLog');
const { logEvent, redact } = require('../config/logger');

const shortHash = (value) =>
  crypto.createHash('sha256').update(String(value).trim().toLowerCase()).digest('hex').slice(0, 12);

const audit = async (req, event, details = {}, { subject, level = 'info', actor } = {}) => {
  const safeDetails = redact(details);
  // Login has no req.user yet, so the caller can name the actor explicitly.
  const who = actor || req.user || {};
  logEvent(event, {
    requestId: req.id,
    userId: who.id,
    role: who.role,
    subject,
    ip: req.ip,
    ...safeDetails,
  }, level);

  try {
    await AuditLog.create({
      event,
      actor: who.id,
      actorRole: who.role,
      subject,
      ip: req.ip,
      requestId: req.id,
      details: safeDetails,
    });
  } catch (err) {
    logEvent('audit.write.failed', { requestId: req.id, auditEvent: event, error: err.name }, 'error');
  }
};

module.exports = { audit, shortHash };
