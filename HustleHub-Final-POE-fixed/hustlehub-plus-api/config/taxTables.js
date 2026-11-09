// config/taxTables.js
// South African individual income tax tables used for the freelancer tax
// ESTIMATE. Source: SARS "Rates of Tax for Individuals" (SARS, 2026).
// A tax year is named after the year it ENDS: tax year 2027 runs from
// 1 March 2026 to 28 February 2027.
//
// Each bracket has:
//   upTo      - upper limit of taxable income for the bracket (Infinity = no limit)
//   rate      - marginal rate applied to the part of income inside the bracket
// The cumulative tax at the start of each bracket (e.g. "R44 118 + 26%") is
// NOT stored: it is recomputed from the rates, so the table cannot contain an
// arithmetic slip and the unit tests can check the result against SARS's own
// published figures.
//
// Tables for 2024, 2025 and 2026 are identical (SARS: "no changes").

const BRACKETS_2024_TO_2026 = [
  { upTo: 237100, rate: 0.18 },
  { upTo: 370500, rate: 0.26 },
  { upTo: 512800, rate: 0.31 },
  { upTo: 673000, rate: 0.36 },
  { upTo: 857900, rate: 0.39 },
  { upTo: 1817000, rate: 0.41 },
  { upTo: Infinity, rate: 0.45 },
];

const BRACKETS_2027 = [
  { upTo: 245100, rate: 0.18 },
  { upTo: 383100, rate: 0.26 },
  { upTo: 530200, rate: 0.31 },
  { upTo: 695800, rate: 0.36 },
  { upTo: 887000, rate: 0.39 },
  { upTo: 1878600, rate: 0.41 },
  { upTo: Infinity, rate: 0.45 },
];

// Primary rebate: deducted from the tax calculated on the table (it is not a
// deduction from income). Only the primary rebate is applied because the
// platform does not store a freelancer's age (65+ rebates are not applied).
const TAX_TABLES = {
  2024: { brackets: BRACKETS_2024_TO_2026, primaryRebate: 17235 },
  2025: { brackets: BRACKETS_2024_TO_2026, primaryRebate: 17235 },
  2026: { brackets: BRACKETS_2024_TO_2026, primaryRebate: 17235 },
  2027: { brackets: BRACKETS_2027, primaryRebate: 17820 },
};

const SUPPORTED_TAX_YEARS = Object.keys(TAX_TABLES).map(Number);

// Map lookup instead of TAX_TABLES[year]: an unexpected key such as
// "constructor" or "__proto__" can never resolve to something on Object.prototype.
const TABLES_BY_YEAR = new Map(Object.entries(TAX_TABLES).map(([year, table]) => [Number(year), table]));
const getTaxTable = (year) => TABLES_BY_YEAR.get(year);

module.exports = { TAX_TABLES, SUPPORTED_TAX_YEARS, getTaxTable };
