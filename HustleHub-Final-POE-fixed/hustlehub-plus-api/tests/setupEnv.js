// Runs before every test file.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'unit_test_secret_that_is_longer_than_thirty_two_chars';
process.env.USE_HTTPS = 'false';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
