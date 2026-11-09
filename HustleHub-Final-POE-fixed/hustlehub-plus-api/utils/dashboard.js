// utils/dashboard.js
// Builds the freelancer income dashboard from raw records. Pure function:
// the controller fetches the transactions and bookings, this shapes them.

const { calculateTax, projectAnnual, taxYearRange, round2 } = require('./tax');

const MONTH_LABELS = ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'];

// Position of a date inside the tax year: March = 0 ... February = 11.
const monthIndex = (date) => (new Date(date).getUTCMonth() + 10) % 12;

/**
 * @param {Array<{amount:number, createdAt:Date, booking:any}>} transactions  within the tax year
 * @param {Map<string,string>} gigTitleByBookingId  booking id -> gig title
 */
const buildDashboard = (transactions, gigTitleByBookingId, taxYear, now = new Date()) => {
  const months = MONTH_LABELS.map((label) => ({ label, income: 0, count: 0 }));
  const byGig = new Map();
  let total = 0;

  for (const t of transactions) {
    const m = months[monthIndex(t.createdAt)];
    m.income = round2(m.income + t.amount);
    m.count += 1;

    const title = gigTitleByBookingId.get(String(t.booking)) || 'Removed gig';
    const g = byGig.get(title) || { title, income: 0, count: 0 };
    g.income = round2(g.income + t.amount);
    g.count += 1;
    byGig.set(title, g);

    total = round2(total + t.amount);
  }

  const { start, end } = taxYearRange(taxYear);
  const topGigs = [...byGig.values()].sort((a, b) => b.income - a.income).slice(0, 5);

  return {
    taxYear,
    period: { start: start.toISOString(), end: end.toISOString() },
    summary: {
      grossIncome: total,
      bookingCount: transactions.length,
      averageBooking: transactions.length ? round2(total / transactions.length) : 0,
    },
    monthly: months,
    topGigs,
    tax: calculateTax(total, taxYear),
    projection: projectAnnual(total, taxYear, now),
    disclaimer:
      'Estimate only. Uses SARS individual rates with the primary rebate, treats all platform income as taxable income and ignores expenses, other income and age-based rebates. It is not tax advice.',
  };
};

module.exports = { buildDashboard };
