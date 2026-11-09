// HTTP-level tests of the real Express app (routes, validators, security
// middleware) with the database models mocked, so no MongoDB is needed.

const chain = (result) => {
  const c = {};
  ['select', 'sort', 'limit', 'populate'].forEach((m) => { c[m] = jest.fn(() => c); });
  c.lean = jest.fn(() => Promise.resolve(result));
  c.then = (res, rej) => Promise.resolve(result).then(res, rej);
  return c;
};

jest.mock('../models/User', () => ({ findById: jest.fn(), findOne: jest.fn(), create: jest.fn(), updateOne: jest.fn(), findOneAndUpdate: jest.fn() }));
jest.mock('../models/Transaction', () => ({ find: jest.fn(), aggregate: jest.fn() }));
jest.mock('../models/Booking', () => ({ find: jest.fn() }));
jest.mock('../models/Gig', () => ({ find: jest.fn(), findById: jest.fn() }));
jest.mock('../models/AuditLog', () => ({ find: jest.fn(), create: jest.fn().mockResolvedValue({}) }));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Booking = require('../models/Booking');
const AuditLog = require('../models/AuditLog');
const app = require('../index');

const ID = '64b7f0f0f0f0f0f0f0f0f0f0';
const asRole = (role) => {
  User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ id: ID, role, tokenVersion: 0 }) });
  return `Bearer ${jwt.sign({ id: ID, role, tv: 0 }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' })}`;
};

beforeEach(() => jest.clearAllMocks());

describe('public endpoints and security headers', () => {
  test('GET /health is OK and carries Helmet + CSP headers, no X-Powered-By', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toMatch(/default-src 'none'|default-src/);
    expect(res.headers['x-request-id']).toBeDefined();
  });

  test('unknown route -> JSON 404 without internals', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Route not found' });
  });

  test('POST with a non-JSON content type is refused (415)', async () => {
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'text/plain').send('email=a');
    expect(res.status).toBe(415);
  });

  test('malformed JSON -> 400 with a generic message, no stack trace or path', async () => {
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":');
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toMatch(/SyntaxError|node_modules|\.js:\d+|at /);
  });
});

describe('input validation on login', () => {
  test('missing fields -> 400 with field names only (no echoed input)', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.details.map((d) => d.field)).toEqual(expect.arrayContaining(['email', 'password']));
  });

  test('NoSQL operator object as email is rejected before the database is touched', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: { $ne: null }, password: 'x' });
    expect(res.status).toBe(400);
    expect(User.findOne).not.toHaveBeenCalled();
  });
});

describe('authentication / authorisation on the final-part endpoints', () => {
  test.each([
    ['GET', '/api/transactions/dashboard'],
    ['GET', '/api/admin/audit-logs'],
    ['POST', '/api/auth/logout'],
  ])('%s %s without a token -> 401', async (method, url) => {
    const res = await request(app)[method.toLowerCase()](url);
    expect(res.status).toBe(401);
  });

  test('dashboard is Freelancer only (Client and Admin get 403)', async () => {
    for (const role of ['Client', 'Admin']) {
      const res = await request(app).get('/api/transactions/dashboard').set('Authorization', asRole(role));
      expect(res.status).toBe(403);
    }
    expect(Transaction.find).not.toHaveBeenCalled();
  });

  test('audit log is Admin only', async () => {
    for (const role of ['Client', 'Freelancer']) {
      const res = await request(app).get('/api/admin/audit-logs').set('Authorization', asRole(role));
      expect(res.status).toBe(403);
    }
    expect(AuditLog.find).not.toHaveBeenCalled();
  });

  test('a revoked token (old tokenVersion) is refused on every protected route', async () => {
    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ id: ID, role: 'Admin', tokenVersion: 5 }) });
    const token = jwt.sign({ id: ID, role: 'Admin', tv: 4 }, process.env.JWT_SECRET, { algorithm: 'HS256' });
    const res = await request(app).get('/api/admin/audit-logs').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Invalid or expired token');
  });
});

describe('GET /api/transactions/dashboard', () => {
  const stub = (txs, bookings = []) => {
    Transaction.find.mockReturnValue(chain(txs));
    Booking.find.mockReturnValue(chain(bookings));
  };

  test('returns income, monthly buckets and tax for the freelancer', async () => {
    const bookingId = '64b7f0f0f0f0f0f0f0f0f0a1';
    stub([{ amount: 360000, createdAt: new Date('2026-05-10T00:00:00Z'), booking: bookingId }], [{ _id: bookingId, gigTitle: 'Brand identity' }]);
    const res = await request(app).get('/api/transactions/dashboard?taxYear=2027').set('Authorization', asRole('Freelancer'));
    expect(res.status).toBe(200);
    expect(res.body.data.summary.grossIncome).toBe(360000);
    expect(res.body.data.tax.estimatedTax).toBe(56172);
    expect(res.body.data.topGigs[0].title).toBe('Brand identity');
    expect(res.body.data.monthly[2].income).toBe(360000); // May
  });

  test('the query is always scoped to the logged-in freelancer (id from the token, not the URL)', async () => {
    stub([]);
    await request(app).get('/api/transactions/dashboard?freelancer=64b7f0f0f0f0f0f0f0f0ffff').set('Authorization', asRole('Freelancer'));
    expect(Transaction.find.mock.calls[0][0].freelancer).toBe(ID);
  });

  test('defaults to the current tax year', async () => {
    stub([]);
    const res = await request(app).get('/api/transactions/dashboard').set('Authorization', asRole('Freelancer'));
    expect(res.status).toBe(200);
    expect(res.body.data.taxYear).toBeGreaterThanOrEqual(2026);
  });

  test.each([['taxYear=1999'], ['taxYear=abc'], ['taxYear=2027.5'], ['taxYear=2026&taxYear=2027'], ['taxYear=%3Cscript%3E']])('invalid query %s -> 400 and the value is not echoed', async (qs) => {
    stub([]);
    const res = await request(app).get(`/api/transactions/dashboard?${qs}`).set('Authorization', asRole('Freelancer'));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(JSON.stringify(res.body)).not.toContain('<script');
    expect(Transaction.find).not.toHaveBeenCalled();
  });

  test('database failure -> generic 500, nothing leaked', async () => {
    Transaction.find.mockImplementation(() => { throw new Error('connection string mongodb://secret:pw@host'); });
    const res = await request(app).get('/api/transactions/dashboard').set('Authorization', asRole('Freelancer'));
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/secret|mongodb:/);
  });
});

describe('GET /api/admin/audit-logs', () => {
  test('returns entries newest first, honouring limit and event filter', async () => {
    const c = chain([{ event: 'auth.logout' }]);
    AuditLog.find.mockReturnValue(c);
    const res = await request(app).get('/api/admin/audit-logs?limit=5&event=auth.logout').set('Authorization', asRole('Admin'));
    expect(res.status).toBe(200);
    expect(AuditLog.find).toHaveBeenCalledWith({ event: 'auth.logout' });
    expect(c.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(c.limit).toHaveBeenCalledWith(5);
    expect(res.body.data).toEqual([{ event: 'auth.logout' }]);
  });

  test.each([['limit=0'], ['limit=101'], ['limit=abc'], ['event=x%24ne'], ['event=Auth.Login'], ['event=a;b']])('invalid query %s -> 400', async (qs) => {
    const res = await request(app).get(`/api/admin/audit-logs?${qs}`).set('Authorization', asRole('Admin'));
    expect(res.status).toBe(400);
    expect(AuditLog.find).not.toHaveBeenCalled();
  });

  test('operator injection through the query string cannot reach the database filter', async () => {
    AuditLog.find.mockReturnValue(chain([]));
    await request(app).get('/api/admin/audit-logs?event[$ne]=x').set('Authorization', asRole('Admin'));
    const filter = AuditLog.find.mock.calls[0] ? AuditLog.find.mock.calls[0][0] : {};
    expect(JSON.stringify(filter)).not.toContain('$ne');
  });
});

describe('POST /api/auth/logout', () => {
  test('revokes the caller\'s tokens', async () => {
    User.updateOne.mockResolvedValue({});
    const res = await request(app).post('/api/auth/logout').set('Authorization', asRole('Freelancer'));
    expect(res.status).toBe(200);
    expect(User.updateOne).toHaveBeenCalledWith({ _id: ID }, { $inc: { tokenVersion: 1 } });
  });
});
