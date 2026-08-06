import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatDateTime } from '../utils/dateTime';
import { generateIncidentNumber } from '../utils/idFactory';
import { fieldErrorsFromZod, incidentCreateSchema } from '../validation/schemas';

const API_BASE_URL = import.meta.env.VITE_API_URL || window.location.origin;
const RESPONSE_SLA_HOURS = 8;
const RESOLUTION_SLA_HOURS = 24;
const SITE_OPTIONS = [
  { value: 'site-bucharest', label: 'Bucharest Head Office' },
  { value: 'site-ploiesti', label: 'Ploiesti Warehouse' },
  { value: 'site-valladolid', label: 'Valladolid Warehouse' },
  { value: 'site-novo-mesto', label: 'Novo Mesto Operational Site' },
  { value: 'site-wroclaw', label: 'Wroclaw Operational Site' }
];

const cardClass = 'rounded-2xl border border-slate-700/70 bg-slate-900/75 p-5 shadow-[0_20px_45px_rgba(2,6,23,0.45)] backdrop-blur-sm';
const headingRowClass = 'mb-3 flex flex-wrap items-center justify-between gap-3';
const primaryButtonClass = 'rounded-xl bg-emerald-500 px-3.5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-wait disabled:opacity-70';
const secondaryButtonClass = 'rounded-xl border border-slate-600 bg-slate-800/90 px-3.5 py-2 text-sm font-medium text-slate-100 transition hover:border-emerald-400 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-60';
const dangerSecondaryButtonClass = 'rounded-xl border border-rose-500/70 bg-rose-500/10 px-3.5 py-2 text-sm font-semibold text-rose-200 transition-all duration-200 hover:-translate-y-0.5 hover:border-rose-300 hover:bg-rose-500/20 hover:text-rose-100 hover:shadow-[0_12px_24px_rgba(244,63,94,0.35)] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 disabled:hover:shadow-none';
const dangerPrimaryButtonClass = 'rounded-xl bg-rose-600 px-3.5 py-2 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-rose-500 hover:shadow-[0_14px_30px_rgba(244,63,94,0.45)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none';
const fieldClass = 'w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30';
const filtersClass = 'mb-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3';
const tableWrapClass = 'w-full overflow-x-auto';
const tableClass = 'w-max min-w-full table-auto border-separate border-spacing-0 text-left';
const thClass = 'whitespace-nowrap border-b border-slate-700/70 bg-slate-900/85 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-300';
const tdClass = 'whitespace-nowrap border-b border-slate-800/80 px-3 py-2 text-[12px] text-slate-100 align-top';
const checkboxCellClass = `${tdClass} w-10 px-2 text-center`;
const emptyCellClass = 'px-3 py-8 text-center text-sm text-slate-400';
const modalOverlayClass = 'fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/80 p-5 backdrop-blur-sm';
const modalCardClass = 'w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-[0_20px_50px_rgba(2,6,23,0.55)]';
const errorTextClass = 'mt-1 text-xs font-medium text-rose-400';

function toDateTimeLocalInputValue(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function buildInitialIncidentForm() {
  const now = new Date();
  const responseDeadline = new Date(now.getTime() + RESPONSE_SLA_HOURS * 60 * 60 * 1000);
  const resolutionDeadline = new Date(now.getTime() + RESOLUTION_SLA_HOURS * 60 * 60 * 1000);

  return {
    incidentNumber: generateIncidentNumber(),
    siteId: 'site-bucharest',
    assetId: '',
    priority: 'Medium',
    category: 'Hardware',
    description: '',
    assignedTechnician: '',
    status: 'Open',
    createdAt: toDateTimeLocalInputValue(now),
    responseDeadline: toDateTimeLocalInputValue(responseDeadline),
    resolutionDeadline: toDateTimeLocalInputValue(resolutionDeadline),
    resolutionNotes: ''
  };
}

function formatSlaLabel(value) {
  if (!value) return '-';
  if (value === 'within') return 'Within SLA';
  if (value === 'breach') return 'SLA Breach';
  return value;
}

export default function IncidentList() {
  const { user, loading, createIncident, deleteIncidents, updateIncidentDetails, updateIncidentStatus, token, fetchIncidentsView, showToast, refreshDashboard, resultsPerPage } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [form, setForm] = useState(() => buildInitialIncidentForm());
  const [formErrors, setFormErrors] = useState({});
  const [updatingIncidentId, setUpdatingIncidentId] = useState('');
  const [incidentStatusDraft, setIncidentStatusDraft] = useState('Open');
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [assignedTechnicianDraft, setAssignedTechnicianDraft] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [tableLoading, setTableLoading] = useState(false);
  const [tableIncidents, setTableIncidents] = useState([]);
  const [selectedIncidentIds, setSelectedIncidentIds] = useState([]);
  const [deleteConfirmChecked, setDeleteConfirmChecked] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, pageSize: resultsPerPage, total: 0, totalPages: 1 });

  const loadIncidentsPage = useCallback(async () => {
    setTableLoading(true);
    try {
      const data = await fetchIncidentsView({
        page,
        pageSize: resultsPerPage,
        search,
        status: statusFilter,
        priority: priorityFilter
      });

      if (data.pagination) {
        setTableIncidents(data.incidents || []);
        setPagination(data.pagination);
      } else {
        const allIncidents = data.incidents || [];
        const query = search.trim().toLowerCase();
        const filteredIncidents = allIncidents.filter((incident) => {
          const matchesQuery = !query
            || incident.incidentNumber.toLowerCase().includes(query)
            || incident.assetId.toLowerCase().includes(query)
            || incident.description.toLowerCase().includes(query)
            || incident.siteId.toLowerCase().includes(query);
          const matchesStatus = statusFilter === 'all' || incident.status === statusFilter;
          const matchesPriority = priorityFilter === 'all' || incident.priority === priorityFilter;
          return matchesQuery && matchesStatus && matchesPriority;
        });

        const total = filteredIncidents.length;
        const totalPages = Math.max(1, Math.ceil(total / resultsPerPage));
        const safePage = Math.min(page, totalPages);
        const start = (safePage - 1) * resultsPerPage;
        setTableIncidents(filteredIncidents.slice(start, start + resultsPerPage));
        setPagination({ page: safePage, pageSize: resultsPerPage, total, totalPages });
      }
    } catch (error) {
      showToast(error.message || 'Unable to load incidents', 'error');
    } finally {
      setTableLoading(false);
    }
  }, [fetchIncidentsView, page, priorityFilter, resultsPerPage, search, showToast, statusFilter]);

  useEffect(() => {
    loadIncidentsPage();
  }, [loadIncidentsPage]);

  useEffect(() => {
    setPage(1);
  }, [resultsPerPage]);

  const currentPage = pagination.page || 1;
  const totalPages = pagination.totalPages || 1;
  const isAdministrator = user?.role === 'Administrator';
  const allVisibleSelected = tableIncidents.length > 0 && tableIncidents.every((incident) => selectedIncidentIds.includes(incident.id));

  function getFieldClass(fieldName) {
    return `${fieldClass} ${formErrors[fieldName] ? 'border-rose-500 focus:border-rose-400 focus:ring-rose-400/30' : ''}`;
  }

  function updateFormField(fieldName, value) {
    const nextForm = { ...form, [fieldName]: value };
    setForm(nextForm);

    if (Object.keys(formErrors).length > 0) {
      const parsed = incidentCreateSchema.safeParse(nextForm);
      setFormErrors(parsed.success ? {} : fieldErrorsFromZod(parsed.error));
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const parsed = incidentCreateSchema.safeParse(form);
    if (!parsed.success) {
      setFormErrors(fieldErrorsFromZod(parsed.error));
      return;
    }

    setFormErrors({});
    const payload = {
      ...parsed.data,
      createdAt: new Date(form.createdAt).toISOString(),
      responseDeadline: new Date(form.responseDeadline).toISOString(),
      resolutionDeadline: new Date(form.resolutionDeadline).toISOString()
    };

    await createIncident(payload);
    setForm(buildInitialIncidentForm());
    setModalOpen(false);
    await refreshDashboard();
    await loadIncidentsPage();
  }

  async function handleUpdate(incidentId) {
    await updateIncidentStatus(incidentId, incidentStatusDraft);
    setUpdatingIncidentId('');
    await loadIncidentsPage();
  }

  function toggleIncidentSelection(incidentId) {
    setSelectedIncidentIds((current) => (current.includes(incidentId)
      ? current.filter((value) => value !== incidentId)
      : [...current, incidentId]));
  }

  function toggleSelectAllVisible() {
    if (allVisibleSelected) {
      setSelectedIncidentIds((current) => current.filter((incidentId) => !tableIncidents.some((incident) => incident.id === incidentId)));
      return;
    }

    setSelectedIncidentIds((current) => {
      const next = new Set(current);
      tableIncidents.forEach((incident) => next.add(incident.id));
      return Array.from(next);
    });
  }

  async function confirmDeleteSelectedIncidents() {
    if (!deleteConfirmChecked) return;

    await deleteIncidents(selectedIncidentIds);
    setSelectedIncidentIds([]);
    setDeleteConfirmChecked(false);
    setDeleteModalOpen(false);
    await loadIncidentsPage();
  }

  async function openIncidentDetails(incident) {
    try {
      const response = await fetch(`${API_BASE_URL}/incidents/${incident.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load incident details');
      setSelectedIncident(data.incident);
      setIncidentStatusDraft(data.incident.status || 'Open');
      setAssignedTechnicianDraft(data.incident.assignedTechnician || '');
    } catch (error) {
      setSelectedIncident(incident);
      setIncidentStatusDraft(incident.status || 'Open');
      setAssignedTechnicianDraft(incident.assignedTechnician || '');
    }
  }

  async function saveIncidentDetails(event) {
    event.preventDefault();
    if (!selectedIncident) return;

    await updateIncidentDetails(selectedIncident.id, {
      status: incidentStatusDraft,
      assignedTechnician: assignedTechnicianDraft,
      resolutionNotes: incidentStatusDraft === 'Resolved' ? 'Resolved from UI' : selectedIncident.resolutionNotes || ''
    });
    setSelectedIncident(null);
    await loadIncidentsPage();
  }

  return (
    <article className={cardClass}>
      <div className={headingRowClass}>
        <h2 className="text-xl font-semibold text-slate-50">Incidents</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={() => {
              setForm(buildInitialIncidentForm());
              setFormErrors({});
              setModalOpen(true);
            }}
          >
            Create Incident
          </button>
          {isAdministrator ? (
            <button
              type="button"
              className={dangerSecondaryButtonClass}
              disabled={selectedIncidentIds.length === 0 || loading}
              onClick={() => {
                setDeleteConfirmChecked(false);
                setDeleteModalOpen(true);
              }}
            >
              Delete Selected
            </button>
          ) : null}
        </div>
      </div>

      {modalOpen ? (
        <div className={modalOverlayClass} onClick={() => setModalOpen(false)}>
          <div className={modalCardClass} onClick={(event) => event.stopPropagation()}>
            <div className={headingRowClass}>
              <h3 className="text-lg font-semibold text-slate-50">Create Incident</h3>
              <button type="button" className={secondaryButtonClass} onClick={() => setModalOpen(false)}>Close</button>
            </div>
            <form onSubmit={handleSubmit} className="grid gap-2">
              <label className="text-sm text-slate-200">
                Incident number
                <input className={`${getFieldClass('incidentNumber')} mt-1`} placeholder="Incident number" value={form.incidentNumber} readOnly required />
                {formErrors.incidentNumber ? <p className={errorTextClass}>{formErrors.incidentNumber}</p> : null}
              </label>
              <label className="text-sm text-slate-200">
                Asset ID
                <input className={`${getFieldClass('assetId')} mt-1`} placeholder="Asset ID" value={form.assetId} onChange={(event) => updateFormField('assetId', event.target.value)} required />
                {formErrors.assetId ? <p className={errorTextClass}>{formErrors.assetId}</p> : null}
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
                Description
                <input className={`${getFieldClass('description')} mt-1`} placeholder="Description" value={form.description} onChange={(event) => updateFormField('description', event.target.value)} required />
                {formErrors.description ? <p className={errorTextClass}>{formErrors.description}</p> : null}
              </label>
              <label className="text-sm text-slate-200">
                Assigned technician
                <input className={`${getFieldClass('assignedTechnician')} mt-1`} placeholder="Assigned technician" value={form.assignedTechnician} onChange={(event) => updateFormField('assignedTechnician', event.target.value)} />
                {formErrors.assignedTechnician ? <p className={errorTextClass}>{formErrors.assignedTechnician}</p> : null}
              </label>
              <label className="text-sm text-slate-200">
                Priority
                <select className={`${getFieldClass('priority')} mt-1`} value={form.priority} onChange={(event) => updateFormField('priority', event.target.value)}>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
                {formErrors.priority ? <p className={errorTextClass}>{formErrors.priority}</p> : null}
              </label>
              <label className="text-sm text-slate-200">
                Status
                <select className={`${getFieldClass('status')} mt-1`} value={form.status} onChange={(event) => updateFormField('status', event.target.value)}>
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Resolved">Resolved</option>
                </select>
                {formErrors.status ? <p className={errorTextClass}>{formErrors.status}</p> : null}
              </label>
              <label className="text-sm text-slate-200">
                Creation date
                <input className={`${getFieldClass('createdAt')} mt-1`} type="datetime-local" value={form.createdAt} readOnly />
                {formErrors.createdAt ? <p className={errorTextClass}>{formErrors.createdAt}</p> : null}
              </label>
              <label className="text-sm text-slate-200">
                Response deadline
                <input
                  className={`${getFieldClass('responseDeadline')} mt-1`}
                  type="datetime-local"
                  value={form.responseDeadline}
                  onChange={(event) => updateFormField('responseDeadline', event.target.value)}
                  required
                />
                {formErrors.responseDeadline ? <p className={errorTextClass}>{formErrors.responseDeadline}</p> : null}
              </label>
              <label className="text-sm text-slate-200">
                Resolution deadline
                <input
                  className={`${getFieldClass('resolutionDeadline')} mt-1`}
                  type="datetime-local"
                  value={form.resolutionDeadline}
                  onChange={(event) => updateFormField('resolutionDeadline', event.target.value)}
                  required
                />
                {formErrors.resolutionDeadline ? <p className={errorTextClass}>{formErrors.resolutionDeadline}</p> : null}
              </label>
              <label className="text-sm text-slate-200">
                Resolution notes
                <input className={`${getFieldClass('resolutionNotes')} mt-1`} placeholder="Resolution notes" value={form.resolutionNotes} onChange={(event) => updateFormField('resolutionNotes', event.target.value)} />
                {formErrors.resolutionNotes ? <p className={errorTextClass}>{formErrors.resolutionNotes}</p> : null}
              </label>
              <button type="submit" className={primaryButtonClass}>Create incident</button>
            </form>
          </div>
        </div>
      ) : null}

      {selectedIncident ? (
        <div className={modalOverlayClass} onClick={() => setSelectedIncident(null)}>
          <div className={modalCardClass} onClick={(event) => event.stopPropagation()}>
            <div className={headingRowClass}>
              <h3 className="text-lg font-semibold text-slate-50">{selectedIncident.incidentNumber}</h3>
              <button type="button" className={secondaryButtonClass} onClick={() => setSelectedIncident(null)}>Close</button>
            </div>
            <form onSubmit={saveIncidentDetails} className="grid gap-2">
              <p className="text-sm text-slate-300">{selectedIncident.description}</p>
              <small className="text-xs text-slate-400">Asset: {selectedIncident.assetId} | Site: {selectedIncident.siteId}</small>
              <label className="text-sm text-slate-200">
                Status
                <select className={`${fieldClass} mt-1`} value={incidentStatusDraft} onChange={(event) => setIncidentStatusDraft(event.target.value)}>
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Resolved">Resolved</option>
                </select>
              </label>
              <label className="text-sm text-slate-200">
                Assigned technician
                <input className={`${fieldClass} mt-1`} value={assignedTechnicianDraft} onChange={(event) => setAssignedTechnicianDraft(event.target.value)} placeholder="tech@example.com" />
              </label>
              <button type="submit" className={primaryButtonClass} disabled={loading}>Save details</button>
            </form>
          </div>
        </div>
      ) : null}

      {deleteModalOpen ? (
        <div className={modalOverlayClass} onClick={() => setDeleteModalOpen(false)}>
          <div className={modalCardClass} onClick={(event) => event.stopPropagation()}>
            <div className={headingRowClass}>
              <h3 className="text-lg font-semibold text-slate-50">Delete Incidents</h3>
              <button type="button" className={secondaryButtonClass} onClick={() => setDeleteModalOpen(false)}>Close</button>
            </div>
            <p className="text-sm text-slate-200">Are you sure you want to delete {selectedIncidentIds.length} selected incident(s)?</p>
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
                onClick={confirmDeleteSelectedIncidents}
              >
                I'm sure
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className={filtersClass}>
        <input
          className={fieldClass}
          placeholder="Search incident number, asset, site, description"
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
          <option value="Open">Open</option>
          <option value="In Progress">In Progress</option>
          <option value="Resolved">Resolved</option>
        </select>
        <select
          className={fieldClass}
          value={priorityFilter}
          onChange={(event) => {
            setPriorityFilter(event.target.value);
            setPage(1);
          }}
        >
          <option value="all">All priorities</option>
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
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
                    aria-label="Select all incidents"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                  />
                </th>
              ) : null}
              <th className={thClass}>Incident</th>
              <th className={thClass}>Site</th>
              <th className={thClass}>Asset</th>
              <th className={thClass}>Priority</th>
              <th className={thClass}>Status</th>
              <th className={thClass}>Assigned</th>
              <th className={thClass}>Created</th>
              <th className={thClass}>Response Deadline</th>
              <th className={thClass}>Resolution Deadline</th>
              <th className={thClass}>SLA</th>
              <th className={thClass}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tableLoading && tableIncidents.length === 0 ? (
              <tr>
                <td colSpan={isAdministrator ? 12 : 11} className={emptyCellClass}>Loading incidents...</td>
              </tr>
            ) : tableIncidents.length === 0 ? (
              <tr>
                <td colSpan={isAdministrator ? 12 : 11} className={emptyCellClass}>No incidents match your filter.</td>
              </tr>
            ) : tableIncidents.map((incident) => (
              <tr key={incident.id}>
                {isAdministrator ? (
                  <td className={checkboxCellClass}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${incident.incidentNumber}`}
                      checked={selectedIncidentIds.includes(incident.id)}
                      onChange={() => toggleIncidentSelection(incident.id)}
                    />
                  </td>
                ) : null}
                <td className={tdClass}>
                  <strong className="text-slate-50">{incident.incidentNumber}</strong>
                  <p className="mt-1 whitespace-nowrap text-[11px] text-slate-400">{incident.description}</p>
                </td>
                <td className={tdClass}>{incident.siteId}</td>
                <td className={tdClass}>{incident.assetId}</td>
                <td className={tdClass}>{incident.priority}</td>
                <td className={tdClass}>
                  {updatingIncidentId === incident.id ? (
                    <select className={`${fieldClass} min-w-[8rem]`} value={incidentStatusDraft} onChange={(event) => setIncidentStatusDraft(event.target.value)}>
                      <option value="Open">Open</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Resolved">Resolved</option>
                    </select>
                  ) : incident.status}
                </td>
                <td className={tdClass}>{incident.assignedTechnician || '-'}</td>
                <td className={tdClass}>{formatDateTime(incident.createdAt)}</td>
                <td className={tdClass}>{formatDateTime(incident.responseDeadline)}</td>
                <td className={tdClass}>{formatDateTime(incident.resolutionDeadline)}</td>
                <td className={tdClass}>
                  <strong>{formatSlaLabel(incident.slaStatus)}</strong>
                  <p className="mt-1 whitespace-nowrap text-[11px] text-slate-400">
                    Response: {formatSlaLabel(incident.responseSlaStatus)}
                    {' | '}
                    Resolution: {formatSlaLabel(incident.resolutionSlaStatus)}
                  </p>
                </td>
                <td className={tdClass}>
                  <div className="flex gap-2">
                    {updatingIncidentId === incident.id ? (
                      <button type="button" className={primaryButtonClass} onClick={() => handleUpdate(incident.id)}>Save</button>
                    ) : (
                      <>
                        <button type="button" className={secondaryButtonClass} onClick={() => openIncidentDetails(incident)}>Details</button>
                        <button type="button" className={primaryButtonClass} onClick={() => { setUpdatingIncidentId(incident.id); setIncidentStatusDraft(incident.status); }}>Update</button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-sm text-slate-300">
        <button type="button" className={secondaryButtonClass} disabled={currentPage === 1 || tableLoading} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
        <span>Page {currentPage} of {totalPages}</span>
        <button type="button" className={secondaryButtonClass} disabled={currentPage === totalPages || tableLoading} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next</button>
      </div>
    </article>
  );
}
