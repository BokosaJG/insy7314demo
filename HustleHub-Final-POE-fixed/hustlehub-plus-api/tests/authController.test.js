jest.mock('../models/User', () => ({ findOne: jest.fn(), findOneAndUpdate: jest.fn(), updateOne: jest.fn(), create: jest.fn() }));
jest.mock('../utils/audit', () => ({ audit: jest.fn().mockResolvedValue(undefined), shortHash: jest.fn(() => 'abc123abc123') }));

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { audit } = require('../utils/audit');
const { login, logout, register } = require('../controllers/authController');

const ID = '64b7f0f0f0f0f0f0f0f0f0f0';
const PASSWORD = 'StrongPass1';
let HASH;
beforeAll(async () => { HASH = await bcrypt.hash(PASSWORD, 4); });

const makeUser = (over = {}) => ({ _id: ID, id: ID, name: 'T', email: 't@x.com', role: 'Freelancer', passwordHash: HASH, failedLoginAttempts: 0, tokenVersion: 7, ...over });
const call = async (fn, body = {}, user) => {
  const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  const next = jest.fn();
  await fn({ body, user, id: 'r1', ip: '127.0.0.1' }, res, next);
  return { res, next };
};

beforeEach(() => { jest.clearAllMocks(); process.env.ACCOUNT_LOCK_THRESHOLD = '3'; process.env.ACCOUNT_LOCK_MINUTES = '15'; });
afterAll(() => { delete process.env.ACCOUNT_LOCK_THRESHOLD; delete process.env.ACCOUNT_LOCK_MINUTES; });

describe('login', () => {
  test('success: token carries id, role AND tokenVersion; counters reset only if needed; audited', async () => {
    User.findOne.mockResolvedValue(makeUser());
    const { res } = await call(login, { email: 't@x.com', password: PASSWORD });
    expect(res.statusCode).toBe(200);
    const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(decoded).toMatchObject({ id: ID, role: 'Freelancer', tv: 7 });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/);
    expect(User.updateOne).not.toHaveBeenCalled();
    expect(audit).toHaveBeenCalledWith(expect.anything(), 'auth.login.success', {}, expect.any(Object));
  });

  test('success after earlier failures clears the failure counter and any expired lock', async () => {
    User.findOne.mockResolvedValue(makeUser({ failedLoginAttempts: 2, lockUntil: new Date(Date.now() - 1000) }));
    const { res } = await call(login, { email: 't@x.com', password: PASSWORD });
    expect(res.statusCode).toBe(200);
    expect(User.updateOne).toHaveBeenCalledWith({ _id: ID }, { $set: { failedLoginAttempts: 0 }, $unset: { lockUntil: '' } });
  });

  test('wrong password: 401 generic message and the failure counter is incremented atomically', async () => {
    User.findOne.mockResolvedValue(makeUser());
    User.findOneAndUpdate.mockResolvedValue({ failedLoginAttempts: 1 });
    const { res } = await call(login, { email: 't@x.com', password: 'WrongPass1' });
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid email or password' });
    expect(User.findOneAndUpdate).toHaveBeenCalledWith({ _id: ID }, { $inc: { failedLoginAttempts: 1 } }, { new: true });
    expect(User.updateOne).not.toHaveBeenCalled(); // not locked yet
  });

  test('reaching the threshold sets lockUntil ~15 minutes ahead, resets the counter and audits the lock', async () => {
    User.findOne.mockResolvedValue(makeUser({ failedLoginAttempts: 2 }));
    User.findOneAndUpdate.mockResolvedValue({ failedLoginAttempts: 3 });
    const before = Date.now();
    const { res } = await call(login, { email: 't@x.com', password: 'WrongPass1' });
    expect(res.statusCode).toBe(401);
    const [filter, update] = User.updateOne.mock.calls[0];
    expect(filter).toEqual({ _id: ID });
    expect(update.$set.failedLoginAttempts).toBe(0);
    expect(update.$set.lockUntil.getTime()).toBeGreaterThanOrEqual(before + 15 * 60 * 1000 - 50);
    expect(audit).toHaveBeenCalledWith(expect.anything(), 'auth.account.locked', expect.any(Object), expect.any(Object));
  });

  test('LOCKED account: 423 even with the CORRECT password, no token, counter not touched', async () => {
    User.findOne.mockResolvedValue(makeUser({ lockUntil: new Date(Date.now() + 60000) }));
    const { res } = await call(login, { email: 't@x.com', password: PASSWORD });
    expect(res.statusCode).toBe(423);
    expect(res.body.token).toBeUndefined();
    expect(User.findOneAndUpdate).not.toHaveBeenCalled();
    expect(audit).toHaveBeenCalledWith(expect.anything(), 'auth.login.blocked_locked', {}, expect.any(Object));
  });

  test('unknown email: identical 401 body, nothing to increment, still audited as a failure', async () => {
    User.findOne.mockResolvedValue(null);
    const { res } = await call(login, { email: 'nobody@x.com', password: 'WrongPass1' });
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid email or password' });
    expect(User.findOneAndUpdate).not.toHaveBeenCalled();
    expect(audit).toHaveBeenCalledWith(expect.anything(), 'auth.login.failure', { reason: 'unknown_email' }, expect.any(Object));
  });

  test('database errors go to next() (central handler)', async () => {
    User.findOne.mockRejectedValue(new Error('boom'));
    const { next } = await call(login, { email: 't@x.com', password: PASSWORD });
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe('logout (token revocation)', () => {
  test('bumps tokenVersion for the authenticated user and audits it', async () => {
    User.updateOne.mockResolvedValue({});
    const { res } = await call(logout, {}, { id: ID, role: 'Freelancer' });
    expect(User.updateOne).toHaveBeenCalledWith({ _id: ID }, { $inc: { tokenVersion: 1 } });
    expect(res.statusCode).toBe(200);
    expect(audit).toHaveBeenCalledWith(expect.anything(), 'auth.logout', {});
  });
});

describe('register', () => {
  test('duplicate email -> 409 without creating anything', async () => {
    User.findOne.mockResolvedValue(makeUser());
    const { res } = await call(register, { name: 'T', email: 't@x.com', password: PASSWORD, role: 'Client' });
    expect(res.statusCode).toBe(409);
    expect(User.create).not.toHaveBeenCalled();
  });

  test('success stores a bcrypt HASH (never the password) and returns only safe fields', async () => {
    User.findOne.mockResolvedValue(null);
    User.create.mockImplementation(async (doc) => ({ id: ID, ...doc }));
    const { res } = await call(register, { name: 'T', email: 't@x.com', password: PASSWORD, role: 'Client' });
    const stored = User.create.mock.calls[0][0];
    expect(stored.password).toBeUndefined();
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$12\$/);
    expect(await bcrypt.compare(PASSWORD, stored.passwordHash)).toBe(true);
    expect(res.statusCode).toBe(201);
    expect(Object.keys(res.body.data).sort()).toEqual(['email', 'id', 'name', 'role']);
  });
});
