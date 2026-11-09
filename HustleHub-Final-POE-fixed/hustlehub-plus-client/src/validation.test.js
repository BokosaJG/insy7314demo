import { describe, it, expect } from 'vitest';
import { validateEmail, validateName, validatePassword, validateGig } from './validation.js';

describe('validation', () => {
  it('accepts a valid email and rejects bad ones', () => {
    expect(validateEmail('thabo@example.com')).toBe('');
    expect(validateEmail('not-an-email')).toMatch(/valid email/i);
    expect(validateEmail('   ')).toMatch(/enter your email/i);
  });

  it('enforces the password rules used by the API', () => {
    expect(validatePassword('short1A')).toMatch(/at least 8/);
    expect(validatePassword('alllowercase1')).toMatch(/uppercase/);
    expect(validatePassword('ALLUPPERCASE1')).toMatch(/lowercase/);
    expect(validatePassword('NoNumbersHere')).toMatch(/number/);
    expect(validatePassword('Passw0rdTest')).toBe('');
  });

  it('checks name length', () => {
    expect(validateName('A')).toMatch(/between 2 and 60/);
    expect(validateName('Thabo')).toBe('');
  });

  it('validates gig fields, including price limits and decimals', () => {
    const ok = { title: 'Logo Design', description: 'A professional logo for you', price: '500' };
    expect(validateGig(ok)).toBe('');
    expect(validateGig({ ...ok, title: 'ab' })).toMatch(/Title/);
    expect(validateGig({ ...ok, description: 'short' })).toMatch(/Description/);
    expect(validateGig({ ...ok, price: 'abc' })).toMatch(/number/);
    expect(validateGig({ ...ok, price: '0' })).toMatch(/between R1/);
    expect(validateGig({ ...ok, price: '10.999' })).toMatch(/2 decimal/);
  });
});
