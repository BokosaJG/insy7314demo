// Client-side checks. They mirror the API's express-validator rules so users get
// instant feedback. The API still re-validates everything (never trust the client).
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(value) {
  const v = value.trim();
  if (!v) return 'Enter your email address.';
  if (v.length > 254) return 'Email is too long.';
  if (!EMAIL.test(v)) return 'Enter a valid email address.';
  return '';
}

export function validateName(value) {
  const n = value.trim();
  return n.length < 2 || n.length > 60 ? 'Name must be between 2 and 60 characters.' : '';
}

export function validatePassword(value) {
  if (value.length < 8) return 'Password must be at least 8 characters.';
  if (value.length > 72) return 'Password must be at most 72 characters.';
  if (!/[A-Z]/.test(value)) return 'Password must contain an uppercase letter.';
  if (!/[a-z]/.test(value)) return 'Password must contain a lowercase letter.';
  if (!/[0-9]/.test(value)) return 'Password must contain a number.';
  return '';
}

export function validateGig({ title, description, price }) {
  const t = title.trim().length;
  if (t < 3 || t > 100) return 'Title must be between 3 and 100 characters.';
  const d = description.trim().length;
  if (d < 10 || d > 1000) return 'Description must be between 10 and 1000 characters.';
  if (String(price).trim() === '' || !Number.isFinite(Number(price))) return 'Enter the price as a number.';
  const p = Number(price);
  if (p < 1 || p > 1000000) return 'Price must be between R1 and R1 000 000.';
  if (Math.abs(p * 100 - Math.round(p * 100)) > 1e-6) return 'Price can have at most 2 decimal places.';
  return '';
}
