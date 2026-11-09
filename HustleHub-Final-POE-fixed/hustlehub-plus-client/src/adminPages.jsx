import { useState } from 'react';
import { useLoad, Status } from './shared.jsx';

const EVENTS = [
  ['', 'All events'],
  ['auth.login.success', 'Login success'],
  ['auth.login.failure', 'Login failure'],
  ['auth.account.locked', 'Account locked'],
  ['auth.login.blocked_locked', 'Login blocked (locked)'],
  ['auth.logout', 'Logout'],
  ['auth.register.success', 'Registration'],
  ['gig.created', 'Gig created'],
  ['gig.deleted', 'Gig deleted'],
  ['booking.created', 'Booking created'],
  ['transaction.created', 'Transaction created'],
];

const isAlert = (event) => /failure|locked|blocked|denied/.test(event);
const when = (d) => new Date(d).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'medium' });

// Short, readable summary of an entry's details (never contains secrets: the
// server redacts them before they are stored).
const summary = (e) =>
  Object.entries(e.details || {})
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
    .join(' · ');

// Admin only: read-only view of the security audit trail.
export function AuditLog({ call }) {
  const [event, setEvent] = useState('');
  const { data, error, loading, reload } = useLoad(call, `/admin/audit-logs?limit=100${event ? `&event=${event}` : ''}`);

  return (
    <section>
      <div className="head-row">
        <h1>Audit log</h1>
        <div className="row-gap">
          <label className="year-pick">Event
            <select value={event} onChange={(e) => setEvent(e.target.value)}>
              {EVENTS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
          </label>
          <button className="ghost" onClick={reload}>Refresh</button>
        </div>
      </div>
      <p className="muted">The 100 most recent security-relevant actions, newest first. Passwords and tokens are never recorded.</p>
      <Status loading={loading} error={error} empty={data && !data.length} emptyText="No events recorded yet." />
      {data?.length > 0 && (
        <div className="scroll">
          <table>
            <thead><tr><th>When</th><th>Event</th><th>Role</th><th>IP</th><th>Details</th></tr></thead>
            <tbody>
              {data.map((e) => (
                <tr key={e._id}>
                  <td>{when(e.createdAt)}</td>
                  <td><span className={isAlert(e.event) ? 'pill alert' : 'pill'}>{e.event}</span></td>
                  <td>{e.actorRole || '—'}</td>
                  <td className="mono">{e.ip || '—'}</td>
                  <td className="details">{summary(e) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
