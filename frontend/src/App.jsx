import React, { useEffect, useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import LoginScreen from './components/LoginScreen';
import TopBar from './components/TopBar';
import StatsGrid from './components/StatsGrid';
import AssetList from './components/AssetList';
import IncidentList from './components/IncidentList';
import AlertFeed from './components/AlertFeed';
import AuditLogFeed from './components/AuditLogFeed';

const DASHBOARD_VIEW_KEY = 'dlog-dashboard-view';

function AppContent() {
  const { token, user, error, toast, clearToast, resultsPerPage, setResultsPerPage } = useApp();
  const [selectedView, setSelectedView] = useState(() => localStorage.getItem(DASHBOARD_VIEW_KEY) || 'assets');
  const [visitedViews, setVisitedViews] = useState(() => new Set([localStorage.getItem(DASHBOARD_VIEW_KEY) || 'assets']));
  const isAdmin = user?.role === 'Administrator';

  useEffect(() => {
    localStorage.setItem(DASHBOARD_VIEW_KEY, selectedView);
  }, [selectedView]);

  useEffect(() => {
    if (!isAdmin && selectedView === 'audit') {
      setSelectedView('assets');
    }
  }, [isAdmin, selectedView]);

  useEffect(() => {
    setVisitedViews((current) => {
      if (current.has(selectedView)) return current;
      const next = new Set(current);
      next.add(selectedView);
      return next;
    });
  }, [selectedView]);

  if (!token) {
    return <LoginScreen />;
  }

  return (
    <div className="page-shell">
      <TopBar />
      {error ? <p className="error">{error}</p> : null}
      <StatsGrid />
      <section className="card view-selector-card">
        <div className="dashboard-controls">
          <label htmlFor="dashboard-view">
            Dashboard table
            <select id="dashboard-view" value={selectedView} onChange={(event) => setSelectedView(event.target.value)}>
              <option value="assets">Assets</option>
              <option value="incidents">Incidents</option>
              <option value="alerts">Alert Feed</option>
              {isAdmin ? <option value="audit">Audit Log</option> : null}
            </select>
          </label>
          <label htmlFor="results-per-page">
            Results per page
            <select
              id="results-per-page"
              value={resultsPerPage}
              onChange={(event) => setResultsPerPage(Number.parseInt(event.target.value, 10) || 20)}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={30}>30</option>
              <option value={50}>50</option>
            </select>
          </label>
        </div>
      </section>

      {visitedViews.has('assets') ? (
        <div hidden={selectedView !== 'assets'}>
          <AssetList />
        </div>
      ) : null}

      {visitedViews.has('incidents') ? (
        <div hidden={selectedView !== 'incidents'}>
          <IncidentList />
        </div>
      ) : null}

      {visitedViews.has('alerts') ? (
        <div hidden={selectedView !== 'alerts'}>
          <AlertFeed />
        </div>
      ) : null}

      {isAdmin && visitedViews.has('audit') ? (
        <div hidden={selectedView !== 'audit'}>
          <AuditLogFeed />
        </div>
      ) : null}

      {toast ? (
        <div className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`} onClick={clearToast}>
          <span>{toast.message}</span>
        </div>
      ) : null}
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
