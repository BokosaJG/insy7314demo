// models/AuditLog.js
// Tamper-resistant record of security-relevant actions, kept in MongoDB so an
// Admin can review it in the app (log files and the cloud platform hold the
// same events for engineers). Entries are only ever created, never edited or
// deleted through the API. A TTL index removes them after AUDIT_RETENTION_DAYS.

const mongoose = require('mongoose');

const RETENTION_DAYS = Number(process.env.AUDIT_RETENTION_DAYS) > 0 ? Number(process.env.AUDIT_RETENTION_DAYS) : 90;

const auditLogSchema = new mongoose.Schema(
  {
    event: { type: String, required: true, index: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actorRole: { type: String },
    // Failed logins have no known user: a short hash of the e-mail is kept so
    // repeated attempts can be correlated without storing the address itself.
    subject: { type: String },
    ip: { type: String },
    requestId: { type: String },
    details: { type: mongoose.Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now, expires: RETENTION_DAYS * 24 * 60 * 60 },
  },
  { versionKey: false }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
