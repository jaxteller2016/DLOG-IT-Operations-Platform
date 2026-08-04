import React, { useEffect, useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import LoginScreen from './components/LoginScreen';
import TopBar from './components/TopBar';
import StatsGrid from './components/StatsGrid';
import AssetList from './components/AssetList';
import IncidentList from './components/IncidentList';
import AlertFeed from './components/AlertFeed';

const DASHBOARD_VIEW_KEY = 'dlog-dashboard-view';

function AppContent() {
  const { token, error, toast, clearToast } = useApp();
  const [selectedView, setSelectedView] = useState(() => localStorage.getItem(DASHBOARD_VIEW_KEY) || 'assets');

  useEffect(() => {
    localStorage.setItem(DASHBOARD_VIEW_KEY, selectedView);
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
        <label htmlFor="dashboard-view">Dashboard table</label>
        <select id="dashboard-view" value={selectedView} onChange={(event) => setSelectedView(event.target.value)}>
          <option value="assets">Assets</option>
          <option value="incidents">Incidents</option>
          <option value="alerts">Alert Feed</option>
        </select>
      </section>

      {selectedView === 'assets' ? <AssetList /> : null}
      {selectedView === 'incidents' ? <IncidentList /> : null}
      {selectedView === 'alerts' ? <AlertFeed /> : null}

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
