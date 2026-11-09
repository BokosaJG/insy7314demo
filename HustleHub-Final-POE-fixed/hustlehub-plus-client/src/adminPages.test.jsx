import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect } from 'vitest';
import { AuditLog } from './adminPages.jsx';

const entries = [
  { _id: '1', event: 'auth.login.failure', actorRole: undefined, ip: '10.0.0.5', createdAt: '2026-11-07T10:00:00Z', details: { reason: 'bad_password' } },
  { _id: '2', event: 'booking.created', actorRole: 'Client', ip: '10.0.0.6', createdAt: '2026-11-07T09:00:00Z', details: { amount: 500 } },
  { _id: '3', event: 'auth.account.locked', actorRole: 'Freelancer', ip: '10.0.0.5', createdAt: '2026-11-07T08:00:00Z', details: {} },
];

describe('AuditLog (Admin)', () => {
  it('lists events with role, IP and a readable summary of the details', async () => {
    render(<AuditLog call={vi.fn(() => Promise.resolve({ data: entries }))} />);
    const rows = await screen.findAllByRole('row');
    expect(rows).toHaveLength(4); // header + 3
    expect(within(rows[1]).getByText('auth.login.failure')).toBeInTheDocument();
    expect(within(rows[1]).getByText('reason: bad_password')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Client')).toBeInTheDocument();
    expect(within(rows[2]).getByText('amount: 500')).toBeInTheDocument();
  });

  it('highlights failures and lockouts but not routine events', async () => {
    render(<AuditLog call={vi.fn(() => Promise.resolve({ data: entries }))} />);
    expect(await screen.findByText('auth.login.failure')).toHaveClass('alert');
    expect(screen.getByText('auth.account.locked')).toHaveClass('alert');
    expect(screen.getByText('booking.created')).not.toHaveClass('alert');
  });

  it('requests the newest 100 events and filters by the chosen event', async () => {
    const call = vi.fn(() => Promise.resolve({ data: entries }));
    render(<AuditLog call={call} />);
    await screen.findByText('booking.created');
    expect(call).toHaveBeenCalledWith('/admin/audit-logs?limit=100');
    await userEvent.selectOptions(screen.getByLabelText('Event'), 'auth.logout');
    expect(call).toHaveBeenLastCalledWith('/admin/audit-logs?limit=100&event=auth.logout');
  });

  it('Refresh reloads the data', async () => {
    const call = vi.fn(() => Promise.resolve({ data: entries }));
    render(<AuditLog call={call} />);
    await screen.findByText('booking.created');
    const before = call.mock.calls.length;
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(call.mock.calls.length).toBe(before + 1);
  });

  it('shows an empty state and an error state', async () => {
    const { unmount } = render(<AuditLog call={vi.fn(() => Promise.resolve({ data: [] }))} />);
    expect(await screen.findByText('No events recorded yet.')).toBeInTheDocument();
    unmount();
    render(<AuditLog call={vi.fn(() => Promise.reject(new Error('You do not have permission to perform this action')))} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('permission');
  });
});
