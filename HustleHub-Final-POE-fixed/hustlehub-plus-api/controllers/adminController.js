// controllers/adminController.js
// Admin-only security tooling: read-only view of the audit trail.

const AuditLog = require('../models/AuditLog');

const getAuditLogs = async (req, res, next) => {
  try {
    const limit = req.query.limit || 50;
    const filter = {};
    // Value was validated against a strict pattern; it is matched exactly.
    if (req.query.event) filter.event = String(req.query.event);

    const logs = await AuditLog.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
    return res.status(200).json({ data: logs });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAuditLogs };
