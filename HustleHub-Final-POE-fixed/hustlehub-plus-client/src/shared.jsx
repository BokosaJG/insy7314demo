// Helpers shared by the page components: currency/date formatting, a data-loading
// hook and the loading / error / empty status line.
import { useState, useEffect, useCallback } from 'react';

export const zar = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' });
export const day = (d) => new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });

// Loads data when the page opens (and whenever the path changes) and exposes a
// reload function. The effect only subscribes to the request result; state is set
// in the callback, never synchronously. A response that arrives after the path
// changed or the page closed is ignored, so a slow old request can never
// overwrite a newer one.
export function useLoad(call, path) {
  const [result, setResult] = useState({ key: null, data: null, error: '' });
  const [reloads, setReloads] = useState(0);
  const key = `${path}#${reloads}`;

  useEffect(() => {
    if (!path) return undefined;
    let current = true;
    call(path).then(
      (res) => { if (current) setResult({ key, data: res.data, error: '' }); },
      (err) => { if (current) setResult({ key, data: null, error: err.message }); }
    );
    return () => { current = false; };
  }, [call, path, key]);

  const reload = useCallback(() => setReloads((n) => n + 1), []);
  return {
    data: path ? result.data : null,
    error: path ? result.error : '',
    loading: Boolean(path) && result.key !== key,
    reload,
  };
}

export function Status({ loading, error, empty, emptyText }) {
  if (loading) return <p className="muted">Loading…</p>;
  if (error) return <p className="error" role="alert">{error}</p>;
  if (empty) return <p className="empty">{emptyText}</p>;
  return null;
}

export const Banner = ({ msg }) => (msg ? <p className={msg.ok ? 'notice' : 'error'} role="status">{msg.text}</p> : null);

