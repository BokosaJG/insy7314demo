// Jest configuration for the backend unit / component tests.
// Database-free: models are mocked, so the tests run anywhere (laptop, CI).
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  setupFiles: ['<rootDir>/tests/setupEnv.js'],
  collectCoverageFrom: [
    'utils/**/*.js',
    'middleware/**/*.js',
    'validators/**/*.js',
    'config/taxTables.js',
    'config/logger.js',
    'controllers/authController.js',
    'controllers/transactionController.js',
    'controllers/adminController.js',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'lcov'],
  coverageThreshold: { global: { statements: 80, branches: 70, functions: 80, lines: 80 } },
};
