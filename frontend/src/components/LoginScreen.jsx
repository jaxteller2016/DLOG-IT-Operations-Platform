import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

export default function LoginScreen() {
  const { handleLogin, loading, error } = useApp();
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('Admin123!');

  async function onSubmit(event) {
    event.preventDefault();
    await handleLogin(email, password);
  }

  return (
    <div className="page-shell">
      <div className="card login-card">
        <h1>DLOG IT Operations Platform</h1>
        <p>Monitor assets, incidents, and service alerts from a single control center.</p>
        <form onSubmit={onSubmit}>
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
