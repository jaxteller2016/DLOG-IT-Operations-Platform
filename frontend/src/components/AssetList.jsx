import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

const INITIAL_ASSET_FORM = { assetId: '', serialNumber: '', category: 'Laptop', siteId: 'site-bucharest', status: 'Online' };
const PAGE_SIZE = 8;
const SITE_OPTIONS = [
  { value: 'site-bucharest', label: 'Bucharest Head Office' },
  { value: 'site-ploiesti', label: 'Ploiesti Warehouse' },
  { value: 'site-valladolid', label: 'Valladolid Warehouse' },
  { value: 'site-novo-mesto', label: 'Novo Mesto Operational Site' },
  { value: 'site-wroclaw', label: 'Wroclaw Operational Site' }
];

function formatTimestamp(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

export default function AssetList() {
  const { assets, loading, refreshDashboard, createAsset } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_ASSET_FORM);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [siteFilter, setSiteFilter] = useState('all');
  const [page, setPage] = useState(1);

  const availableSites = Array.from(new Set(assets.map((asset) => asset.siteId).filter(Boolean))).sort();
  const filteredAssets = assets.filter((asset) => {
    const query = search.trim().toLowerCase();
    const matchesQuery = !query
      || asset.assetId.toLowerCase().includes(query)
      || asset.serialNumber.toLowerCase().includes(query)
      || asset.category.toLowerCase().includes(query)
      || asset.siteId.toLowerCase().includes(query);
    const matchesStatus = statusFilter === 'all' || asset.status === statusFilter;
    const matchesSite = siteFilter === 'all' || asset.siteId === siteFilter;
    return matchesQuery && matchesStatus && matchesSite;
  });

  const totalPages = Math.max(1, Math.ceil(filteredAssets.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedAssets = filteredAssets.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

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
              <select value={form.siteId} onChange={(event) => setForm({ ...form, siteId: event.target.value })}>
                {SITE_OPTIONS.map((site) => (
                  <option key={site.value} value={site.value}>{site.label}</option>
                ))}
              </select>
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

      <div className="filters-bar">
        <input
          placeholder="Search asset ID, serial, category, site"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <select
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value);
            setPage(1);
          }}
        >
          <option value="all">All statuses</option>
          <option value="Online">Online</option>
          <option value="Offline">Offline</option>
          <option value="Maintenance">Maintenance</option>
          <option value="Unknown">Unknown</option>
        </select>
        <select
          value={siteFilter}
          onChange={(event) => {
            setSiteFilter(event.target.value);
            setPage(1);
          }}
        >
          <option value="all">All sites</option>
          {availableSites.map((siteId) => (
            <option key={siteId} value={siteId}>{siteId}</option>
          ))}
        </select>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Asset ID</th>
              <th>Serial</th>
              <th>Category</th>
              <th>Site</th>
              <th>Status</th>
              <th>Last Online</th>
            </tr>
          </thead>
          <tbody>
            {paginatedAssets.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty-cell">No assets match your filter.</td>
              </tr>
            ) : paginatedAssets.map((asset) => (
              <tr key={asset.id}>
                <td>{asset.assetId}</td>
                <td>{asset.serialNumber}</td>
                <td>{asset.category}</td>
                <td>{asset.siteId}</td>
                <td>{asset.status}</td>
                <td>{formatTimestamp(asset.lastOnlineTimestamp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pagination-row">
        <button type="button" className="secondary-button" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
        <span>Page {currentPage} of {totalPages}</span>
        <button type="button" className="secondary-button" disabled={currentPage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next</button>
      </div>
    </article>
  );
}
