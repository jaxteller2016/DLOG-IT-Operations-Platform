import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('dlog-token') || '');
  const [user, setUser] = useState(null);
  const [assets, setAssets] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadDashboardData = useCallback(async () => {
    if (!token) return;

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
  }, [token]);

  useEffect(() => {
    if (!token) return;
    loadDashboardData();
  }, [token, loadDashboardData]);

  async function handleLogin(email, password) {
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
    setError('');
  }

  async function createAsset(formValues) {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/assets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ ...formValues, notes: 'Created from UI' })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to create asset');
      await loadDashboardData();
      return data.asset;
    } catch (err) {
      setError(err.message || 'Unable to create asset');
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function createIncident(formValues) {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/incidents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formValues)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to create incident');
      await loadDashboardData();
      return data.incident;
    } catch (err) {
      setError(err.message || 'Unable to create incident');
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function updateIncidentStatus(incidentId, status) {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/incidents/${incidentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status, resolutionNotes: status === 'Resolved' ? 'Resolved from UI' : '' })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to update incident');
      await loadDashboardData();
      return data.incident;
    } catch (err) {
      setError(err.message || 'Unable to update incident');
      throw err;
    } finally {
      setLoading(false);
    }
  }

  const value = useMemo(() => ({
    token,
    user,
    assets,
    incidents,
    alerts,
    loading,
    error,
    handleLogin,
    handleLogout,
    createAsset,
    createIncident,
    updateIncidentStatus,
    refreshDashboard: loadDashboardData
  }), [token, user, assets, incidents, alerts, loading, error, handleLogin, handleLogout, createAsset, createIncident, updateIncidentStatus, loadDashboardData]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
