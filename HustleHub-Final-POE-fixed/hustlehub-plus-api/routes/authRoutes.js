// routes/authRoutes.js
// Order of middleware on each public route:
//   rate limiter -> validation rules -> validate (400 on failure) -> controller
// Limiters run first so a flood of bad requests is cut off cheaply.

const express = require('express');
const router = express.Router();

const { register, login, logout, getProfile } = require('../controllers/authController');
const { registerRules, loginRules } = require('../validators/authValidators');
const validate = require('../middleware/validate');
const { authenticateToken } = require('../middleware/authenticateToken');
const { registerLimiter, loginIpLimiter, loginAccountLimiter } = require('../middleware/rateLimiters');

router.post('/register', registerLimiter, registerRules, validate, register);
router.post('/login', loginIpLimiter, loginAccountLimiter, loginRules, validate, login);

// Protected routes which require a valid JWT.
router.get('/profile', authenticateToken, getProfile);
router.post('/logout', authenticateToken, logout);

module.exports = router;
