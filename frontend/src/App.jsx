import React, { useEffect, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';

function App() {
  const [token, setToken] = useState(localStorage.getItem('dlog-token') || '');
  const [user, setUser] = useState(null);
  const [assets, setAssets] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('Admin123!');

  useEffect(() => {
    if (!token) return;
    loadDashboardData();
  }, [token]);

  async function loadDashboardData() {
    setLoading(true);
    setError('');

    try {
      const [assetsRes, incidentsRes, alertsRes, meRes] = await Promise.all([
        fetch(`${API_BASE_URL}/assets`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/incidents`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/alerts`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (!assetsRes.ok || !incidentsRes.ok || !alertsRes.ok || !meRes.ok) {
        throw new Error('Unable to load dashboard data');
      }

      const assetsData = await assetsRes.json();
      const incidentsData = await incidentsRes.json();
      const alertsData = await alertsRes.json();
      const meData = await meRes.json();

      setAssets(assetsData.assets || []);
      setIncidents(incidentsData.incidents || []);
      setAlerts(alertsData.alerts || []);
      setUser(meData.user);
    } catch (err) {
      setError(err.message || 'Dashboard load failed');
      setToken('');
      localStorage.removeItem('dlog-token');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const text = await response.text();
      let data = {};
      if (text) {
        try {
          data = JSON.parse(text);
        } catch (parseError) {
          throw new Error(`Server returned an invalid response: ${text}`);
        }
      }

      if (!response.ok) throw new Error(data.error || 'Login failed');

      localStorage.setItem('dlog-token', data.token);
      setToken(data.token);
      setUser(data.user);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem('dlog-token');
    setToken('');
    setUser(null);
    setAssets([]);
    setIncidents([]);
    setAlerts([]);
  }

  if (!token) {
    return (
      <div className="page-shell">
        <div className="card login-card">
          <h1>DLOG IT Operations Platform</h1>
          <p>Monitor assets, incidents, and service alerts from a single control center.</p>
          <form onSubmit={handleLogin}>
            <label>
              Email
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>
            <label>
              Password
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </label>
            <button type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
          </form>
          {error ? <p className="error">{error}</p> : null}
          <small>Try admin@example.com / Admin123! for a demo login.</small>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Operations overview</p>
          <h1>DLOG IT Operations Platform</h1>
        </div>
        <div className="topbar-actions">
          <span>{user?.email || 'Signed in'}</span>
          <button onClick={handleLogout}>Log out</button>
        </div>
      </header>

      {error ? <p className="error">{error}</p> : null}

      <section className="stats-grid">
        <article className="card stat-card">
          <p>Assets tracked</p>
          <strong>{assets.length}</strong>
        </article>
        <article className="card stat-card">
          <p>Open incidents</p>
          <strong>{incidents.filter((incident) => incident.status !== 'Resolved').length}</strong>
        </article>
        <article className="card stat-card">
          <p>Active alerts</p>
          <strong>{alerts.filter((alert) => alert.resolvedAt === null).length}</strong>
        </article>
      </section>

      <section className="content-grid">
        <article className="card">
          <div className="section-title">
            <h2>Assets</h2>
            <button onClick={loadDashboardData} disabled={loading}>Refresh</button>
          </div>
          <ul className="list">
            {assets.map((asset) => (
              <li key={asset.id}>
                <div>
                  <strong>{asset.assetId}</strong>
                  <p>{asset.category} • {asset.siteId}</p>
                </div>
                <span>{asset.status}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="card">
          <div className="section-title">
            <h2>Incidents</h2>
          </div>
          <ul className="list">
            {incidents.map((incident) => (
              <li key={incident.id}>
                <div>
                  <strong>{incident.incidentNumber}</strong>
                  <p>{incident.description}</p>
                </div>
                <span>{incident.slaStatus}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="card">
        <div className="section-title">
          <h2>Alert feed</h2>
        </div>
        <ul className="list">
          {alerts.map((alert) => (
            <li key={alert.id}>
              <div>
                <strong>{alert.type}</strong>
                <p>{alert.message}</p>
              </div>
              <span>{alert.resolvedAt ? 'Resolved' : 'Active'}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default App;
