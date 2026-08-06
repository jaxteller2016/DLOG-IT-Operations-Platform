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

  const cardClass = 'rounded-2xl border border-slate-700/70 bg-slate-900/75 p-5 shadow-[0_20px_45px_rgba(2,6,23,0.45)] backdrop-blur-sm';
  const fieldClass = 'mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30';

  return (
    <div className="mx-auto w-full max-w-[1900px] px-4 pb-12 pt-8 sm:px-6 lg:px-8">
      <TopBar />
      {error ? <p className="mt-3 text-sm font-medium text-rose-300">{error}</p> : null}
      <StatsGrid />
      <section className={`${cardClass} mb-4`}>
        <div className="grid gap-3 sm:grid-cols-2 xl:w-[560px]">
          <label htmlFor="dashboard-view" className="text-sm text-slate-200">
            Dashboard table
            <select id="dashboard-view" className={fieldClass} value={selectedView} onChange={(event) => setSelectedView(event.target.value)}>
              <option value="assets">Assets</option>
              <option value="incidents">Incidents</option>
              <option value="alerts">Alert Feed</option>
              {isAdmin ? <option value="audit">Audit Log</option> : null}
            </select>
          </label>
          <label htmlFor="results-per-page" className="text-sm text-slate-200">
            Results per page
            <select
              id="results-per-page"
              className={fieldClass}
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
        <div
          className={`fixed right-4 top-4 z-[1100] max-w-[440px] cursor-pointer whitespace-pre-line rounded-xl px-4 py-3 text-sm text-white shadow-[0_18px_36px_rgba(2,6,23,0.45)] ${toast.type === 'error' ? 'bg-rose-700' : 'bg-emerald-700'}`}
          onClick={clearToast}
        >
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
