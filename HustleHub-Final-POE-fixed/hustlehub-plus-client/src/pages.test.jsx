import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect } from 'vitest';
import { BrowseGigs, GigForm, Payments } from './pages.jsx';

const gigs = [{ _id: 'g1', title: 'Logo Design', description: 'A professional logo for your brand', price: 500, freelancer: { _id: 'f1', name: 'Thabo' } }];

// Fake API: maps "METHOD /path" to a response. The same function is reused across renders.
const fakeCall = (routes) =>
  vi.fn(async (path, opts = {}) => {
    const key = `${opts.method || 'GET'} ${path}`;
    if (!(key in routes)) throw new Error(`unexpected request ${key}`);
    return routes[key];
  });

describe('BrowseGigs', () => {
  it('lets a client see gigs and book one, showing the payment reference', async () => {
    const call = fakeCall({
      'GET /gigs': { data: gigs },
      'POST /bookings': { data: { booking: {}, transaction: { reference: 'TXN-123-ABC' } } },
    });
    render(<BrowseGigs call={call} user={{ role: 'Client' }} />);
    expect(await screen.findByText('Logo Design')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Book now' }));
    expect(call).toHaveBeenCalledWith('/bookings', { method: 'POST', body: { gigId: 'g1' } });
    expect(await screen.findByText(/TXN-123-ABC/)).toBeInTheDocument();
  });

  it('shows Delete, not Book now, to an admin', async () => {
    render(<BrowseGigs call={fakeCall({ 'GET /gigs': { data: gigs } })} user={{ role: 'Admin' }} />);
    expect(await screen.findByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Book now' })).not.toBeInTheDocument();
  });

  it('shows an empty state when there are no gigs', async () => {
    render(<BrowseGigs call={fakeCall({ 'GET /gigs': { data: [] } })} user={{ role: 'Client' }} />);
    expect(await screen.findByText(/no gigs have been posted/i)).toBeInTheDocument();
  });
});

describe('GigForm', () => {
  const fill = async (price) => {
    await userEvent.type(screen.getByLabelText('Title'), 'Logo Design');
    await userEvent.type(screen.getByLabelText('Description'), 'A professional logo for your brand');
    await userEvent.type(screen.getByLabelText('Price (R)'), price);
  };

  it('rejects an invalid price and does not submit', async () => {
    const onSave = vi.fn();
    render(<GigForm onSave={onSave} submitLabel="Post gig" />);
    await fill('0');
    await userEvent.click(screen.getByRole('button', { name: 'Post gig' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/between R1/);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('submits a valid gig with the price as a number', async () => {
    const onSave = vi.fn().mockResolvedValue();
    render(<GigForm onSave={onSave} submitLabel="Post gig" />);
    await fill('500');
    await userEvent.click(screen.getByRole('button', { name: 'Post gig' }));
    expect(onSave).toHaveBeenCalledWith({ title: 'Logo Design', description: 'A professional logo for your brand', price: 500 });
  });
});

describe('Payments', () => {
  it('shows a freelancer their income summary and transactions', async () => {
    const call = fakeCall({
      'GET /transactions': { data: [{ _id: 't1', reference: 'TXN-1-AAAAAA', amount: 500, status: 'Completed', createdAt: '2026-10-01T10:00:00Z' }] },
      'GET /transactions/income': { data: { totalIncome: 1500, transactionCount: 3 } },
    });
    render(<Payments call={call} user={{ role: 'Freelancer' }} />);
    expect(await screen.findByText('Total earned')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('TXN-1-AAAAAA')).toBeInTheDocument();
  });
});
