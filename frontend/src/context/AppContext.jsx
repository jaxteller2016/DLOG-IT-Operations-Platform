import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || window.location.origin;
const TOKEN_STORAGE_KEY = 'dlog-token';

function normalizeToken(value) {
  if (!value) return '';
  return String(value).replace(/^Bearer\s+/i, '').trim();
}

function toQueryString(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '' || value === 'all') return;
    searchParams.set(key, String(value));
  });
  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [token, setToken] = useState(normalizeToken(localStorage.getItem(TOKEN_STORAGE_KEY) || ''));
  const [user, setUser] = useState(null);
  const [assets, setAssets] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const authToken = normalizeToken(token);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
  }, []);

  const clearToast = useCallback(() => {
    setToast(null);
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  async function requestJson(path, options = {}) {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = API_BASE_URL ? `${API_BASE_URL}${normalizedPath}` : normalizedPath;

    try {
      const response = await fetch(url, options);
      const text = await response.text();
      let data = {};

      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = { message: text };
        }
      }

      if (!response.ok) {
        throw new Error(data.error || data.message || `Request failed with status ${response.status}`);
      }

      return data;
    } catch (err) {
      const message = err.message || 'Request failed';
      throw new Error(message.includes('Failed to fetch') ? 'Unable to reach the server' : message);
    }
  }

  const loadDashboardData = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError('');

    try {
      const [assetsData, incidentsData, alertsData, meData] = await Promise.all([
        requestJson('/assets', { headers: { Authorization: `Bearer ${authToken}` } }),
        requestJson('/incidents', { headers: { Authorization: `Bearer ${authToken}` } }),
        requestJson('/alerts', { headers: { Authorization: `Bearer ${authToken}` } }),
        requestJson('/auth/me', { headers: { Authorization: `Bearer ${authToken}` } })
      ]);

      setAssets(assetsData.assets || []);
      setIncidents(incidentsData.incidents || []);
      setAlerts(alertsData.alerts || []);
      setUser(meData.user);
    } catch (err) {
      setError(err.message || 'Dashboard load failed');
      showToast(err.message || 'Dashboard load failed', 'error');
      setToken('');
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    } finally {
      setLoading(false);
    }
  }, [authToken, showToast, token]);

  useEffect(() => {
    if (!token) return;
    loadDashboardData();
  }, [token, loadDashboardData]);

  async function handleLogin(email, password) {
    setLoading(true);
    setError('');

    try {
      const data = await requestJson('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const nextToken = normalizeToken(data.token);
      localStorage.setItem(TOKEN_STORAGE_KEY, nextToken);
      setToken(nextToken);
      setUser(data.user);
      showToast('Signed in successfully');
    } catch (err) {
      setError(err.message || 'Login failed');
      showToast(err.message || 'Login failed', 'error');
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken('');
    setUser(null);
    setAssets([]);
    setIncidents([]);
    setAlerts([]);
    setError('');
    showToast('Signed out');
  }

  async function createAsset(formValues) {
    setLoading(true);
    setError('');

    try {
      const data = await requestJson('/assets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ ...formValues, notes: 'Created from UI' })
      });
      await loadDashboardData();
      showToast('Asset created successfully');
      return data.asset;
    } catch (err) {
      setError(err.message || 'Unable to create asset');
      showToast(err.message || 'Unable to create asset', 'error');
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function createIncident(formValues) {
    setLoading(true);
    setError('');

    try {
      const data = await requestJson('/incidents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify(formValues)
      });
      await loadDashboardData();
      showToast('Incident created successfully');
      return data.incident;
    } catch (err) {
      setError(err.message || 'Unable to create incident');
      showToast(err.message || 'Unable to create incident', 'error');
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function updateIncidentDetails(incidentId, updates) {
    setLoading(true);
    setError('');

    try {
      const data = await requestJson(`/incidents/${incidentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify(updates)
      });
      await loadDashboardData();
      showToast('Incident updated successfully');
      return data.incident;
    } catch (err) {
      setError(err.message || 'Unable to update incident');
      showToast(err.message || 'Unable to update incident', 'error');
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function updateIncidentStatus(incidentId, status) {
    return updateIncidentDetails(incidentId, { status, resolutionNotes: status === 'Resolved' ? 'Resolved from UI' : '' });
  }

  async function fetchAssetsView(params = {}) {
    const query = toQueryString({ paginate: true, ...params });
    return requestJson(`/assets${query}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
  }

  async function fetchIncidentsView(params = {}) {
    const query = toQueryString({ paginate: true, ...params });
    return requestJson(`/incidents${query}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
  }

  async function fetchAlertsView(params = {}) {
    const query = toQueryString({ paginate: true, ...params });
    return requestJson(`/alerts${query}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
  }

  async function fetchAuditLogs(params = {}) {
    const query = toQueryString(params);
    return requestJson(`/audit${query}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
  }

  const value = useMemo(() => ({
    token,
    user,
    assets,
    incidents,
    alerts,
    loading,
    error,
    toast,
    showToast,
    clearToast,
    handleLogin,
    handleLogout,
    createAsset,
    createIncident,
    updateIncidentDetails,
    updateIncidentStatus,
    fetchAssetsView,
    fetchIncidentsView,
    fetchAlertsView,
    fetchAuditLogs,
    refreshDashboard: loadDashboardData
  }), [token, user, assets, incidents, alerts, loading, error, toast, showToast, clearToast, handleLogin, handleLogout, createAsset, createIncident, updateIncidentDetails, updateIncidentStatus, fetchAssetsView, fetchIncidentsView, fetchAlertsView, fetchAuditLogs, loadDashboardData]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
