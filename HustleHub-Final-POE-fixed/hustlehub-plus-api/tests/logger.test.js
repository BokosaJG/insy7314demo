const { redact, logEvent, cloudLoggingEnabled } = require('../config/logger');

describe('log redaction', () => {
  test('secrets are replaced by key name, at any depth', () => {
    const out = redact({
      password: 'hunter2',
      user: { passwordHash: '$2a$12$abc', email: 'a@b.com', nested: { token: 'eyJ...', Authorization: 'Bearer x' } },
      list: [{ secret: 's' }],
    });
    expect(out.password).toBe('[REDACTED]');
    expect(out.user.passwordHash).toBe('[REDACTED]');
    expect(out.user.nested.token).toBe('[REDACTED]');
    expect(out.user.nested.Authorization).toBe('[REDACTED]');
    expect(out.list[0].secret).toBe('[REDACTED]');
    expect(out.user.email).toBe('a@b.com'); // non-secret data is untouched
    expect(JSON.stringify(out)).not.toMatch(/hunter2|eyJ|Bearer x|\$2a\$/);
  });

  test('long strings are truncated, deep objects are cut off, arrays are capped', () => {
    expect(redact('x'.repeat(2000))).toMatch(/\[truncated\]$/);
    expect(redact('x'.repeat(2000)).length).toBeLessThan(520);
    const deep = {}; let cur = deep;
    for (let i = 0; i < 10; i++) { cur.next = {}; cur = cur.next; }
    expect(JSON.stringify(redact(deep))).toContain('[max depth]');
    expect(redact(Array.from({ length: 100 }, (_, i) => i))).toHaveLength(20);
  });

  test('primitives, null and dates are handled', () => {
    expect(redact(null)).toBeNull();
    expect(redact(5)).toBe(5);
    expect(redact(new Date('2026-01-01T00:00:00Z'))).toBe('2026-01-01T00:00:00.000Z');
  });

  test('logging is silent and does not throw under test; cloud transport is off without a token', () => {
    expect(() => logEvent('unit.test', { password: 'x' }, 'warn')).not.toThrow();
    expect(cloudLoggingEnabled).toBe(false);
  });
});
