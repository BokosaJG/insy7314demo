import { useState } from 'react';
import { zar, useLoad, Status } from './shared.jsx';

// Tax years the API holds SARS tables for. A tax year is named after the year
// it ends: 2027 = 1 March 2026 to 28 February 2027.
const TAX_YEARS = [2027, 2026, 2025, 2024];
const taxYearLabel = (y) => `${y - 1}/${String(y).slice(2)}`;

const percent = (rate) => `${(rate * 100).toFixed(rate * 100 % 1 === 0 ? 0 : 1)}%`;

// "R1.2k" style label for chart axes.
export function compactRand(n) {
  if (n >= 1e6) return `R${(n / 1e6).toFixed(1).replace(/\.0$/, '')}m`;
  if (n >= 1e3) return `R${(n / 1e3).toFixed(1).replace(/\.0$/, '')}k`;
  return `R${Math.round(n)}`;
}

// Rounds the top of a chart axis up to 1, 2, 5 or 10 x a power of ten.
export function niceMax(value) {
  if (!(value > 0)) return 100;
  const exp = 10 ** Math.floor(Math.log10(value));
  const f = value / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nice * exp;
}

// Column chart drawn as plain SVG (no chart library, so nothing extra for the CSP to allow).
// Every bar has a <title> so screen readers and hover tooltips both get the exact value.
export function MonthlyChart({ months }) {
  const W = 640, H = 260, L = 56, R = 12, T = 12, B = 32;
  const max = niceMax(Math.max(...months.map((m) => m.income), 0));
  const plotW = W - L - R, plotH = H - T - B;
  const step = plotW / months.length;
  const barW = step * 0.62;
  const y = (v) => T + plotH - (v / max) * plotH;
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const total = months.reduce((s, m) => s + m.income, 0);

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={`Monthly income, March to February, total ${zar.format(total)}`}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(max * t)} y2={y(max * t)} className="grid-line" />
          <text x={L - 8} y={y(max * t) + 4} textAnchor="end" className="axis">{compactRand(max * t)}</text>
        </g>
      ))}
      {months.map((m, i) => {
        const x = L + i * step + (step - barW) / 2;
        const h = (m.income / max) * plotH;
        return (
          <g key={m.label}>
            <rect x={x} y={T + plotH - h} width={barW} height={Math.max(h, 0)} rx="3" className="bar">
              <title>{`${m.label}: ${zar.format(m.income)} from ${m.count} booking${m.count === 1 ? '' : 's'}`}</title>
            </rect>
            <text x={x + barW / 2} y={H - 10} textAnchor="middle" className="axis">{m.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

// Horizontal bars: income share per gig.
export function GigBars({ gigs }) {
  const top = Math.max(...gigs.map((g) => g.income), 1);
  return (
    <ul className="gigbars" aria-label="Income by gig">
      {gigs.map((g) => (
        <li key={g.title}>
          <div className="gigbars-row"><span>{g.title}</span><strong>{zar.format(g.income)}</strong></div>
          <div className="meter" role="presentation"><div style={{ width: `${(g.income / top) * 100}%` }} /></div>
          <small>{g.count} booking{g.count === 1 ? '' : 's'}</small>
        </li>
      ))}
    </ul>
  );
}

function TaxTable({ tax }) {
  return (
    <div className="scroll">
      <table>
        <caption className="sr-only">How the estimated tax is calculated, bracket by bracket</caption>
        <thead><tr><th>Taxable income band</th><th>Rate</th><th>Your income in band</th><th>Tax</th></tr></thead>
        <tbody>
          {tax.brackets.map((b) => (
            <tr key={b.from} className={b.amountInBracket === 0 ? 'dim' : ''}>
              <td>{zar.format(b.from)} – {b.to === null ? 'and above' : zar.format(b.to)}</td>
              <td>{percent(b.rate)}</td>
              <td>{zar.format(b.amountInBracket)}</td>
              <td>{zar.format(b.taxInBracket)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr><th colSpan="3" scope="row">Tax before rebate</th><td>{zar.format(tax.taxBeforeRebate)}</td></tr>
          <tr><th colSpan="3" scope="row">Less: primary rebate</th><td>−{zar.format(Math.min(tax.primaryRebate, tax.taxBeforeRebate))}</td></tr>
          <tr className="total"><th colSpan="3" scope="row">Estimated tax</th><td>{zar.format(tax.estimatedTax)}</td></tr>
        </tfoot>
      </table>
    </div>
  );
}

// Freelancer home page: income, estimated tax and charts for one tax year.
export function IncomeDashboard({ call }) {
  const [taxYear, setTaxYear] = useState(null); // null = let the API pick the current tax year
  const { data, error, loading } = useLoad(call, `/transactions/dashboard${taxYear ? `?taxYear=${taxYear}` : ''}`);
  const d = data && !Array.isArray(data) && data.tax ? data : null;
  const shownYear = taxYear ?? d?.taxYear ?? TAX_YEARS[0];

  return (
    <section>
      <div className="head-row">
        <h1>Income &amp; tax</h1>
        <label className="year-pick">Tax year
          <select value={shownYear} onChange={(e) => setTaxYear(Number(e.target.value))}>
            {TAX_YEARS.map((y) => <option key={y} value={y}>{taxYearLabel(y)}</option>)}
          </select>
        </label>
      </div>

      <Status loading={loading && !d} error={error} />

      {d && (
        <>
          <p className="muted">1 March {d.taxYear - 1} to 28 February {d.taxYear}</p>
          <div className="stats">
            <div className="card stat"><small>Income earned</small><strong>{zar.format(d.summary.grossIncome)}</strong>
              <em>{d.summary.bookingCount} booking{d.summary.bookingCount === 1 ? '' : 's'}</em></div>
            <div className="card stat warn"><small>Estimated tax</small><strong>{zar.format(d.tax.estimatedTax)}</strong>
              <em>{d.tax.estimatedTax === 0 ? 'Below the tax threshold' : `Marginal rate ${percent(d.tax.marginalRate)}`}</em></div>
            <div className="card stat"><small>After-tax income</small><strong>{zar.format(d.tax.afterTaxIncome)}</strong>
              <em>Effective rate {percent(d.tax.effectiveRate)}</em></div>
          </div>

          {d.projection && (
            <div className="card projection">
              <h2>Where this year is heading</h2>
              <p>
                At your current pace you would earn about <strong>{zar.format(d.projection.taxableIncome)}</strong> this
                tax year, giving roughly <strong>{zar.format(d.projection.estimatedTax)}</strong> tax.
                {d.projection.estimatedTax > 0
                  ? <> Setting aside <strong>{percent(d.projection.effectiveRate)}</strong> of each payment would cover it.</>
                  : <> That is still below the tax threshold, so nothing needs to be set aside yet.</>}
              </p>
            </div>
          )}

          <h2>Income by month</h2>
          <div className="card"><MonthlyChart months={d.monthly} /></div>

          <h2>Top gigs</h2>
          {d.topGigs.length > 0
            ? <div className="card"><GigBars gigs={d.topGigs} /></div>
            : <p className="empty">No income in this tax year yet. Bookings on your gigs will appear here.</p>}

          <h2>How the tax is worked out</h2>
          <TaxTable tax={d.tax} />
          <p className="disclaimer">{d.disclaimer}</p>
        </>
      )}
    </section>
  );
}
