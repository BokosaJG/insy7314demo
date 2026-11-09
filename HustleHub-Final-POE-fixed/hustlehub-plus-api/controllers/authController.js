// controllers/authController.js
// Registration, login, logout and the protected "who am I" profile check.
// Route paths live in routes/authRoutes.js; this file holds what happens once
// a request reaches an endpoint.
//
// Final-part security features implemented here:
//   * persistent account lockout after repeated failed logins
//   * logout that revokes every token the user holds (tokenVersion)
//   * audit trail + structured log events for every authentication outcome

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { audit, shortHash } = require('../utils/audit');

const SALT_ROUNDS = 12;

const positiveInt = (value, fallback) => {
  const n = parseInt(value, 10);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

// Read per call so tests (and operators) can change them without a restart.
const lockThreshold = () => positiveInt(process.env.ACCOUNT_LOCK_THRESHOLD, 5);
const lockMinutes = () => positiveInt(process.env.ACCOUNT_LOCK_MINUTES, 15);

// A real bcrypt hash of a throw-away value. When the email is unknown we
// still run bcrypt.compare against it, so "unknown email" and "wrong
// password" take about the same time and cannot be told apart by timing.
const DUMMY_HASH = bcrypt.hashSync('timing-equalisation-only', SALT_ROUNDS);

const register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      await audit(req, 'auth.register.duplicate', {}, { subject: shortHash(email), level: 'warn' });
      // 409 Conflict: the resource already exists.
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    // Passwords are never stored in plain text: bcrypt salts and hashes them.
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const newUser = await User.create({ name, email, passwordHash, role });
    await audit(req, 'auth.register.success', { newUserId: newUser.id, role: newUser.role }, { actor: { id: newUser.id, role: newUser.role } });

    // Only safe fields are returned; the hash is never sent to the client.
    return res.status(201).json({
      message: 'User registered successfully',
      data: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const subject = shortHash(email);

    const user = await User.findOne({ email });

    // Always run bcrypt, even for an unknown email or a locked account, so the
    // response time does not reveal which case happened.
    const passwordMatches = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);

    // Locked accounts are refused even when the password is right, otherwise
    // the lock would not stop a guessing attack that eventually succeeds.
    if (user && user.lockUntil && user.lockUntil > new Date()) {
      await audit(req, 'auth.login.blocked_locked', {}, { subject, level: 'warn', actor: { id: user.id, role: user.role } });
      return res.status(423).json({ error: 'Account temporarily locked after repeated failed sign-ins. Please try again later.' });
    }

    // Same generic message for unknown email and wrong password, to
    // prevent user enumeration.
    if (!user || !passwordMatches) {
      if (user) {
        // Atomic increment: concurrent guesses cannot slip past the counter.
        const updated = await User.findOneAndUpdate(
          { _id: user._id },
          { $inc: { failedLoginAttempts: 1 } },
          { new: true }
        );
        if (updated && updated.failedLoginAttempts >= lockThreshold()) {
          const lockUntil = new Date(Date.now() + lockMinutes() * 60 * 1000);
          await User.updateOne({ _id: user._id }, { $set: { lockUntil, failedLoginAttempts: 0 } });
          await audit(req, 'auth.account.locked', { minutes: lockMinutes() }, { subject, level: 'warn', actor: { id: user.id, role: user.role } });
        }
      }
      await audit(req, 'auth.login.failure', { reason: user ? 'bad_password' : 'unknown_email' }, { subject, level: 'warn' });
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Successful login clears any partial failure count.
    if (user.failedLoginAttempts || user.lockUntil) {
      await User.updateOne({ _id: user._id }, { $set: { failedLoginAttempts: 0 }, $unset: { lockUntil: '' } });
    }

    // The JWT payload holds only the user's id, role and token version.
    const token = jwt.sign(
      { id: user.id, role: user.role, tv: user.tokenVersion },
      process.env.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );

    await audit(req, 'auth.login.success', {}, { subject, actor: { id: user.id, role: user.role } });

    return res.status(200).json({
      message: 'Login successful',
      token,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Logout = revoke. Bumping tokenVersion makes every token issued so far
// (on every device) fail verification immediately.
const logout = async (req, res, next) => {
  try {
    await User.updateOne({ _id: req.user.id }, { $inc: { tokenVersion: 1 } });
    await audit(req, 'auth.logout', {});
    return res.status(200).json({ message: 'Logged out. All tokens for this account are now invalid.' });
  } catch (err) {
    next(err);
  }
};

// Minimal protected endpoint showing JWT validation beyond login.
const getProfile = (req, res) => {
  res.status(200).json({
    message: 'Token verified successfully',
    data: req.user,
  });
};

module.exports = { register, login, logout, getProfile };
