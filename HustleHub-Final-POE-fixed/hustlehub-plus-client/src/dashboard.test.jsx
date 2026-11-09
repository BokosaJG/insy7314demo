import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect } from 'vitest';
import { IncomeDashboard, MonthlyChart, GigBars, niceMax, compactRand } from './dashboard.jsx';

const months = ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'].map((label) => ({ label, income: 0, count: 0 }));
months[2] = { label: 'May', income: 360000, count: 2 };

const brackets = [
  { from: 0, to: 245100, rate: 0.18, amountInBracket: 245100, taxInBracket: 44118 },
  { from: 245100, to: 383100, rate: 0.26, amountInBracket: 114900, taxInBracket: 29874 },
  { from: 383100, to: 530200, rate: 0.31, amountInBracket: 0, taxInBracket: 0 },
  { from: 530200, to: null, rate: 0.45, amountInBracket: 0, taxInBracket: 0 },
];

const sample = (over = {}) => ({
  taxYear: 2027,
  summary: { grossIncome: 360000, bookingCount: 2, averageBooking: 180000 },
  monthly: months,
  topGigs: [{ title: 'Brand identity', income: 300000, count: 1 }, { title: 'Logo', income: 60000, count: 1 }],
  tax: { taxYear: 2027, taxableIncome: 360000, taxBeforeRebate: 73992, primaryRebate: 17820, estimatedTax: 56172, effectiveRate: 0.156, marginalRate: 0.26, afterTaxIncome: 303828, brackets },
  projection: { taxableIncome: 700000, estimatedTax: 190000, effectiveRate: 0.2714 },
  disclaimer: 'Estimate only. It is not tax advice.',
  ...over,
});

const callWith = (payload) => vi.fn(() => Promise.resolve({ data: payload }));

describe('IncomeDashboard', () => {
  it('shows income, estimated tax and after-tax income for the tax year', async () => {
    render(<IncomeDashboard call={callWith(sample())} />);
    expect(await screen.findByText('Income earned')).toBeInTheDocument();
    expect(screen.getByText(/R\s?360\s?000,00/, { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText(/R\s?56\s?172,00/, { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText(/R\s?303\s?828,00/, { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText('Effective rate 15.6%')).toBeInTheDocument();
    expect(screen.getByText('Marginal rate 26%')).toBeInTheDocument();
    expect(screen.getByText('2 bookings')).toBeInTheDocument();
    expect(screen.getByText(/1 March 2026 to 28 February 2027/)).toBeInTheDocument();
  });

  it('requests the current tax year first, then the chosen one when the select changes', async () => {
    const call = callWith(sample());
    render(<IncomeDashboard call={call} />);
    await screen.findByText('Income earned');
    expect(call).toHaveBeenCalledWith('/transactions/dashboard');
    await userEvent.selectOptions(screen.getByLabelText('Tax year'), '2026');
    expect(call).toHaveBeenLastCalledWith('/transactions/dashboard?taxYear=2026');
  });

  it('offers the supported tax years labelled like 2026/27', async () => {
    render(<IncomeDashboard call={callWith(sample())} />);
    await screen.findByText('Income earned');
    const options = within(screen.getByLabelText('Tax year')).getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['2026/27', '2025/26', '2024/25', '2023/24']);
  });

  it('shows the projection with a set-aside suggestion when tax is due', async () => {
    render(<IncomeDashboard call={callWith(sample())} />);
    expect(await screen.findByText('Where this year is heading')).toBeInTheDocument();
    expect(screen.getByText('27.1%')).toBeInTheDocument();
  });

  it('says nothing needs setting aside when the projection is below the threshold', async () => {
    render(<IncomeDashboard call={callWith(sample({ projection: { taxableIncome: 50000, estimatedTax: 0, effectiveRate: 0 }, tax: { ...sample().tax, estimatedTax: 0 } }))} />);
    expect(await screen.findByText(/nothing needs to be set aside yet/)).toBeInTheDocument();
    expect(screen.getByText('Below the tax threshold')).toBeInTheDocument();
  });

  it('hides the projection for a finished tax year', async () => {
    render(<IncomeDashboard call={callWith(sample({ projection: null }))} />);
    await screen.findByText('Income earned');
    expect(screen.queryByText('Where this year is heading')).not.toBeInTheDocument();
  });

  it('explains the calculation bracket by bracket and ends with the estimated tax', async () => {
    render(<IncomeDashboard call={callWith(sample())} />);
    const table = await screen.findByRole('table', { name: /How the estimated tax is calculated/ });
    expect(within(table).getByText('18%')).toBeInTheDocument();
    expect(within(table).getByText(/and above/)).toBeInTheDocument();
    expect(within(table).getByText('Tax before rebate')).toBeInTheDocument();
    expect(within(table).getByText('Less: primary rebate')).toBeInTheDocument();
    expect(within(table).getByRole('row', { name: /Estimated tax/ })).toHaveTextContent(/56\s?172/);
  });

  it('always shows the estimate disclaimer', async () => {
    render(<IncomeDashboard call={callWith(sample())} />);
    expect(await screen.findByText('Estimate only. It is not tax advice.')).toBeInTheDocument();
  });

  it('shows an empty-state message when there is no income yet', async () => {
    render(<IncomeDashboard call={callWith(sample({ topGigs: [], summary: { grossIncome: 0, bookingCount: 0, averageBooking: 0 }, projection: null }))} />);
    expect(await screen.findByText(/No income in this tax year yet/)).toBeInTheDocument();
    expect(screen.getByText('0 bookings')).toBeInTheDocument();
  });

  it('shows the API error message instead of crashing', async () => {
    const call = vi.fn(() => Promise.reject(new Error('Too many requests')));
    render(<IncomeDashboard call={call} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many requests');
  });

  it('copes with an unexpected response shape (e.g. a list) without crashing', async () => {
    render(<IncomeDashboard call={callWith([])} />);
    expect(await screen.findByRole('heading', { name: /Income & tax/ })).toBeInTheDocument();
    expect(screen.queryByText('Income earned')).not.toBeInTheDocument();
  });
});

describe('IncomeDashboard - request ordering', () => {
  it('ignores a slow response for a previous tax year that arrives after a newer one', async () => {
    let releaseSlow;
    const slow = new Promise((resolve) => { releaseSlow = () => resolve({ data: sample({ taxYear: 2027, summary: { grossIncome: 111, bookingCount: 1, averageBooking: 111 } }) }); });
    const fast = Promise.resolve({ data: sample({ taxYear: 2026, summary: { grossIncome: 222, bookingCount: 1, averageBooking: 222 } }) });
    const call = vi.fn().mockReturnValueOnce(slow).mockReturnValueOnce(fast);

    render(<IncomeDashboard call={call} />);
    await userEvent.selectOptions(screen.getByLabelText('Tax year'), '2026'); // newer request
    expect(await screen.findByText(/R\s?222,00/, { selector: 'strong' })).toBeInTheDocument();

    releaseSlow(); // the OLD request finishes last
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText(/R\s?111,00/, { selector: 'strong' })).not.toBeInTheDocument();
    expect(screen.getByText(/R\s?222,00/, { selector: 'strong' })).toBeInTheDocument();
  });
});

describe('MonthlyChart', () => {
  it('is an accessible image whose label includes the total, with 12 bars carrying exact values', () => {
    render(<MonthlyChart months={months} />);
    const chart = screen.getByRole('img', { name: /Monthly income, March to February, total R\s?360\s?000,00/ });
    expect(chart.querySelectorAll('rect.bar')).toHaveLength(12);
    expect(chart.querySelector('title').textContent).toMatch(/Mar: R\s?0,00 from 0 bookings/);
    expect(within(chart).getByText(/May: R\s?360\s?000,00 from 2 bookings/)).toBeInTheDocument();
  });

  it('the tallest bar fills the plot area and empty months have zero height', () => {
    render(<MonthlyChart months={months} />);
    const bars = [...screen.getByRole('img').querySelectorAll('rect.bar')];
    expect(Number(bars[2].getAttribute('height'))).toBeGreaterThan(Number(bars[0].getAttribute('height')));
    expect(Number(bars[0].getAttribute('height'))).toBe(0);
  });

  it('draws sensible axis labels when there is no income at all', () => {
    render(<MonthlyChart months={months.map((m) => ({ ...m, income: 0 }))} />);
    expect(screen.getByRole('img')).toHaveTextContent('R100');
  });
});

describe('GigBars', () => {
  it('scales each bar against the top gig', () => {
    const { container } = render(<GigBars gigs={[{ title: 'A', income: 200, count: 2 }, { title: 'B', income: 100, count: 1 }]} />);
    const widths = [...container.querySelectorAll('.meter > div')].map((d) => d.style.width);
    expect(widths).toEqual(['100%', '50%']);
    expect(screen.getByText('2 bookings')).toBeInTheDocument();
    expect(screen.getByText('1 booking')).toBeInTheDocument();
  });
});

describe('chart helpers', () => {
  it.each([[0, 100], [-5, 100], [1, 1], [7, 10], [360000, 500000], [1200, 2000], [99, 100]])('niceMax(%i) = %i', (v, expected) => {
    expect(niceMax(v)).toBe(expected);
  });
  it.each([[0, 'R0'], [850, 'R850'], [1000, 'R1k'], [1500, 'R1.5k'], [250000, 'R250k'], [1200000, 'R1.2m']])('compactRand(%i) = %s', (v, expected) => {
    expect(compactRand(v)).toBe(expected);
  });
});
