const { calculateTax, projectAnnual, taxYearOf, taxYearRange, isSupportedTaxYear, round2 } = require('../utils/tax');

describe('calculateTax - SARS progressive tax with primary rebate', () => {
  test('income below the tax threshold pays no tax (rebate wipes out the 18% bracket)', () => {
    const r = calculateTax(50000, 2027);
    expect(r.taxBeforeRebate).toBe(9000);
    expect(r.estimatedTax).toBe(0);
    expect(r.afterTaxIncome).toBe(50000);
    expect(r.effectiveRate).toBe(0);
  });

  test('tax threshold is exactly rebate / 18% (R99 000 in 2027, R95 750 in 2026)', () => {
    expect(calculateTax(99000, 2027).estimatedTax).toBe(0);
    expect(calculateTax(99001, 2027).estimatedTax).toBeGreaterThan(0);
    expect(calculateTax(95750, 2026).estimatedTax).toBe(0);
    expect(calculateTax(95751, 2026).estimatedTax).toBeGreaterThan(0);
  });

  test('zero income gives zero everything', () => {
    const r = calculateTax(0, 2027);
    expect(r).toMatchObject({ taxableIncome: 0, taxBeforeRebate: 0, estimatedTax: 0, effectiveRate: 0, afterTaxIncome: 0 });
  });

  test.each([
    // [income, taxYear, expected tax BEFORE rebate] - SARS cumulative figures
    [245100, 2027, 44118],
    [383100, 2027, 79998],
    [887000, 2027, 259783],
    [1878600, 2027, 666339],
    [237100, 2026, 42678],
    [1817000, 2026, 644489],
  ])('R%i in tax year %i: tax before rebate = R%i (matches SARS bracket formula)', (income, year, expected) => {
    expect(calculateTax(income, year).taxBeforeRebate).toBe(expected);
  });

  test('worked example: R360 000 in 2027 = R73 992 before rebate, R56 172 after', () => {
    const r = calculateTax(360000, 2027);
    expect(r.taxBeforeRebate).toBe(73992);
    expect(r.primaryRebate).toBe(17820);
    expect(r.estimatedTax).toBe(56172);
    expect(r.afterTaxIncome).toBe(303828);
    expect(r.marginalRate).toBe(0.26);
    expect(r.effectiveRate).toBe(0.156);
  });

  test('2027 tables differ from 2026 for the same income (inflation adjustment)', () => {
    expect(calculateTax(500000, 2027).estimatedTax).toBeLessThan(calculateTax(500000, 2026).estimatedTax);
  });

  test('bracket breakdown adds up to the totals and uses each rate only inside its bracket', () => {
    const r = calculateTax(500000, 2027);
    expect(r.brackets).toHaveLength(7);
    expect(r.brackets.reduce((s, b) => s + b.amountInBracket, 0)).toBe(500000);
    expect(round2(r.brackets.reduce((s, b) => s + b.taxInBracket, 0))).toBe(r.taxBeforeRebate);
    expect(r.brackets[0]).toMatchObject({ from: 0, to: 245100, rate: 0.18, amountInBracket: 245100 });
    expect(r.brackets[2].amountInBracket).toBe(500000 - 383100);
    expect(r.brackets[3].amountInBracket).toBe(0);
    expect(r.marginalRate).toBe(0.31);
  });

  test('top bracket has no upper limit and the result is JSON-safe (null, not Infinity)', () => {
    const r = calculateTax(3000000, 2027);
    expect(r.brackets[6].to).toBeNull();
    expect(r.marginalRate).toBe(0.45);
    expect(JSON.parse(JSON.stringify(r)).brackets[6].to).toBeNull();
  });

  test('tax never goes down when income goes up (monotonic) and effective rate stays below the marginal rate', () => {
    let last = -1;
    for (let income = 0; income <= 2500000; income += 12345) {
      const r = calculateTax(income, 2027);
      expect(r.estimatedTax).toBeGreaterThanOrEqual(last);
      expect(r.effectiveRate).toBeLessThanOrEqual(r.marginalRate);
      last = r.estimatedTax;
    }
  });

  test('cents are rounded consistently', () => {
    const r = calculateTax(100000.555, 2027);
    expect(Number.isInteger(Math.round(r.estimatedTax * 100))).toBe(true);
    expect(r.taxableIncome).toBe(100000.56);
  });

  test.each([[-1], [NaN], [Infinity], ['5000'], [null], [undefined]])('rejects invalid income %p', (bad) => {
    expect(() => calculateTax(bad, 2027)).toThrow(RangeError);
  });

  test('rejects a tax year without a table', () => {
    expect(() => calculateTax(1000, 1999)).toThrow(/No tax table/);
  });
});

describe('tax year helpers', () => {
  test('SA tax year runs 1 March - end of February and is named after the year it ends', () => {
    expect(taxYearOf(new Date('2026-02-28T23:59:59Z'))).toBe(2026);
    expect(taxYearOf(new Date('2026-03-01T00:00:00Z'))).toBe(2027);
    expect(taxYearOf(new Date('2026-11-07T10:00:00Z'))).toBe(2027);
    expect(taxYearOf(new Date('2027-01-15T10:00:00Z'))).toBe(2027);
  });

  test('taxYearRange is a half-open interval [1 Mar, 1 Mar)', () => {
    const { start, end } = taxYearRange(2027);
    expect(start.toISOString()).toBe('2026-03-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2027-03-01T00:00:00.000Z');
  });

  test('isSupportedTaxYear', () => {
    expect(isSupportedTaxYear(2027)).toBe(true);
    expect(isSupportedTaxYear(2023)).toBe(false);
    expect(isSupportedTaxYear('2027')).toBe(false);
  });
});

describe('projectAnnual', () => {
  test('scales income so far up to a full year and taxes that', () => {
    // 1 Sep 2026 = day 184 of 365 of the 2027 tax year (0.5041).
    const p = projectAnnual(150000, 2027, new Date('2026-09-01T00:00:00Z'));
    expect(p.elapsedShare).toBeCloseTo(0.5041, 3);
    expect(p.taxableIncome).toBeGreaterThan(290000);
    expect(p.taxableIncome).toBeLessThan(310000);
    expect(p.estimatedTax).toBeGreaterThan(0);
  });

  test('no projection for a finished or future tax year', () => {
    expect(projectAnnual(1000, 2026, new Date('2026-11-07T00:00:00Z'))).toBeNull();
    expect(projectAnnual(1000, 2027, new Date('2026-01-01T00:00:00Z'))).toBeNull();
  });

  test('no projection in the first month (too little data to scale up safely)', () => {
    expect(projectAnnual(1000, 2027, new Date('2026-03-10T00:00:00Z'))).toBeNull();
  });
});
