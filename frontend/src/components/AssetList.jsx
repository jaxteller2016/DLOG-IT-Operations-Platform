import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatDate, formatDateTime } from '../utils/dateTime';
import { generateAssetId } from '../utils/idFactory';
import { assetCreateSchema, fieldErrorsFromZod } from '../validation/schemas';

const WARRANTY_WARNING_DAYS = 60;
const SITE_OPTIONS = [
  { value: 'site-bucharest', label: 'Bucharest Head Office' },
  { value: 'site-ploiesti', label: 'Ploiesti Warehouse' },
  { value: 'site-valladolid', label: 'Valladolid Warehouse' },
  { value: 'site-novo-mesto', label: 'Novo Mesto Operational Site' },
  { value: 'site-wroclaw', label: 'Wroclaw Operational Site' }
];
const CATEGORY_OPTIONS = ['Laptop', 'Desktop', 'Server', 'Network', 'Printer', 'Scanner', 'UPS', 'Other'];
const KNOWN_ASSETS_PAGE_SIZE = 10;

function buildInitialAssetForm(prefill = {}) {
  return {
    assetId: generateAssetId(),
    heartbeatSourceId: '',
    serialNumber: '',
    category: 'Laptop',
    manufacturer: '',
    model: '',
    siteId: 'site-bucharest',
    assignedEmployee: '',
    ipAddress: '',
    macAddress: '',
    operatingSystem: '',
    purchaseDate: '',
    warrantyExpirationDate: '',
    status: 'Online',
    ...prefill
  };
}

function buildHeartbeatPrefill(knownAsset) {
  return {
    heartbeatSourceId: knownAsset.assetId || '',
    serialNumber: knownAsset.serialNumber || '',
    ipAddress: knownAsset.ipAddress || '',
    macAddress: knownAsset.macAddress || '',
    operatingSystem: knownAsset.operatingSystem || ''
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

function parseBackendFieldErrors(message) {
  if (!message || typeof message !== 'string') return {};

  return message
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce((accumulator, entry) => {
      const match = /^([A-Za-z0-9_.]+):\s*(.+)$/.exec(entry);
      if (!match) return accumulator;

      const fieldName = match[1];
      const fieldMessage = match[2];
      if (!accumulator[fieldName]) {
        accumulator[fieldName] = fieldMessage;
      }
      return accumulator;
    }, {});
}

const cardClass = 'rounded-2xl border border-slate-700/70 bg-slate-900/75 p-5 shadow-[0_20px_45px_rgba(2,6,23,0.45)] backdrop-blur-sm';
const headingRowClass = 'mb-3 flex flex-wrap items-center justify-between gap-3';
const actionsRowClass = 'flex flex-wrap items-center gap-2';
const primaryButtonClass = 'rounded-xl bg-emerald-500 px-3.5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-wait disabled:opacity-70';
const secondaryButtonClass = 'rounded-xl border border-slate-600 bg-slate-800/90 px-3.5 py-2 text-sm font-medium text-slate-100 transition hover:border-emerald-400 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-60';
const dangerSecondaryButtonClass = 'rounded-xl border border-rose-500/70 bg-rose-500/10 px-3.5 py-2 text-sm font-semibold text-rose-200 transition-all duration-200 hover:-translate-y-0.5 hover:border-rose-300 hover:bg-rose-500/20 hover:text-rose-100 hover:shadow-[0_12px_24px_rgba(244,63,94,0.35)] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 disabled:hover:shadow-none';
const dangerPrimaryButtonClass = 'rounded-xl bg-rose-600 px-3.5 py-2 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-rose-500 hover:shadow-[0_14px_30px_rgba(244,63,94,0.45)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none';
const fieldClass = 'w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30';
const filtersClass = 'mb-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4';
const tableWrapClass = 'w-full overflow-x-auto';
const tableClass = 'w-max min-w-full table-auto border-separate border-spacing-0 text-left';
const thClass = 'whitespace-nowrap border-b border-slate-700/70 bg-slate-900/85 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-300';
const tdClass = 'whitespace-nowrap border-b border-slate-800/80 px-3 py-2 text-[12px] text-slate-100';
const checkboxCellClass = `${tdClass} w-10 px-2 text-center`;
const emptyCellClass = 'px-3 py-8 text-center text-sm text-slate-400';
const modalOverlayClass = 'fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/80 p-5 backdrop-blur-sm';
const modalCardClass = 'w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-[0_20px_50px_rgba(2,6,23,0.55)]';
const modalWideClass = 'w-[96vw] max-w-[1600px] rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-[0_20px_50px_rgba(2,6,23,0.55)]';
const errorTextClass = 'mt-1 text-xs font-medium text-rose-400';

export default function AssetList() {
  const { user, loading, refreshDashboard, createAsset, deleteAssets, fetchAssetsView, fetchKnownAssets, showToast, resultsPerPage } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [knownAssetsOpen, setKnownAssetsOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [form, setForm] = useState(() => buildInitialAssetForm());
  const [formErrors, setFormErrors] = useState({});
  const [knownAssetsLoading, setKnownAssetsLoading] = useState(false);
  const [knownAssets, setKnownAssets] = useState([]);
  const [knownAssetsPage, setKnownAssetsPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [siteFilter, setSiteFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [tableLoading, setTableLoading] = useState(false);
  const [tableAssets, setTableAssets] = useState([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState([]);
  const [deleteConfirmChecked, setDeleteConfirmChecked] = useState(false);
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
            || asset.siteId.toLowerCase().includes(query)
            || (asset.ipAddress || '').toLowerCase().includes(query)
            || (asset.macAddress || '').toLowerCase().includes(query)
            || (asset.operatingSystem || '').toLowerCase().includes(query)
            || (asset.assignedEmployee || '').toLowerCase().includes(query)
            || (asset.manufacturer || '').toLowerCase().includes(query)
            || (asset.model || '').toLowerCase().includes(query);
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

  const loadKnownAssets = useCallback(async () => {
    setKnownAssetsLoading(true);
    try {
      const data = await fetchKnownAssets();
      setKnownAssets(data.knownAssets || []);
    } catch (error) {
      showToast(error.message || 'Unable to load known assets', 'error');
    } finally {
      setKnownAssetsLoading(false);
    }
  }, [fetchKnownAssets, showToast]);

  useEffect(() => {
    loadAssetsPage();
  }, [loadAssetsPage]);

  useEffect(() => {
    setPage(1);
  }, [resultsPerPage]);

  const currentPage = pagination.page || 1;
  const totalPages = pagination.totalPages || 1;
  const knownAssetsTotalPages = Math.max(1, Math.ceil(knownAssets.length / KNOWN_ASSETS_PAGE_SIZE));
  const knownAssetsCurrentPage = Math.min(knownAssetsPage, knownAssetsTotalPages);
  const knownAssetsStart = (knownAssetsCurrentPage - 1) * KNOWN_ASSETS_PAGE_SIZE;
  const knownAssetsPageRows = knownAssets.slice(knownAssetsStart, knownAssetsStart + KNOWN_ASSETS_PAGE_SIZE);
  const isAdministrator = user?.role === 'Administrator';
  const allVisibleSelected = tableAssets.length > 0 && tableAssets.every((asset) => selectedAssetIds.includes(asset.id));

  function getFieldClass(fieldName) {
    return `${fieldClass} ${formErrors[fieldName] ? 'border-rose-500 focus:border-rose-400 focus:ring-rose-400/30' : ''}`;
  }

  function updateFormField(fieldName, value) {
    const nextForm = { ...form, [fieldName]: value };
    setForm(nextForm);

    if (Object.keys(formErrors).length > 0) {
      const parsed = assetCreateSchema.safeParse(nextForm);
      setFormErrors(parsed.success ? {} : fieldErrorsFromZod(parsed.error));
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const parsed = assetCreateSchema.safeParse(form);
    if (!parsed.success) {
      setFormErrors(fieldErrorsFromZod(parsed.error));
      return;
    }

    setFormErrors({});
    try {
      await createAsset(form, { suppressErrorToast: true });
      setForm(buildInitialAssetForm());
      setModalOpen(false);
      await refreshDashboard();
      await loadAssetsPage();
    } catch (error) {
      const serverFieldErrors = parseBackendFieldErrors(error.message || '');
      if (Object.keys(serverFieldErrors).length > 0) {
        setFormErrors(serverFieldErrors);
        return;
      }

      showToast(error.message || 'Unable to create asset', 'error');
    }
  }

  async function handleRefresh() {
    await refreshDashboard();
    await loadAssetsPage();
  }

  function toggleAssetSelection(assetId) {
    setSelectedAssetIds((current) => (current.includes(assetId)
      ? current.filter((value) => value !== assetId)
      : [...current, assetId]));
  }

  function toggleSelectAllVisible() {
    if (allVisibleSelected) {
      setSelectedAssetIds((current) => current.filter((assetId) => !tableAssets.some((asset) => asset.id === assetId)));
      return;
    }

    setSelectedAssetIds((current) => {
      const next = new Set(current);
      tableAssets.forEach((asset) => next.add(asset.id));
      return Array.from(next);
    });
  }

  async function confirmDeleteSelectedAssets() {
    if (!deleteConfirmChecked) return;

    await deleteAssets(selectedAssetIds);
    setSelectedAssetIds([]);
    setDeleteConfirmChecked(false);
    setDeleteModalOpen(false);
    await loadAssetsPage();
  }

  async function openKnownAssetsModal() {
    setKnownAssetsOpen(true);
    setKnownAssetsPage(1);
    await loadKnownAssets();
  }

  function createFromKnownAsset(knownAsset) {
    setKnownAssetsOpen(false);
    setForm(buildInitialAssetForm(buildHeartbeatPrefill(knownAsset)));
    setFormErrors({});
    setModalOpen(true);
  }

  function rowStateClass(warrantyDate) {
    const warrantyState = getWarrantyState(warrantyDate);
    if (warrantyState === 'warning') return 'bg-amber-500/10';
    if (warrantyState === 'expired') return 'bg-rose-500/10';
    return '';
  }

  return (
    <article className={cardClass}>
      <div className={headingRowClass}>
        <h2 className="text-xl font-semibold text-slate-50">Assets</h2>
        <div className={actionsRowClass}>
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={() => {
              setForm(buildInitialAssetForm());
              setFormErrors({});
              setModalOpen(true);
            }}
          >
            Create Asset
          </button>
          <button type="button" className={secondaryButtonClass} onClick={openKnownAssetsModal}>Known Assets</button>
          {isAdministrator ? (
            <button
              type="button"
              className={dangerSecondaryButtonClass}
              disabled={selectedAssetIds.length === 0 || loading}
              onClick={() => {
                setDeleteConfirmChecked(false);
                setDeleteModalOpen(true);
              }}
            >
              Delete Selected
            </button>
          ) : null}
          <button className={primaryButtonClass} onClick={handleRefresh} disabled={loading || tableLoading}>Refresh</button>
        </div>
      </div>

      {modalOpen ? (
        <div className={modalOverlayClass} onClick={() => setModalOpen(false)}>
          <div className={modalCardClass} onClick={(event) => event.stopPropagation()}>
            <div className={headingRowClass}>
              <h3 className="text-lg font-semibold text-slate-50">Create Asset</h3>
              <button type="button" className={secondaryButtonClass} onClick={() => setModalOpen(false)}>Close</button>
            </div>
            <form onSubmit={handleSubmit} className="grid gap-2">
              <label className="text-sm text-slate-200">
                Asset ID
                <input className={`${getFieldClass('assetId')} mt-1`} placeholder="Asset ID" value={form.assetId} readOnly required />
                {formErrors.assetId ? <p className={errorTextClass}>{formErrors.assetId}</p> : null}
              </label>
              <label className="text-sm text-slate-200">
                Serial
                <input className={`${getFieldClass('serialNumber')} mt-1`} placeholder="Serial" value={form.serialNumber} onChange={(event) => updateFormField('serialNumber', event.target.value)} required />
                {formErrors.serialNumber ? <p className={errorTextClass}>{formErrors.serialNumber}</p> : null}
              </label>
              <label className="text-sm text-slate-200">
                Category
                <select className={`${getFieldClass('category')} mt-1`} value={form.category} onChange={(event) => updateFormField('category', event.target.value)}>
                  {CATEGORY_OPTIONS.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
                {formErrors.category ? <p className={errorTextClass}>{formErrors.category}</p> : null}
              </label>
              <label className="text-sm text-slate-200">
                Manufacturer
                <input className={`${getFieldClass('manufacturer')} mt-1`} placeholder="Manufacturer" value={form.manufacturer} onChange={(event) => updateFormField('manufacturer', event.target.value)} />
                {formErrors.manufacturer ? <p className={errorTextClass}>{formErrors.manufacturer}</p> : null}
              </label>
              <label className="text-sm text-slate-200">
                Model
                <input className={`${getFieldClass('model')} mt-1`} placeholder="Model" value={form.model} onChange={(event) => updateFormField('model', event.target.value)} />
                {formErrors.model ? <p className={errorTextClass}>{formErrors.model}</p> : null}
              </label>
              <label className="text-sm text-slate-200">
                Site
                <select className={`${getFieldClass('siteId')} mt-1`} value={form.siteId} onChange={(event) => updateFormField('siteId', event.target.value)}>
                  {SITE_OPTIONS.map((site) => (
                    <option key={site.value} value={site.value}>{site.label}</option>
                  ))}
                </select>
                {formErrors.siteId ? <p className={errorTextClass}>{formErrors.siteId}</p> : null}
              </label>
              <label className="text-sm text-slate-200">
                Employee email address
                <input className={`${getFieldClass('assignedEmployee')} mt-1`} placeholder="name@example.com" value={form.assignedEmployee} onChange={(event) => updateFormField('assignedEmployee', event.target.value)} />
                {formErrors.assignedEmployee ? <p className={errorTextClass}>{formErrors.assignedEmployee}</p> : null}
              </label>
              <label className="text-sm text-slate-200">
                IP address
                <input className={`${getFieldClass('ipAddress')} mt-1`} placeholder="IP address" value={form.ipAddress} onChange={(event) => updateFormField('ipAddress', event.target.value)} />
                {formErrors.ipAddress ? <p className={errorTextClass}>{formErrors.ipAddress}</p> : null}
              </label>
              <label className="text-sm text-slate-200">
                MAC address
                <input className={`${getFieldClass('macAddress')} mt-1`} placeholder="MAC address" value={form.macAddress} onChange={(event) => updateFormField('macAddress', event.target.value)} />
                {formErrors.macAddress ? <p className={errorTextClass}>{formErrors.macAddress}</p> : null}
              </label>
              <label className="text-sm text-slate-200">
                Operating system
                <input className={`${getFieldClass('operatingSystem')} mt-1`} placeholder="Operating system" value={form.operatingSystem} onChange={(event) => updateFormField('operatingSystem', event.target.value)} />
                {formErrors.operatingSystem ? <p className={errorTextClass}>{formErrors.operatingSystem}</p> : null}
              </label>
              <label className="text-sm text-slate-200">
                Purchase date
                <input className={`${getFieldClass('purchaseDate')} mt-1`} type="date" value={form.purchaseDate} onChange={(event) => updateFormField('purchaseDate', event.target.value)} />
              </label>
              <label className="text-sm text-slate-200">
                Warranty expiration date
                <input className={`${getFieldClass('warrantyExpirationDate')} mt-1`} type="date" value={form.warrantyExpirationDate} onChange={(event) => updateFormField('warrantyExpirationDate', event.target.value)} />
              </label>
              <label className="text-sm text-slate-200">
                Status
                <select className={`${getFieldClass('status')} mt-1`} value={form.status} onChange={(event) => updateFormField('status', event.target.value)}>
                  <option value="Online">Online</option>
                  <option value="Offline">Offline</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="Unknown">Unknown</option>
                </select>
                {formErrors.status ? <p className={errorTextClass}>{formErrors.status}</p> : null}
              </label>
              <button type="submit" className={primaryButtonClass}>Create asset</button>
            </form>
          </div>
        </div>
      ) : null}

      {deleteModalOpen ? (
        <div className={modalOverlayClass} onClick={() => setDeleteModalOpen(false)}>
          <div className={modalCardClass} onClick={(event) => event.stopPropagation()}>
            <div className={headingRowClass}>
              <h3 className="text-lg font-semibold text-slate-50">Delete Assets</h3>
              <button type="button" className={secondaryButtonClass} onClick={() => setDeleteModalOpen(false)}>Close</button>
            </div>
            <p className="text-sm text-slate-200">Are you sure you want to delete {selectedAssetIds.length} selected asset(s)?</p>
            <label className="mt-3 flex items-start gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                className="mt-1"
                checked={deleteConfirmChecked}
                onChange={(event) => setDeleteConfirmChecked(event.target.checked)}
              />
              <span>I understand that I will be deleting the selected records from the application database and this operation cannot be undone</span>
            </label>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() => {
                  setDeleteModalOpen(false);
                  setDeleteConfirmChecked(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className={dangerPrimaryButtonClass}
                disabled={!deleteConfirmChecked || loading}
                onClick={confirmDeleteSelectedAssets}
              >
                I'm sure
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {knownAssetsOpen ? (
        <div className={modalOverlayClass} onClick={() => setKnownAssetsOpen(false)}>
          <div className={modalWideClass} onClick={(event) => event.stopPropagation()}>
            <div className={headingRowClass}>
              <h3 className="text-lg font-semibold text-slate-50">Known Assets from Heartbeat</h3>
              <button type="button" className={secondaryButtonClass} onClick={() => setKnownAssetsOpen(false)}>Close</button>
            </div>
            <div className={tableWrapClass}>
              <table className={tableClass}>
                <thead>
                  <tr>
                    <th className={thClass}>Asset ID</th>
                    <th className={thClass}>Serial</th>
                    <th className={thClass}>IP Address</th>
                    <th className={thClass}>MAC Address</th>
                    <th className={thClass}>Operating System</th>
                    <th className={thClass}>Last Heartbeat</th>
                    <th className={thClass}>Registered</th>
                    <th className={thClass}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {knownAssetsLoading ? (
                    <tr>
                      <td colSpan={8} className={emptyCellClass}>Loading known assets...</td>
                    </tr>
                  ) : knownAssets.length === 0 ? (
                    <tr>
                      <td colSpan={8} className={emptyCellClass}>No heartbeat sources found.</td>
                    </tr>
                  ) : knownAssetsPageRows.map((knownAsset) => (
                    <tr key={knownAsset.assetId}>
                      <td className={tdClass}>{knownAsset.assetId}</td>
                      <td className={tdClass}>{knownAsset.serialNumber || '-'}</td>
                      <td className={tdClass}>{knownAsset.ipAddress || '-'}</td>
                      <td className={tdClass}>{knownAsset.macAddress || '-'}</td>
                      <td className={tdClass}>{knownAsset.operatingSystem || '-'}</td>
                      <td className={tdClass}>{formatDateTime(knownAsset.lastHeartbeatAt)}</td>
                      <td className={tdClass}>{knownAsset.isRegistered ? 'Yes' : 'No'}</td>
                      <td className={tdClass}>
                        <button
                          type="button"
                          className={secondaryButtonClass}
                          onClick={() => createFromKnownAsset(knownAsset)}
                        >
                          Create Asset
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!knownAssetsLoading && knownAssets.length > 0 ? (
              <div className="mt-3 flex items-center justify-between gap-2 text-sm text-slate-300">
                <button
                  type="button"
                  className={secondaryButtonClass}
                  disabled={knownAssetsCurrentPage === 1}
                  onClick={() => setKnownAssetsPage((value) => Math.max(1, value - 1))}
                >
                  Previous
                </button>
                <span>Page {knownAssetsCurrentPage} of {knownAssetsTotalPages}</span>
                <button
                  type="button"
                  className={secondaryButtonClass}
                  disabled={knownAssetsCurrentPage === knownAssetsTotalPages}
                  onClick={() => setKnownAssetsPage((value) => Math.min(knownAssetsTotalPages, value + 1))}
                >
                  Next
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className={filtersClass}>
        <input
          className={fieldClass}
          placeholder="Search asset ID, serial, category, site"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <select
          className={fieldClass}
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
          className={fieldClass}
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
          className={fieldClass}
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

      <div className={tableWrapClass}>
        <table className={tableClass}>
          <thead>
            <tr>
              {isAdministrator ? (
                <th className={`${thClass} w-10 px-2 text-center`}>
                  <input
                    type="checkbox"
                    aria-label="Select all assets"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                  />
                </th>
              ) : null}
              <th className={thClass}>Asset ID</th>
              <th className={thClass}>Serial</th>
              <th className={thClass}>Category</th>
              <th className={thClass}>Manufacturer</th>
              <th className={thClass}>Model</th>
              <th className={thClass}>Site</th>
              <th className={thClass}>Assigned Employee</th>
              <th className={thClass}>IP Address</th>
              <th className={thClass}>MAC Address</th>
              <th className={thClass}>Operating System</th>
              <th className={thClass}>Purchase Date</th>
              <th className={thClass}>Warranty Expiration</th>
              <th className={thClass}>Status</th>
              <th className={thClass}>Last Online</th>
            </tr>
          </thead>
          <tbody>
            {tableLoading && tableAssets.length === 0 ? (
              <tr>
                <td colSpan={isAdministrator ? 15 : 14} className={emptyCellClass}>Loading assets...</td>
              </tr>
            ) : tableAssets.length === 0 ? (
              <tr>
                <td colSpan={isAdministrator ? 15 : 14} className={emptyCellClass}>No assets match your filter.</td>
              </tr>
            ) : tableAssets.map((asset) => (
              <tr key={asset.id} className={rowStateClass(asset.warrantyExpirationDate)}>
                {isAdministrator ? (
                  <td className={checkboxCellClass}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${asset.assetId}`}
                      checked={selectedAssetIds.includes(asset.id)}
                      onChange={() => toggleAssetSelection(asset.id)}
                    />
                  </td>
                ) : null}
                <td className={tdClass}>{asset.assetId}</td>
                <td className={tdClass}>{asset.serialNumber}</td>
                <td className={tdClass}>{asset.category}</td>
                <td className={tdClass}>{asset.manufacturer || '-'}</td>
                <td className={tdClass}>{asset.model || '-'}</td>
                <td className={tdClass}>{asset.siteId}</td>
                <td className={tdClass}>{asset.assignedEmployee || '-'}</td>
                <td className={tdClass}>{asset.ipAddress || '-'}</td>
                <td className={tdClass}>{asset.macAddress || '-'}</td>
                <td className={tdClass}>{asset.operatingSystem || '-'}</td>
                <td className={tdClass}>{formatDate(asset.purchaseDate)}</td>
                <td className={tdClass}>{formatDate(asset.warrantyExpirationDate)}</td>
                <td className={tdClass}>{asset.status}</td>
                <td className={tdClass}>{formatDateTime(asset.lastOnlineTimestamp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-sm text-slate-400">Rows highlighted in amber are within {WARRANTY_WARNING_DAYS} days of warranty expiry. Red rows are already expired.</p>

      <div className="mt-3 flex items-center justify-between gap-2 text-sm text-slate-300">
        <button type="button" className={secondaryButtonClass} disabled={currentPage === 1 || tableLoading} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
        <span>Page {currentPage} of {totalPages}</span>
        <button type="button" className={secondaryButtonClass} disabled={currentPage === totalPages || tableLoading} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next</button>
      </div>
    </article>
  );
}
