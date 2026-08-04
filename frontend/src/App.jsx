import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import LoginScreen from './components/LoginScreen';
import TopBar from './components/TopBar';
import StatsGrid from './components/StatsGrid';
import AssetList from './components/AssetList';
import IncidentList from './components/IncidentList';
import AlertFeed from './components/AlertFeed';

function AppContent() {
  const { token, error } = useApp();

  if (!token) {
    return <LoginScreen />;
  }

  return (
    <div className="page-shell">
      <TopBar />
      {error ? <p className="error">{error}</p> : null}
      <StatsGrid />
      <section className="content-grid">
        <AssetList />
        <IncidentList />
      </section>
      <AlertFeed />
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
