// routes/adminRoutes.js
// Everything here is Admin only: JWT -> role -> validation -> controller.

const express = require('express');
const router = express.Router();

const { getAuditLogs } = require('../controllers/adminController');
const { authenticateToken, requireRole } = require('../middleware/authenticateToken');
const { auditLogRules } = require('../validators/adminValidators');
const validate = require('../middleware/validate');

router.use(authenticateToken, requireRole('Admin'));

router.get('/audit-logs', auditLogRules, validate, getAuditLogs);

module.exports = router;
