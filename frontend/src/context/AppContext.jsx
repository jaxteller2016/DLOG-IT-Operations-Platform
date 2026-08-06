import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { formatDateTime } from '../utils/dateTime';

const API_BASE_URL = import.meta.env.VITE_API_URL || window.location.origin;
const TOKEN_STORAGE_KEY = 'dlog-token';
const RESULTS_PER_PAGE_KEY = 'dlog-results-per-page';
const RESULTS_PER_PAGE_OPTIONS = [10, 20, 30, 50];
const ALERT_POLL_INTERVAL_MS = 3000;

function buildAlertsSignature(alerts) {
  return alerts
    .map((alert) => [
      alert?.id || '',
      alert?.assetId || '',
      alert?.type || '',
      alert?.message || '',
      alert?.severity || '',
      alert?.createdAt || '',
      alert?.resolvedAt || ''
    ].join('|'))
    .join('||');
}

function normalizeResultsPerPage(value) {
  const parsed = Number.parseInt(value, 10);
  if (RESULTS_PER_PAGE_OPTIONS.includes(parsed)) return parsed;
  return 20;
}

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
  const [resultsPerPage, setResultsPerPage] = useState(() => normalizeResultsPerPage(localStorage.getItem(RESULTS_PER_PAGE_KEY)));
  const [user, setUser] = useState(null);
  const [assets, setAssets] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [alertsRefreshVersion, setAlertsRefreshVersion] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const authToken = normalizeToken(token);
  const seenAlertIdsRef = useRef(new Set());
  const alertsInitializedRef = useRef(false);
  const alertsSignatureRef = useRef('');

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

  useEffect(() => {
    localStorage.setItem(RESULTS_PER_PAGE_KEY, String(resultsPerPage));
  }, [resultsPerPage]);

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

  const syncAlertsState = useCallback((nextAlerts, currentUser, options = {}) => {
    const { notify = true } = options;
    const nextSignature = buildAlertsSignature(nextAlerts);
    const hasChanged = alertsSignatureRef.current !== nextSignature;

    if (!alertsInitializedRef.current) {
      alertsSignatureRef.current = nextSignature;
      setAlerts(nextAlerts);
      setAlertsRefreshVersion((value) => value + 1);

      const seenAlertIds = seenAlertIdsRef.current;
      nextAlerts.forEach((alert) => {
        if (alert?.id) seenAlertIds.add(alert.id);
      });
      alertsInitializedRef.current = true;
      return;
    }

    if (!hasChanged) {
      return;
    }

    alertsSignatureRef.current = nextSignature;
    setAlerts(nextAlerts);
    setAlertsRefreshVersion((value) => value + 1);

    const seenAlertIds = seenAlertIdsRef.current;
    const newAlerts = nextAlerts.filter((alert) => alert?.id && !seenAlertIds.has(alert.id));
    newAlerts.forEach((alert) => {
      seenAlertIds.add(alert.id);
    });

    if (notify && currentUser?.role === 'Administrator' && newAlerts.length > 0) {
      const latestAlert = [...newAlerts].sort((left, right) => {
        const leftTime = left.createdAt ? Date.parse(left.createdAt) : 0;
        const rightTime = right.createdAt ? Date.parse(right.createdAt) : 0;
        return rightTime - leftTime;
      })[0];

      showToast(
        `New alert received\nAsset ID: ${latestAlert.assetId || '-'}\nAlert Type: ${latestAlert.type || '-'}\nMessage: ${latestAlert.message || '-'}\nSeverity: ${latestAlert.severity || '-'}\nCreated at: ${formatDateTime(latestAlert.createdAt)}`,
        'error'
      );
    }
  }, [showToast]);

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
      setUser(meData.user);
      syncAlertsState(alertsData.alerts || [], meData.user, { notify: true });
    } catch (err) {
      setError(err.message || 'Dashboard load failed');
      showToast(err.message || 'Dashboard load failed', 'error');
      setToken('');
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    } finally {
      setLoading(false);
    }
  }, [authToken, showToast, syncAlertsState, token]);

  useEffect(() => {
    if (!token) return;
    loadDashboardData();
  }, [token, loadDashboardData]);

  useEffect(() => {
    if (!token || !user) return undefined;

    const intervalId = window.setInterval(async () => {
      try {
        const alertsData = await requestJson('/alerts', {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        syncAlertsState(alertsData.alerts || [], user, { notify: true });
      } catch {
        // Background alert polling should not interrupt the active session.
      }
    }, ALERT_POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [authToken, token, user, syncAlertsState]);

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

  async function handleLogout() {
    if (authToken) {
      try {
        await requestJson('/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${authToken}` }
        });
      } catch {
        // Local cleanup should still proceed even if logout request fails.
      }
    }

    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken('');
    setUser(null);
    setAssets([]);
    setIncidents([]);
    setAlerts([]);
    setAlertsRefreshVersion(0);
    setError('');
    seenAlertIdsRef.current = new Set();
    alertsInitializedRef.current = false;
    alertsSignatureRef.current = '';
    showToast('Signed out');
  }

  async function createAsset(formValues, options = {}) {
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
      if (!options.suppressErrorToast) {
        showToast(err.message || 'Unable to create asset', 'error');
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function deleteAssets(assetIds) {
    setLoading(true);
    setError('');

    try {
      const data = await requestJson('/assets', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ assetIds })
      });
      await loadDashboardData();
      showToast(`${data.deletedCount || assetIds.length} asset(s) deleted successfully`);
      return data;
    } catch (err) {
      setError(err.message || 'Unable to delete assets');
      showToast(err.message || 'Unable to delete assets', 'error');
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

  async function deleteIncidents(incidentIds) {
    setLoading(true);
    setError('');

    try {
      const data = await requestJson('/incidents', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ incidentIds })
      });
      await loadDashboardData();
      showToast(`${data.deletedCount || incidentIds.length} incident(s) deleted successfully`);
      return data;
    } catch (err) {
      setError(err.message || 'Unable to delete incidents');
      showToast(err.message || 'Unable to delete incidents', 'error');
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

  const fetchAssetsView = useCallback(async (params = {}) => {
    const query = toQueryString({ paginate: true, ...params });
    return requestJson(`/assets${query}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
  }, [authToken]);

  const fetchIncidentsView = useCallback(async (params = {}) => {
    const query = toQueryString({ paginate: true, ...params });
    return requestJson(`/incidents${query}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
  }, [authToken]);

  const fetchAlertsView = useCallback(async (params = {}) => {
    const query = toQueryString({ paginate: true, ...params });
    return requestJson(`/alerts${query}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
  }, [authToken]);

  const fetchAuditLogs = useCallback(async (params = {}) => {
    const query = toQueryString(params);
    return requestJson(`/audit${query}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
  }, [authToken]);

  const fetchKnownAssets = useCallback(async () => {
    return requestJson('/monitoring/known-assets', {
      headers: { Authorization: `Bearer ${authToken}` }
    });
  }, [authToken]);

  const value = useMemo(() => ({
    token,
    user,
    assets,
    incidents,
    alerts,
    alertsRefreshVersion,
    resultsPerPage,
    loading,
    error,
    toast,
    showToast,
    clearToast,
    handleLogin,
    handleLogout,
    createAsset,
    deleteAssets,
    createIncident,
    deleteIncidents,
    updateIncidentDetails,
    updateIncidentStatus,
    fetchAssetsView,
    fetchIncidentsView,
    fetchAlertsView,
    fetchAuditLogs,
    fetchKnownAssets,
    setResultsPerPage,
    refreshDashboard: loadDashboardData
  }), [token, user, assets, incidents, alerts, alertsRefreshVersion, resultsPerPage, loading, error, toast, showToast, clearToast, handleLogin, handleLogout, createAsset, deleteAssets, createIncident, deleteIncidents, updateIncidentDetails, updateIncidentStatus, fetchAssetsView, fetchIncidentsView, fetchAlertsView, fetchAuditLogs, fetchKnownAssets, loadDashboardData]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
