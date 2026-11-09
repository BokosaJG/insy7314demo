import { useState } from 'react';
import { validateGig } from './validation.js';
import { zar, day, useLoad, Status, Banner } from './shared.jsx';

// Gigs for everyone 
export function BrowseGigs({ call, user }) {
  const { data, error, loading, reload } = useLoad(call, '/gigs');
  const [msg, setMsg] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const book = async (gig) => {
    setBusyId(gig._id); setMsg(null);
    try {
      const res = await call('/bookings', { method: 'POST', body: { gigId: gig._id } });
      setMsg({ ok: true, text: `Booked "${gig.title}". Payment reference ${res.data.transaction.reference}.` });
    } catch (err) { setMsg({ ok: false, text: err.message }); }
    setBusyId(null);
  };
  const remove = async (gig) => {
    if (!window.confirm(`Delete "${gig.title}"?`)) return;
    try { await call(`/gigs/${gig._id}`, { method: 'DELETE' }); setMsg({ ok: true, text: 'Gig deleted.' }); reload(); }
    catch (err) { setMsg({ ok: false, text: err.message }); }
  };

  return (
    <section>
      <h1>{user.role === 'Client' ? 'Find a gig' : 'All gigs'}</h1>
      <Banner msg={msg} />
      <Status loading={loading} error={error} empty={data && !data.length} emptyText="No gigs have been posted yet." />
      <div className="grid">
        {data?.map((g) => (
          <article className="card gig" key={g._id}>
            <h3>{g.title}</h3>
            <p>{g.description}</p>
            <div className="gig-foot">
              <div><strong className="price">{zar.format(g.price)}</strong><small>by {g.freelancer?.name || 'Unknown'}</small></div>
              {user.role === 'Client' && (
                <button className="primary" disabled={busyId === g._id} onClick={() => book(g)}>
                  {busyId === g._id ? 'Booking…' : 'Book now'}
                </button>
              )}
              {user.role === 'Admin' && <button className="danger" onClick={() => remove(g)}>Delete</button>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

// Freelancer: manage own gigs 
export function GigForm({ initial, onSave, onCancel, submitLabel }) {
  const [f, setF] = useState(initial || { title: '', description: '', price: '' });
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setError('');
    const problem = validateGig(f);
    if (problem) return setError(problem);
    try { await onSave({ title: f.title.trim(), description: f.description.trim(), price: Number(f.price) }); }
    catch (err) { setError(err.message); }
  };
  return (
    <form className="card form" onSubmit={submit} noValidate>
      <label>Title<input value={f.title} onChange={set('title')} required minLength={3} maxLength={100} /></label>
      <label>Description<textarea value={f.description} onChange={set('description')} required minLength={10} maxLength={1000} rows={3} /></label>
      <label>Price (R)<input type="number" step="0.01" min="1" max="1000000" value={f.price} onChange={set('price')} required /></label>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="row">
        <button className="primary">{submitLabel}</button>
        {onCancel && <button type="button" className="ghost" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}

export function MyGigs({ call }) {
  const { data, error, loading, reload } = useLoad(call, '/gigs/mine');
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState(null);

  const create = async (body) => {
    await call('/gigs', { method: 'POST', body });
    setMsg({ ok: true, text: 'Gig posted.' }); reload();
  };
  const update = async (id, body) => {
    await call(`/gigs/${id}`, { method: 'PUT', body });
    setEditing(null); setMsg({ ok: true, text: 'Gig updated.' }); reload();
  };
  const remove = async (g) => {
    if (!window.confirm(`Delete "${g.title}"?`)) return;
    try { await call(`/gigs/${g._id}`, { method: 'DELETE' }); setMsg({ ok: true, text: 'Gig deleted.' }); reload(); }
    catch (err) { setMsg({ ok: false, text: err.message }); }
  };

  return (
    <section>
      <h1>My gigs</h1>
      <Banner msg={msg} />
      <h2>Post a new gig</h2>
      <GigForm onSave={create} submitLabel="Post gig" key={data?.length} />
      <h2>Your listings</h2>
      <Status loading={loading} error={error} empty={data && !data.length} emptyText="You have no gigs yet. Post your first one above." />
      <div className="grid">
        {data?.map((g) =>
          editing === g._id ? (
            <GigForm key={g._id} initial={{ title: g.title, description: g.description, price: g.price }}
              submitLabel="Save changes" onSave={(b) => update(g._id, b)} onCancel={() => setEditing(null)} />
          ) : (
            <article className="card gig" key={g._id}>
              <h3>{g.title}</h3>
              <p>{g.description}</p>
              <div className="gig-foot">
                <strong className="price">{zar.format(g.price)}</strong>
                <div className="row">
                  <button className="ghost" onClick={() => setEditing(g._id)}>Edit</button>
                  <button className="danger" onClick={() => remove(g)}>Delete</button>
                </div>
              </div>
            </article>
          )
        )}
      </div>
    </section>
  );
}

//Bookings 
export function Bookings({ call, user }) {
  const { data, error, loading } = useLoad(call, '/bookings');
  return (
    <section>
      <h1>{user.role === 'Admin' ? 'All bookings' : 'Bookings'}</h1>
      <Status loading={loading} error={error} empty={data && !data.length} emptyText={user.role === 'Client' ? 'You have not booked a gig yet. Find one under Find gigs.' : 'No bookings yet.'} />
      {data?.length > 0 && (
        <div className="scroll">
          <table>
            <thead><tr><th>Gig</th><th>Client</th><th>Freelancer</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              {data.map((b) => (
                <tr key={b._id}>
                  <td>{b.gigTitle}</td><td>{b.client?.name}</td><td>{b.freelancer?.name}</td>
                  <td>{zar.format(b.amount)}</td><td><span className="pill">{b.status}</span></td><td>{day(b.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// Transactions / earnings 
export function Payments({ call, user }) {
  const tx = useLoad(call, '/transactions');
  const income = useLoad(call, user.role === 'Freelancer' ? '/transactions/income' : null);
  const isFree = user.role === 'Freelancer';
  return (
    <section>
      <h1>{isFree ? 'Earnings' : user.role === 'Admin' ? 'All transactions' : 'Payments'}</h1>
      {isFree && income.data && (
        <div className="stats">
          <div className="card stat"><small>Total earned</small><strong>{zar.format(income.data.totalIncome)}</strong></div>
          <div className="card stat"><small>Paid bookings</small><strong>{income.data.transactionCount}</strong></div>
        </div>
      )}
      <Status loading={tx.loading} error={tx.error} empty={tx.data && !tx.data.length} emptyText="No transactions yet." />
      {tx.data?.length > 0 && (
        <div className="scroll">
          <table>
            <thead><tr><th>Reference</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              {tx.data.map((t) => (
                <tr key={t._id}><td className="mono">{t.reference}</td><td>{zar.format(t.amount)}</td>
                  <td><span className="pill">{t.status}</span></td><td>{day(t.createdAt)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
