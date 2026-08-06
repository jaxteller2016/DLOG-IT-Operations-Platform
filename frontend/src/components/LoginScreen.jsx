import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { fieldErrorsFromZod, loginSchema } from '../validation/schemas';

export default function LoginScreen() {
  const { handleLogin, loading, error } = useApp();
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('Admin123!');
  const [formErrors, setFormErrors] = useState({});

  const inputClass = 'mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30';
  const errorTextClass = 'mt-1 text-xs font-medium text-rose-400';

  function getInputClass(fieldName) {
    return `${inputClass} ${formErrors[fieldName] ? 'border-rose-500 focus:border-rose-400 focus:ring-rose-400/30' : ''}`;
  }

  function updateField(fieldName, value) {
    const nextForm = {
      email: fieldName === 'email' ? value : email,
      password: fieldName === 'password' ? value : password
    };

    if (fieldName === 'email') setEmail(value);
    if (fieldName === 'password') setPassword(value);

    if (Object.keys(formErrors).length > 0) {
      const parsed = loginSchema.safeParse(nextForm);
      setFormErrors(parsed.success ? {} : fieldErrorsFromZod(parsed.error));
    }
  }

  async function onSubmit(event) {
    event.preventDefault();
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setFormErrors(fieldErrorsFromZod(parsed.error));
      return;
    }

    setFormErrors({});
    await handleLogin(email, password);
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1900px] items-start justify-center px-4 pb-12 pt-16 sm:px-6 lg:px-8">
      <div className="w-full max-w-md rounded-2xl border border-slate-700/70 bg-slate-900/80 p-6 shadow-[0_24px_56px_rgba(2,6,23,0.5)] backdrop-blur-sm">
        <h1 className="text-3xl font-semibold text-slate-50">DLOG IT Operations Platform</h1>
        <p className="mt-2 text-sm text-slate-300">Monitor assets, incidents, and service alerts from a single control center.</p>
        <form onSubmit={onSubmit} className="mt-5 grid gap-3">
          <label className="text-sm text-slate-200">
            Email
            <input className={getInputClass('email')} type="email" value={email} onChange={(event) => updateField('email', event.target.value)} required />
            {formErrors.email ? <p className={errorTextClass}>{formErrors.email}</p> : null}
          </label>
          <label className="text-sm text-slate-200">
            Password
            <input className={getInputClass('password')} type="password" value={password} onChange={(event) => updateField('password', event.target.value)} required />
            {formErrors.password ? <p className={errorTextClass}>{formErrors.password}</p> : null}
          </label>
          <button
            type="submit"
            disabled={loading}
            className="mt-1 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-wait disabled:opacity-70"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        {error ? <p className="mt-3 text-sm font-medium text-rose-300">{error}</p> : null}
        <small className="mt-3 block text-xs text-slate-400">Try admin@example.com / Admin123! for a demo login.</small>
      </div>
    </div>
  );
}
