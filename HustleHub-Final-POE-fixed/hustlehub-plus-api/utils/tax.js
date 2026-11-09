// utils/tax.js
// Pure functions (no database, no Express) that turn income into an ESTIMATED
// South African income tax figure. Being pure makes them easy to unit test.
//
// Method (progressive tax with a rebate):
//   1. Taxable income = gross income earned in the tax year (the platform
//      knows nothing about expenses, other income or deductions).
//   2. Split taxable income across the brackets. The part of income inside a
//      bracket is taxed at that bracket's rate only.
//   3. Add the bracket amounts = tax before rebate.
//   4. Subtract the primary rebate; tax can never be negative.
//   5. Effective rate = estimated tax / income. Marginal rate = rate of the
//      bracket the last rand falls in.
//
// Money is rounded to whole cents at the end of each step so the figures shown
// to the user add up exactly.

const { SUPPORTED_TAX_YEARS, getTaxTable } = require('../config/taxTables');

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

const isSupportedTaxYear = (year) => SUPPORTED_TAX_YEARS.includes(year);

// SA tax year: 1 March - end of February, named after the year it ends.
// getUTCMonth(): 0 = January ... 2 = March.
const taxYearOf = (date) => {
  const d = new Date(date);
  return d.getUTCMonth() >= 2 ? d.getUTCFullYear() + 1 : d.getUTCFullYear();
};

// [start, end) of a tax year in UTC.
const taxYearRange = (taxYear) => ({
  start: new Date(Date.UTC(taxYear - 1, 2, 1)),
  end: new Date(Date.UTC(taxYear, 2, 1)),
});

const calculateTax = (income, taxYear) => {
  const table = getTaxTable(taxYear);
  if (!table) throw new RangeError(`No tax table for tax year ${taxYear}`);
  if (typeof income !== 'number' || !Number.isFinite(income) || income < 0) {
    throw new RangeError('income must be a non-negative number');
  }

  const taxable = round2(income);
  let lower = 0;
  let taxBeforeRebate = 0;
  let marginalRate = table.brackets[0].rate;
  const breakdown = [];

  for (const bracket of table.brackets) {
    const amountInBracket = Math.max(0, Math.min(taxable, bracket.upTo) - lower);
    const taxInBracket = round2(amountInBracket * bracket.rate);
    breakdown.push({
      from: lower,
      to: Number.isFinite(bracket.upTo) ? bracket.upTo : null, // null = no upper limit (JSON-safe)
      rate: bracket.rate,
      amountInBracket: round2(amountInBracket),
      taxInBracket,
    });
    taxBeforeRebate += taxInBracket;
    if (taxable > lower) marginalRate = bracket.rate;
    lower = bracket.upTo;
  }

  taxBeforeRebate = round2(taxBeforeRebate);
  const rebate = table.primaryRebate;
  const estimatedTax = round2(Math.max(0, taxBeforeRebate - rebate));

  return {
    taxYear,
    taxableIncome: taxable,
    taxBeforeRebate,
    primaryRebate: rebate,
    estimatedTax,
    effectiveRate: taxable > 0 ? Math.round((estimatedTax / taxable) * 10000) / 10000 : 0,
    marginalRate,
    afterTaxIncome: round2(taxable - estimatedTax),
    brackets: breakdown,
  };
};

// Projection for a tax year that is still running: income so far is scaled up
// to a full year using the share of the year that has passed, then taxed. This
// matters because the rebate and the 18% bracket are ANNUAL amounts - tax on a
// part-year income would otherwise look far lower than the real year-end bill.
// For a finished (or future) tax year no projection is made.
const projectAnnual = (incomeToDate, taxYear, now = new Date()) => {
  const { start, end } = taxYearRange(taxYear);
  const t = now.getTime();
  if (t < start.getTime() || t >= end.getTime()) return null;

  const elapsed = (t - start.getTime()) / (end.getTime() - start.getTime());
  // Avoid wild projections in the first days of the year.
  if (elapsed < 1 / 12) return null;

  const projectedIncome = round2(incomeToDate / elapsed);
  return {
    basis: 'Income so far scaled up to a full tax year',
    elapsedShare: Math.round(elapsed * 10000) / 10000,
    ...calculateTax(projectedIncome, taxYear),
  };
};

module.exports = { calculateTax, projectAnnual, taxYearOf, taxYearRange, isSupportedTaxYear, round2 };
