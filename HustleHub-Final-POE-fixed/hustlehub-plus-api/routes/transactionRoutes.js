// routes/transactionRoutes.js

const express = require('express');
const router = express.Router();

const { getTransactions, getMyIncome, getDashboard } = require('../controllers/transactionController');
const { authenticateToken, requireRole } = require('../middleware/authenticateToken');
const { dashboardRules } = require('../validators/transactionValidators');
const validate = require('../middleware/validate');

router.use(authenticateToken);

router.get('/', getTransactions);
router.get('/income', requireRole('Freelancer'), getMyIncome);
router.get('/dashboard', requireRole('Freelancer'), dashboardRules, validate, getDashboard);

module.exports = router;
