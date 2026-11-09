import { useState } from 'react';
import { api } from './api.js';
import { validateName, validateEmail, validatePassword } from './validation.js';

export default function AuthPage({ onSignedIn }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'Client' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const problem =
      mode === 'register'
        ? validateName(form.name) || validateEmail(form.email) || validatePassword(form.password)
        : validateEmail(form.email) || (form.password ? '' : 'Enter your password.');
    if (problem) return setError(problem);
    setBusy(true);
    try {
      if (mode === 'register') {
        await api('/auth/register', {
          method: 'POST',
          body: { name: form.name.trim(), email: form.email.trim(), password: form.password, role: form.role },
        });
      }
      const res = await api('/auth/login', {
        method: 'POST',
        body: { email: form.email.trim(), password: form.password },
      });
      onSignedIn({ token: res.token, user: res.data });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <section className="auth-pitch">
        <div className="brand big">HustleHub<span>+</span></div>
        <h1>Book a skilled freelancer, or get booked.</h1>
        <p>Freelancers list gigs with a fixed price in rand. Clients book them in one click.</p>
      </section>
      <form className="card auth-form" onSubmit={submit} noValidate>
        <h2>{mode === 'login' ? 'Sign in' : 'Create your account'}</h2>
        {mode === 'register' && (
          <label>Full name
            <input value={form.name} onChange={set('name')} required minLength={2} maxLength={60} autoComplete="name" />
          </label>
        )}
        <label>Email
          <input type="email" value={form.email} onChange={set('email')} required maxLength={254} autoComplete="email" />
        </label>
        <label>Password
          <input type="password" value={form.password} onChange={set('password')} required maxLength={72}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        </label>
        {mode === 'register' && (
          <>
            <small className="hint">At least 8 characters with an uppercase letter, a lowercase letter and a number.</small>
            <fieldset>
              <legend>I want to</legend>
              <label className="radio"><input type="radio" name="role" checked={form.role === 'Client'} onChange={() => setForm({ ...form, role: 'Client' })} /> Hire freelancers</label>
              <label className="radio"><input type="radio" name="role" checked={form.role === 'Freelancer'} onChange={() => setForm({ ...form, role: 'Freelancer' })} /> Offer my services</label>
            </fieldset>
          </>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
        <button type="button" className="link" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>
          {mode === 'login' ? 'New here? Create an account' : 'Already registered? Sign in'}
        </button>
      </form>
    </div>
  );
}
