import React from 'react';
import { useApp } from '../context/AppContext';

export default function TopBar() {
  const { user, handleLogout } = useApp();

  return (
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
  );
}
