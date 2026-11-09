jest.mock('../models/AuditLog', () => ({ create: jest.fn() }));
jest.mock('../config/logger', () => ({ logEvent: jest.fn(), redact: jest.requireActual('../config/logger').redact }));

const AuditLog = require('../models/AuditLog');
const { logEvent } = require('../config/logger');
const { audit, shortHash } = require('../utils/audit');

beforeEach(() => jest.clearAllMocks());

describe('shortHash (privacy-preserving subject id)', () => {
  test('is 12 hex chars, stable, case/space-insensitive and does not contain the e-mail', () => {
    const h = shortHash('  Alice@Example.COM ');
    expect(h).toMatch(/^[0-9a-f]{12}$/);
    expect(h).toBe(shortHash('alice@example.com'));
    expect(h).not.toContain('alice');
    expect(shortHash('bob@example.com')).not.toBe(h);
  });
});

describe('audit()', () => {
  const req = { id: 'req-9', ip: '10.0.0.1', user: { id: 'u1', role: 'Client' } };

  test('writes the audit record and the structured log line, with secrets redacted from details', async () => {
    AuditLog.create.mockResolvedValue({});
    await audit(req, 'booking.created', { bookingId: 'b1', password: 'leak', token: 'leak' });
    expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      event: 'booking.created', actor: 'u1', actorRole: 'Client', ip: '10.0.0.1', requestId: 'req-9',
      details: { bookingId: 'b1', password: '[REDACTED]', token: '[REDACTED]' },
    }));
    expect(logEvent).toHaveBeenCalledWith('booking.created', expect.objectContaining({ userId: 'u1', requestId: 'req-9' }), 'info');
    expect(JSON.stringify(logEvent.mock.calls)).not.toContain('leak');
  });

  test('an explicit actor (login has no req.user yet) and level are honoured', async () => {
    AuditLog.create.mockResolvedValue({});
    await audit({ id: 'r', ip: '1.1.1.1' }, 'auth.login.failure', {}, { actor: { id: 'u2', role: 'Admin' }, subject: 'abc', level: 'warn' });
    expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ actor: 'u2', actorRole: 'Admin', subject: 'abc' }));
    expect(logEvent).toHaveBeenCalledWith('auth.login.failure', expect.any(Object), 'warn');
  });

  test('a failing database write NEVER breaks the request - it is logged as an error instead', async () => {
    AuditLog.create.mockRejectedValue(new Error('db down'));
    await expect(audit(req, 'gig.created', {})).resolves.toBeUndefined();
    expect(logEvent).toHaveBeenCalledWith('audit.write.failed', expect.objectContaining({ auditEvent: 'gig.created' }), 'error');
  });
});
