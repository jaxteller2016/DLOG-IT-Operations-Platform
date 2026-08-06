import React from 'react';
import { useApp } from '../context/AppContext';

export default function TopBar() {
  const { user, handleLogout } = useApp();

  return (
    <header className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-700/70 bg-slate-900/70 px-5 py-4 shadow-[0_14px_34px_rgba(2,6,23,0.35)] backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="mb-1 text-[11px] uppercase tracking-[0.28em] text-emerald-300">Operations overview</p>
        <h1 className="text-2xl font-semibold text-slate-50 sm:text-3xl">DLOG IT Operations Platform</h1>
      </div>
      <div className="flex items-center gap-3">
        <span className="rounded-lg bg-slate-800/90 px-3 py-2 text-sm text-slate-200">{user?.email || 'Signed in'}</span>
        <button
          onClick={handleLogout}
          className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
        >
          Log out
        </button>
      </div>
    </header>
  );
}
