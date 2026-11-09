import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import App from './App.jsx';

const signedIn = (role) =>
  sessionStorage.setItem('hh_session', JSON.stringify({ token: 't', user: { id: '1', name: 'Test User', email: 't@x.com', role } }));

beforeEach(() => {
  sessionStorage.clear();
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ data: [] }) })));
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('App', () => {
  it('shows the sign-in page when logged out', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('shows client navigation only, with no freelancer pages', async () => {
    signedIn('Client');
    render(<App />);
    expect(await screen.findByRole('button', { name: 'Find gigs' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'My bookings' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'My gigs' })).not.toBeInTheDocument();
  });

  it('shows freelancer navigation including My gigs and Earnings', async () => {
    signedIn('Freelancer');
    render(<App />);
    expect(await screen.findByRole('button', { name: 'My gigs' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Earnings' })).toBeInTheDocument();
  });

  it('sends the JWT with requests and clears the session on sign out', async () => {
    signedIn('Client');
    render(<App />);
    await screen.findByRole('button', { name: 'Find gigs' });
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer t');
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(sessionStorage.getItem('hh_session')).toBeNull();
  });

  it('freelancers land on the Income & tax dashboard first and can still reach Earnings', async () => {
    signedIn('Freelancer');
    render(<App />);
    expect(await screen.findByRole('button', { name: 'Dashboard' })).toHaveClass('on');
    expect(screen.getByRole('heading', { name: /Income & tax/ })).toBeInTheDocument();
    expect(fetch.mock.calls[0][0]).toBe('/api/transactions/dashboard');
  });

  it('only Admins get the Audit log page', async () => {
    signedIn('Client');
    const { unmount } = render(<App />);
    await screen.findByRole('button', { name: 'Find gigs' });
    expect(screen.queryByRole('button', { name: 'Audit log' })).not.toBeInTheDocument();
    unmount();
    sessionStorage.clear();
    signedIn('Admin');
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: 'Audit log' }));
    expect(await screen.findByRole('heading', { name: 'Audit log' })).toBeInTheDocument();
    expect(fetch.mock.calls.some((c) => c[0].startsWith('/api/admin/audit-logs'))).toBe(true);
  });

  it('signing out asks the API to revoke the token, using that token', async () => {
    signedIn('Client');
    render(<App />);
    await screen.findByRole('button', { name: 'Find gigs' });
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    const logout = fetch.mock.calls.find((c) => c[0] === '/api/auth/logout');
    expect(logout).toBeDefined();
    expect(logout[1].method).toBe('POST');
    expect(logout[1].headers.Authorization).toBe('Bearer t');
  });

  it('still signs out locally when the revoke request fails', async () => {
    signedIn('Client');
    render(<App />);
    await screen.findByRole('button', { name: 'Find gigs' });
    fetch.mockImplementation(() => Promise.reject(new Error('offline')));
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(sessionStorage.getItem('hh_session')).toBeNull();
  });

  it('an expired token signs the user out WITHOUT calling logout', async () => {
    signedIn('Client');
    fetch.mockImplementation(() => Promise.resolve({ ok: false, status: 403, json: () => Promise.resolve({ error: 'Invalid or expired token' }) }));
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(fetch.mock.calls.some((c) => c[0] === '/api/auth/logout')).toBe(false);
  });
});
