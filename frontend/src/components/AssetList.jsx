import React, { useCallback, useEffect, useState } from 'react';
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
  const { loading, refreshDashboard, createAsset, fetchAssetsView, showToast } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_ASSET_FORM);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [siteFilter, setSiteFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [tableLoading, setTableLoading] = useState(false);
  const [tableAssets, setTableAssets] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 });

  const loadAssetsPage = useCallback(async () => {
    setTableLoading(true);
    try {
      const data = await fetchAssetsView({
        page,
        pageSize: PAGE_SIZE,
        search,
        status: statusFilter,
        siteId: siteFilter
      });

      if (data.pagination) {
        setTableAssets(data.assets || []);
        setPagination(data.pagination);
      } else {
        const allAssets = data.assets || [];
        const query = search.trim().toLowerCase();
        const filteredAssets = allAssets.filter((asset) => {
          const matchesQuery = !query
            || asset.assetId.toLowerCase().includes(query)
            || asset.serialNumber.toLowerCase().includes(query)
            || asset.category.toLowerCase().includes(query)
            || asset.siteId.toLowerCase().includes(query);
          const matchesStatus = statusFilter === 'all' || asset.status === statusFilter;
          const matchesSite = siteFilter === 'all' || asset.siteId === siteFilter;
          return matchesQuery && matchesStatus && matchesSite;
        });

        const total = filteredAssets.length;
        const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
        const safePage = Math.min(page, totalPages);
        const start = (safePage - 1) * PAGE_SIZE;
        setTableAssets(filteredAssets.slice(start, start + PAGE_SIZE));
        setPagination({ page: safePage, pageSize: PAGE_SIZE, total, totalPages });
      }
    } catch (error) {
      showToast(error.message || 'Unable to load assets', 'error');
    } finally {
      setTableLoading(false);
    }
  }, [fetchAssetsView, page, search, showToast, siteFilter, statusFilter]);

  useEffect(() => {
    loadAssetsPage();
  }, [loadAssetsPage]);

  const currentPage = pagination.page || 1;
  const totalPages = pagination.totalPages || 1;

  async function handleSubmit(event) {
    event.preventDefault();
    await createAsset(form);
    setForm(INITIAL_ASSET_FORM);
    setModalOpen(false);
    await refreshDashboard();
    await loadAssetsPage();
  }

  async function handleRefresh() {
    await refreshDashboard();
    await loadAssetsPage();
  }

  return (
    <article className="card">
      <div className="section-title">
        <h2>Assets</h2>
        <div className="section-actions">
          <button type="button" className="secondary-button" onClick={() => setModalOpen(true)}>Create Asset</button>
          <button onClick={handleRefresh} disabled={loading || tableLoading}>Refresh</button>
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
          {SITE_OPTIONS.map((site) => (
            <option key={site.value} value={site.value}>{site.label}</option>
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
            {tableLoading ? (
              <tr>
                <td colSpan={6} className="empty-cell">Loading assets...</td>
              </tr>
            ) : tableAssets.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty-cell">No assets match your filter.</td>
              </tr>
            ) : tableAssets.map((asset) => (
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
        <button type="button" className="secondary-button" disabled={currentPage === 1 || tableLoading} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
        <span>Page {currentPage} of {totalPages}</span>
        <button type="button" className="secondary-button" disabled={currentPage === totalPages || tableLoading} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next</button>
      </div>
    </article>
  );
}
