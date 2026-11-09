import { useState, useCallback } from 'react';
import { api } from './api.js';
import AuthPage from './AuthPage.jsx';
import { BrowseGigs, MyGigs, Bookings, Payments } from './pages.jsx';
import { IncomeDashboard } from './dashboard.jsx';
import { AuditLog } from './adminPages.jsx';

const NAV = {
  Client: [['browse', 'Find gigs'], ['bookings', 'My bookings'], ['payments', 'Payments']],
  Freelancer: [['dashboard', 'Dashboard'], ['mine', 'My gigs'], ['browse', 'All gigs'], ['bookings', 'Bookings'], ['payments', 'Earnings']],
  Admin: [['browse', 'Gigs'], ['bookings', 'Bookings'], ['payments', 'Transactions'], ['audit', 'Audit log']],
};

const readSession = () => {
  try {
    const raw = sessionStorage.getItem('hh_session');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export default function App() {
  const [session, setSession] = useState(readSession);
  const [page, setPage] = useState(null);

  const signIn = (s) => {
    sessionStorage.setItem('hh_session', JSON.stringify(s));
    setSession(s);
    setPage(NAV[s.user.role][0][0]);
  };
  // Signing out also asks the API to revoke every token for this account, so a
  // copied token stops working immediately. It is best effort: the local
  // session is always cleared, even if the API cannot be reached.
  // revoke=false is used when the token has already expired.
  const signOut = useCallback((revoke = true) => {
    const token = session?.token;
    sessionStorage.removeItem('hh_session');
    setSession(null);
    setPage(null);
    if (revoke !== false && token) api('/auth/logout', { method: 'POST', token }).catch(() => {});
  }, [session]);

  // Wrapper that signs the user out when the token expires.
  const call = useCallback(
    async (path, opts = {}) => {
      try {
        return await api(path, { ...opts, token: session?.token });
      } catch (err) {
        if (err.status === 401 || (err.status === 403 && /token/i.test(err.message))) signOut(false);
        throw err;
      }
    },
    [session, signOut]
  );

  if (!session) return <AuthPage onSignedIn={signIn} />;

  const { user } = session;
  const nav = NAV[user.role];
  const current = page || nav[0][0];
  const props = { call, user };

  return (
    <div className="shell">
      <header className="top">
        <div className="brand">HustleHub<span>+</span></div>
        <nav aria-label="Main">
          {nav.map(([id, label]) => (
            <button key={id} className={current === id ? 'tab on' : 'tab'} onClick={() => setPage(id)}>
              {label}
            </button>
          ))}
        </nav>
        <div className="who">
          <span>{user.name} <em>{user.role}</em></span>
          <button className="ghost" onClick={signOut}>Sign out</button>
        </div>
      </header>
      <main>
        {current === 'dashboard' && <IncomeDashboard {...props} />}
        {current === 'browse' && <BrowseGigs {...props} />}
        {current === 'mine' && <MyGigs {...props} />}
        {current === 'bookings' && <Bookings {...props} />}
        {current === 'payments' && <Payments {...props} />}
        {current === 'audit' && <AuditLog {...props} />}
      </main>
    </div>
  );
}
