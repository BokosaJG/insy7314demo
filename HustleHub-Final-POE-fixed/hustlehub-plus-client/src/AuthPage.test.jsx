import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import AuthPage from './AuthPage.jsx';

const reply = (status, body) =>
  Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });

beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('AuthPage', () => {
  it('renders the sign-in form by default', () => {
    render(<AuthPage onSignedIn={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('switches to registration and shows the role choices', async () => {
    render(<AuthPage onSignedIn={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /create an account/i }));
    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument();
    expect(screen.getByLabelText('Hire freelancers')).toBeChecked();
    expect(screen.getByLabelText('Offer my services')).not.toBeChecked();
  });

  it('blocks a weak password without calling the API', async () => {
    render(<AuthPage onSignedIn={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /create an account/i }));
    await userEvent.type(screen.getByLabelText('Full name'), 'Thabo Mokoena');
    await userEvent.type(screen.getByLabelText('Email'), 'thabo@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'weak');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Password must be at least 8 characters.');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('signs in and passes the token and user to the app', async () => {
    const onSignedIn = vi.fn();
    fetch.mockReturnValueOnce(reply(200, { token: 'abc', data: { id: '1', name: 'Thabo', role: 'Freelancer' } }));
    render(<AuthPage onSignedIn={onSignedIn} />);
    await userEvent.type(screen.getByLabelText('Email'), 'thabo@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Passw0rdTest');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await vi.waitFor(() => expect(onSignedIn).toHaveBeenCalledWith({
      token: 'abc', user: { id: '1', name: 'Thabo', role: 'Freelancer' },
    }));
    expect(fetch.mock.calls[0][0]).toBe('/api/auth/login');
  });

  it('shows the API error for wrong credentials', async () => {
    fetch.mockReturnValueOnce(reply(401, { error: 'Invalid email or password' }));
    render(<AuthPage onSignedIn={() => {}} />);
    await userEvent.type(screen.getByLabelText('Email'), 'thabo@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'WrongPass1');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
  });
});
