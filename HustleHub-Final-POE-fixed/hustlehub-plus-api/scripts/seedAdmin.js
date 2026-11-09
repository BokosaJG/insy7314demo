// scripts/seedAdmin.js
// Creates the first Admin account. Run once with: npm run seed:admin
// Credentials come from the .env file (ADMIN_NAME, ADMIN_EMAIL,
// ADMIN_PASSWORD) so no secret is hard-coded in the repository.

require('dotenv').config({ quiet: true });

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

const seedAdmin = async () => {
  const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env');
  }

  await connectDB();

  const email = ADMIN_EMAIL.trim().toLowerCase();
  if (await User.findOne({ email })) {
    console.log('Admin already exists - nothing to do');
    return;
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await User.create({ name: ADMIN_NAME, email, passwordHash, role: 'Admin' });
  console.log('Admin account created');
};

seedAdmin()
  .catch((err) => console.error('Seeding failed:', err.message))
  .finally(() => mongoose.disconnect());
