const { buildDashboard } = require('../utils/dashboard');

const tx = (amount, iso, booking) => ({ amount, createdAt: new Date(iso), booking });
const NOW = new Date('2026-11-07T10:00:00Z');

describe('buildDashboard', () => {
  test('empty year: zeros everywhere, 12 months, no gigs', () => {
    const d = buildDashboard([], new Map(), 2027, NOW);
    expect(d.summary).toEqual({ grossIncome: 0, bookingCount: 0, averageBooking: 0 });
    expect(d.monthly).toHaveLength(12);
    expect(d.monthly.every((m) => m.income === 0 && m.count === 0)).toBe(true);
    expect(d.topGigs).toEqual([]);
    expect(d.tax.estimatedTax).toBe(0);
  });

  test('March is the first month and February the last (SA tax year order)', () => {
    const d = buildDashboard(
      [tx(100, '2026-03-05T00:00:00Z', 'a'), tx(200, '2027-02-20T00:00:00Z', 'a'), tx(50, '2026-12-25T00:00:00Z', 'a')],
      new Map([['a', 'Logo']]),
      2027,
      NOW
    );
    expect(d.monthly[0]).toMatchObject({ label: 'Mar', income: 100, count: 1 });
    expect(d.monthly[9]).toMatchObject({ label: 'Dec', income: 50 });
    expect(d.monthly[11]).toMatchObject({ label: 'Feb', income: 200 });
  });

  test('totals, average and money rounding', () => {
    const d = buildDashboard([tx(0.1, '2026-04-01T00:00:00Z', 'a'), tx(0.2, '2026-04-02T00:00:00Z', 'a')], new Map(), 2027, NOW);
    expect(d.summary.grossIncome).toBe(0.3); // not 0.30000000000000004
    expect(d.summary.averageBooking).toBe(0.15);
  });

  test('groups income by gig title, sorts by income and keeps the top five', () => {
    const titles = new Map([['1', 'A'], ['2', 'B'], ['3', 'C'], ['4', 'D'], ['5', 'E'], ['6', 'F']]);
    const txs = ['1', '2', '3', '4', '5', '6'].map((id, i) => tx((i + 1) * 100, '2026-05-01T00:00:00Z', id));
    txs.push(tx(1000, '2026-05-02T00:00:00Z', '1'));
    const d = buildDashboard(txs, titles, 2027, NOW);
    expect(d.topGigs).toHaveLength(5);
    expect(d.topGigs[0]).toEqual({ title: 'A', income: 1100, count: 2 });
    expect(d.topGigs.map((g) => g.title)).not.toContain('B');
  });

  test('bookings whose gig title is unknown are labelled instead of crashing', () => {
    const d = buildDashboard([tx(10, '2026-05-01T00:00:00Z', 'missing')], new Map(), 2027, NOW);
    expect(d.topGigs[0].title).toBe('Removed gig');
  });

  test('includes tax for the gross income, the period and a disclaimer', () => {
    const d = buildDashboard([tx(360000, '2026-05-01T00:00:00Z', 'a')], new Map([['a', 'Big job']]), 2027, NOW);
    expect(d.tax.estimatedTax).toBe(56172);
    expect(d.period).toEqual({ start: '2026-03-01T00:00:00.000Z', end: '2027-03-01T00:00:00.000Z' });
    expect(d.disclaimer).toMatch(/estimate/i);
  });

  test('projection exists for the running tax year and not for a finished one', () => {
    expect(buildDashboard([tx(1000, '2026-05-01T00:00:00Z', 'a')], new Map(), 2027, NOW).projection).not.toBeNull();
    expect(buildDashboard([], new Map(), 2026, NOW).projection).toBeNull();
  });
});
