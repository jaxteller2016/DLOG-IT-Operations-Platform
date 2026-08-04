import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

const INITIAL_ASSET_FORM = { assetId: '', serialNumber: '', category: 'Laptop', siteId: 'site-bucharest', status: 'Online' };

export default function AssetList() {
  const { assets, loading, refreshDashboard, createAsset } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_ASSET_FORM);

  async function handleSubmit(event) {
    event.preventDefault();
    await createAsset(form);
    setForm(INITIAL_ASSET_FORM);
    setModalOpen(false);
    await refreshDashboard();
  }

  return (
    <article className="card">
      <div className="section-title">
        <h2>Assets</h2>
        <div className="section-actions">
          <button type="button" className="secondary-button" onClick={() => setModalOpen(true)}>Create Asset</button>
          <button onClick={refreshDashboard} disabled={loading}>Refresh</button>
        </div>
      </div>

      {modalOpen ? (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="section-title">
              <h3>Create Asset</h3>
              <button type="button" className="secondary-button" onClick={() => setModalOpen(false)}>Close</button>
            </div>
            <form onSubmit={handleSubmit} className="stack-form">
              <input placeholder="Asset ID" value={form.assetId} onChange={(event) => setForm({ ...form, assetId: event.target.value })} required />
              <input placeholder="Serial number" value={form.serialNumber} onChange={(event) => setForm({ ...form, serialNumber: event.target.value })} required />
              <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
                <option value="Laptop">Laptop</option>
                <option value="Desktop">Desktop</option>
                <option value="Server">Server</option>
              </select>
              <input placeholder="Site ID" value={form.siteId} onChange={(event) => setForm({ ...form, siteId: event.target.value })} required />
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                <option value="Online">Online</option>
                <option value="Offline">Offline</option>
                <option value="Maintenance">Maintenance</option>
              </select>
              <button type="submit">Create asset</button>
            </form>
          </div>
        </div>
      ) : null}

      <ul className="list">
        {assets.map((asset) => (
          <li key={asset.id}>
            <div>
              <strong>{asset.assetId}</strong>
              <p>{asset.category} • {asset.siteId}</p>
            </div>
            <span>{asset.status}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
