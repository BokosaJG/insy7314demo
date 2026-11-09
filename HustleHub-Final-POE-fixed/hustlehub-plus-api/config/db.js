// config/db.js
// Connects to MongoDB using the connection string held in the .env file
// (Learning Unit 3, Theme 1). The URI is never hard-coded.

const mongoose = require('mongoose');
const { logEvent } = require('./logger');

// Defence in depth against NoSQL injection: any query operator such as
// {"$gt": ""} found inside a filter value is treated as plain data.
mongoose.set('sanitizeFilter', true);

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not defined in the environment');
  }
  await mongoose.connect(process.env.MONGO_URI);
  logEvent('db.connected', {});
};

module.exports = connectDB;
