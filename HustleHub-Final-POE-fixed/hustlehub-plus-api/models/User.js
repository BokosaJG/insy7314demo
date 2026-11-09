// models/User.js
// Replaces the in-memory userStore from Part 1 with a MongoDB schema.
// Final part adds lockout and token-version fields (see comments below).

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['Client', 'Freelancer', 'Admin'], required: true },
    // Own security feature 1: persistent account lockout (survives restarts and
    // applies across IP addresses, unlike the in-memory rate limiter).
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
    // Own security feature 2: server-side token revocation. Every JWT carries
    // the version it was issued under; logging out bumps the version, which
    // instantly invalidates every token issued before.
    tokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
