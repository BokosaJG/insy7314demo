import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  // Reviewed: only the message is written to the browser console (no stack, no props,
  // no user data) so developers can diagnose a crash. Nothing is shown to the user.
  // eslint-disable-next-line no-console
  componentDidCatch(error) { console.error('UI error:', error.message); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="auth" role="alert">
        <div className="card">
          <h2>Something went wrong</h2>
          <p>Reload the page to continue. If it keeps happening, sign out and sign in again.</p>
          <button className="primary" onClick={() => window.location.reload()}>Reload page</button>
        </div>
      </div>
    );
  }
}
