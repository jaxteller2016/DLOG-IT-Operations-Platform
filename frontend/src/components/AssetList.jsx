import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatDate, formatDateTime } from '../utils/dateTime';
import { generateAssetId } from '../utils/idFactory';
import { assetCreateSchema, firstValidationError } from '../validation/schemas';

const WARRANTY_WARNING_DAYS = 60;
const SITE_OPTIONS = [
  { value: 'site-bucharest', label: 'Bucharest Head Office' },
  { value: 'site-ploiesti', label: 'Ploiesti Warehouse' },
  { value: 'site-valladolid', label: 'Valladolid Warehouse' },
  { value: 'site-novo-mesto', label: 'Novo Mesto Operational Site' },
  { value: 'site-wroclaw', label: 'Wroclaw Operational Site' }
];
const CATEGORY_OPTIONS = ['Laptop', 'Desktop', 'Server', 'Network', 'Printer', 'Scanner', 'UPS', 'Other'];

function buildInitialAssetForm() {
  return {
    assetId: generateAssetId(),
    serialNumber: '',
    category: 'Laptop',
    siteId: 'site-bucharest',
    status: 'Online'
  };
}

function getWarrantyState(value) {
  if (!value) return 'normal';
  const warrantyDate = new Date(value);
  if (Number.isNaN(warrantyDate.getTime())) return 'normal';

  const today = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysUntilExpiry = Math.ceil((warrantyDate.getTime() - today.getTime()) / msPerDay);

  if (daysUntilExpiry < 0) return 'expired';
  if (daysUntilExpiry <= WARRANTY_WARNING_DAYS) return 'warning';
  return 'normal';
}

export default function AssetList() {
  const { loading, refreshDashboard, createAsset, fetchAssetsView, showToast, resultsPerPage } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(() => buildInitialAssetForm());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [siteFilter, setSiteFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [tableLoading, setTableLoading] = useState(false);
  const [tableAssets, setTableAssets] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: resultsPerPage, total: 0, totalPages: 1 });

  const loadAssetsPage = useCallback(async () => {
    setTableLoading(true);
    try {
      const data = await fetchAssetsView({
        page,
        pageSize: resultsPerPage,
        search,
        status: statusFilter,
        siteId: siteFilter,
        category: categoryFilter
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
          const matchesCategory = categoryFilter === 'all' || asset.category === categoryFilter;
          return matchesQuery && matchesStatus && matchesSite && matchesCategory;
        });

        const total = filteredAssets.length;
        const totalPages = Math.max(1, Math.ceil(total / resultsPerPage));
        const safePage = Math.min(page, totalPages);
        const start = (safePage - 1) * resultsPerPage;
        setTableAssets(filteredAssets.slice(start, start + resultsPerPage));
        setPagination({ page: safePage, pageSize: resultsPerPage, total, totalPages });
      }
    } catch (error) {
      showToast(error.message || 'Unable to load assets', 'error');
    } finally {
      setTableLoading(false);
    }
  }, [categoryFilter, fetchAssetsView, page, resultsPerPage, search, showToast, siteFilter, statusFilter]);

  useEffect(() => {
    loadAssetsPage();
  }, [loadAssetsPage]);

  useEffect(() => {
    setPage(1);
  }, [resultsPerPage]);

  const currentPage = pagination.page || 1;
  const totalPages = pagination.totalPages || 1;

  async function handleSubmit(event) {
    event.preventDefault();
    const parsed = assetCreateSchema.safeParse(form);
    if (!parsed.success) {
      showToast(firstValidationError(parsed.error), 'error');
      return;
    }

    await createAsset(form);
    setForm(buildInitialAssetForm());
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
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setForm(buildInitialAssetForm());
              setModalOpen(true);
            }}
          >
            Create Asset
          </button>
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
              <input placeholder="Asset ID" value={form.assetId} readOnly required />
              <input placeholder="Serial number" value={form.serialNumber} onChange={(event) => setForm({ ...form, serialNumber: event.target.value })} required />
              <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
                {CATEGORY_OPTIONS.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
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
        <select
          value={categoryFilter}
          onChange={(event) => {
            setCategoryFilter(event.target.value);
            setPage(1);
          }}
        >
          <option value="all">All categories</option>
          {CATEGORY_OPTIONS.map((category) => (
            <option key={category} value={category}>{category}</option>
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
              <th>Warranty</th>
              <th>Last Online</th>
            </tr>
          </thead>
          <tbody>
            {tableLoading && tableAssets.length === 0 ? (
              <tr>
                <td colSpan={7} className="empty-cell">Loading assets...</td>
              </tr>
            ) : tableAssets.length === 0 ? (
              <tr>
                <td colSpan={7} className="empty-cell">No assets match your filter.</td>
              </tr>
            ) : tableAssets.map((asset) => (
              <tr key={asset.id} className={`asset-row asset-row-${getWarrantyState(asset.warrantyExpirationDate)}`}>
                <td>{asset.assetId}</td>
                <td>{asset.serialNumber}</td>
                <td>{asset.category}</td>
                <td>{asset.siteId}</td>
                <td>{asset.status}</td>
                <td>{formatDate(asset.warrantyExpirationDate)}</td>
                <td>{formatDateTime(asset.lastOnlineTimestamp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="table-hint">Rows highlighted in amber are within {WARRANTY_WARNING_DAYS} days of warranty expiry. Red rows are already expired.</p>

      <div className="pagination-row">
        <button type="button" className="secondary-button" disabled={currentPage === 1 || tableLoading} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
        <span>Page {currentPage} of {totalPages}</span>
        <button type="button" className="secondary-button" disabled={currentPage === totalPages || tableLoading} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next</button>
      </div>
    </article>
  );
}
