jest.mock('../models/User', () => ({ findById: jest.fn() }));
jest.mock('../config/logger', () => ({ logEvent: jest.fn() }));

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { logEvent } = require('../config/logger');
const { authenticateToken, requireRole } = require('../middleware/authenticateToken');

const ID = '64b7f0f0f0f0f0f0f0f0f0f0';
const sign = (payload, opts = {}, secret = process.env.JWT_SECRET) =>
  jwt.sign(payload, secret, { algorithm: 'HS256', expiresIn: '1h', ...opts });

const run = (headers) =>
  new Promise((resolve) => {
    const req = { headers, id: 'req-1', ip: '127.0.0.1', originalUrl: '/api/x?y=1' };
    const res = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this; },
      json(b) { resolve({ req, res: this, body: b, next: false }); },
    };
    authenticateToken(req, res, (err) => resolve({ req, res, next: true, err }));
  });

const dbUser = (over = {}) => ({ select: jest.fn().mockResolvedValue({ id: ID, role: 'Freelancer', tokenVersion: 0, ...over }) });

beforeEach(() => jest.clearAllMocks());

describe('authenticateToken', () => {
  test('401 when there is no Authorization header', async () => {
    const r = await run({});
    expect(r.res.statusCode).toBe(401);
    expect(r.body.error).toBe('Access token is required');
    expect(logEvent).toHaveBeenCalledWith('auth.token.missing', expect.any(Object), 'warn');
  });

  test('401 when the scheme is not Bearer', async () => {
    expect((await run({ authorization: 'Basic abc' })).res.statusCode).toBe(401);
  });

  test('valid token + matching tokenVersion: user is attached from the DATABASE (role not trusted from token)', async () => {
    User.findById.mockReturnValue(dbUser({ role: 'Client' }));
    const token = sign({ id: ID, role: 'Admin', tv: 0 }); // token claims Admin, DB says Client
    const r = await run({ authorization: `Bearer ${token}` });
    expect(r.next).toBe(true);
    expect(r.req.user).toMatchObject({ id: ID, role: 'Client' });
  });

  test('REVOKED: tokenVersion in token is older than the user\'s -> 403 generic message', async () => {
    User.findById.mockReturnValue(dbUser({ tokenVersion: 3 }));
    const r = await run({ authorization: `Bearer ${sign({ id: ID, role: 'Freelancer', tv: 2 })}` });
    expect(r.res.statusCode).toBe(403);
    expect(r.body.error).toBe('Invalid or expired token');
    expect(logEvent).toHaveBeenCalledWith('auth.token.rejected', expect.objectContaining({ reason: 'Revoked' }), 'warn');
  });

  test('tokens from before the feature (no "tv" claim) are rejected', async () => {
    User.findById.mockReturnValue(dbUser());
    const r = await run({ authorization: `Bearer ${sign({ id: ID, role: 'Freelancer' })}` });
    expect(r.res.statusCode).toBe(403);
  });

  test('deleted user -> 403', async () => {
    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
    const r = await run({ authorization: `Bearer ${sign({ id: ID, role: 'Freelancer', tv: 0 })}` });
    expect(r.res.statusCode).toBe(403);
    expect(logEvent).toHaveBeenCalledWith('auth.token.rejected', expect.objectContaining({ reason: 'UnknownUser' }), 'warn');
  });

  test('wrong signing secret -> 403 (and the DB is never queried)', async () => {
    const r = await run({ authorization: `Bearer ${sign({ id: ID, role: 'Admin', tv: 0 }, {}, 'some-other-secret-value-1234567890123')}` });
    expect(r.res.statusCode).toBe(403);
    expect(User.findById).not.toHaveBeenCalled();
  });

  test('expired token -> 403 with the same generic message', async () => {
    const r = await run({ authorization: `Bearer ${sign({ id: ID, role: 'Freelancer', tv: 0 }, { expiresIn: -10 })}` });
    expect(r.res.statusCode).toBe(403);
    expect(r.body.error).toBe('Invalid or expired token');
  });

  test('"alg: none" and HS512 tokens are rejected (algorithm is pinned to HS256)', async () => {
    const none = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ id: ID, role: 'Admin', tv: 0 })).toString('base64url')}.`;
    expect((await run({ authorization: `Bearer ${none}` })).res.statusCode).toBe(403);
    const hs512 = jwt.sign({ id: ID, role: 'Admin', tv: 0 }, process.env.JWT_SECRET, { algorithm: 'HS512' });
    expect((await run({ authorization: `Bearer ${hs512}` })).res.statusCode).toBe(403);
  });

  test('payload id that is not an ObjectId (e.g. a NoSQL operator) is rejected before any query', async () => {
    const r = await run({ authorization: `Bearer ${sign({ id: 'not-an-id', role: 'Admin', tv: 0 })}` });
    expect(r.res.statusCode).toBe(403);
    expect(User.findById).not.toHaveBeenCalled();
  });

  test('database failure is passed to the error handler, not leaked', async () => {
    User.findById.mockReturnValue({ select: jest.fn().mockRejectedValue(new Error('db down')) });
    const r = await run({ authorization: `Bearer ${sign({ id: ID, role: 'Freelancer', tv: 0 })}` });
    expect(r.next).toBe(true);
    expect(r.err.message).toBe('db down');
  });
});

describe('requireRole', () => {
  const exec = (user, ...roles) => {
    const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
    let called = false;
    requireRole(...roles)({ user, id: 'r', originalUrl: '/x', method: 'GET', ip: '1.1.1.1' }, res, () => { called = true; });
    return { res, called };
  };

  test('allows a listed role', () => expect(exec({ role: 'Freelancer' }, 'Freelancer').called).toBe(true));
  test('allows any of several roles', () => expect(exec({ role: 'Admin' }, 'Client', 'Admin').called).toBe(true));
  test('403 for an unlisted role and the denial is logged', () => {
    const r = exec({ id: ID, role: 'Client' }, 'Admin');
    expect(r.called).toBe(false);
    expect(r.res.statusCode).toBe(403);
    expect(logEvent).toHaveBeenCalledWith('authz.denied', expect.objectContaining({ role: 'Client' }), 'warn');
  });
  test('403 when there is no user at all', () => expect(exec(undefined, 'Admin').res.statusCode).toBe(403));
});
