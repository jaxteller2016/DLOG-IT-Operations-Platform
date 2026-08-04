import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';

const API_BASE_URL = import.meta.env.VITE_API_URL || window.location.origin;
const INITIAL_INCIDENT_FORM = { incidentNumber: '', siteId: 'site-bucharest', assetId: '', priority: 'Medium', category: 'Hardware', description: '', status: 'Open' };
const PAGE_SIZE = 8;
const SITE_OPTIONS = [
  { value: 'site-bucharest', label: 'Bucharest Head Office' },
  { value: 'site-ploiesti', label: 'Ploiesti Warehouse' },
  { value: 'site-valladolid', label: 'Valladolid Warehouse' },
  { value: 'site-novo-mesto', label: 'Novo Mesto Operational Site' },
  { value: 'site-wroclaw', label: 'Wroclaw Operational Site' }
];

export default function IncidentList() {
  const { loading, createIncident, updateIncidentDetails, updateIncidentStatus, token, fetchIncidentsView, showToast, refreshDashboard } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_INCIDENT_FORM);
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
  const [pagination, setPagination] = useState({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 });

  const loadIncidentsPage = useCallback(async () => {
    setTableLoading(true);
    try {
      const data = await fetchIncidentsView({
        page,
        pageSize: PAGE_SIZE,
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
        const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
        const safePage = Math.min(page, totalPages);
        const start = (safePage - 1) * PAGE_SIZE;
        setTableIncidents(filteredIncidents.slice(start, start + PAGE_SIZE));
        setPagination({ page: safePage, pageSize: PAGE_SIZE, total, totalPages });
      }
    } catch (error) {
      showToast(error.message || 'Unable to load incidents', 'error');
    } finally {
      setTableLoading(false);
    }
  }, [fetchIncidentsView, page, priorityFilter, search, showToast, statusFilter]);

  useEffect(() => {
    loadIncidentsPage();
  }, [loadIncidentsPage]);

  const currentPage = pagination.page || 1;
  const totalPages = pagination.totalPages || 1;

  async function handleSubmit(event) {
    event.preventDefault();
    await createIncident(form);
    setForm(INITIAL_INCIDENT_FORM);
    setModalOpen(false);
    await refreshDashboard();
    await loadIncidentsPage();
  }

  async function handleUpdate(incidentId) {
    await updateIncidentStatus(incidentId, incidentStatusDraft);
    setUpdatingIncidentId('');
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
    <article className="card">
      <div className="section-title">
        <h2>Incidents</h2>
        <button type="button" className="secondary-button" onClick={() => setModalOpen(true)}>Create Incident</button>
      </div>

      {modalOpen ? (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="section-title">
              <h3>Create Incident</h3>
              <button type="button" className="secondary-button" onClick={() => setModalOpen(false)}>Close</button>
            </div>
            <form onSubmit={handleSubmit} className="stack-form">
              <input placeholder="Incident number" value={form.incidentNumber} onChange={(event) => setForm({ ...form, incidentNumber: event.target.value })} required />
              <input placeholder="Asset ID" value={form.assetId} onChange={(event) => setForm({ ...form, assetId: event.target.value })} required />
              <select value={form.siteId} onChange={(event) => setForm({ ...form, siteId: event.target.value })}>
                {SITE_OPTIONS.map((site) => (
                  <option key={site.value} value={site.value}>{site.label}</option>
                ))}
              </select>
              <input placeholder="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} required />
              <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
              </select>
              <button type="submit">Create incident</button>
            </form>
          </div>
        </div>
      ) : null}

      {selectedIncident ? (
        <div className="modal-overlay" onClick={() => setSelectedIncident(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="section-title">
              <h3>{selectedIncident.incidentNumber}</h3>
              <button type="button" className="secondary-button" onClick={() => setSelectedIncident(null)}>Close</button>
            </div>
            <form onSubmit={saveIncidentDetails} className="stack-form">
              <p>{selectedIncident.description}</p>
              <small>Asset: {selectedIncident.assetId} • Site: {selectedIncident.siteId}</small>
              <label>
                Status
                <select value={incidentStatusDraft} onChange={(event) => setIncidentStatusDraft(event.target.value)}>
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Resolved">Resolved</option>
                </select>
              </label>
              <label>
                Assigned technician
                <input value={assignedTechnicianDraft} onChange={(event) => setAssignedTechnicianDraft(event.target.value)} placeholder="tech@example.com" />
              </label>
              <button type="submit" disabled={loading}>Save details</button>
            </form>
          </div>
        </div>
      ) : null}

      <div className="filters-bar">
        <input
          placeholder="Search incident number, asset, site, description"
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
          <option value="Open">Open</option>
          <option value="In Progress">In Progress</option>
          <option value="Resolved">Resolved</option>
        </select>
        <select
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

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Incident</th>
              <th>Site</th>
              <th>Asset</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Assigned</th>
              <th>SLA</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tableLoading ? (
              <tr>
                <td colSpan={8} className="empty-cell">Loading incidents...</td>
              </tr>
            ) : tableIncidents.length === 0 ? (
              <tr>
                <td colSpan={8} className="empty-cell">No incidents match your filter.</td>
              </tr>
            ) : tableIncidents.map((incident) => (
              <tr key={incident.id}>
                <td>
                  <strong>{incident.incidentNumber}</strong>
                  <p>{incident.description}</p>
                </td>
                <td>{incident.siteId}</td>
                <td>{incident.assetId}</td>
                <td>{incident.priority}</td>
                <td>
                  {updatingIncidentId === incident.id ? (
                    <select value={incidentStatusDraft} onChange={(event) => setIncidentStatusDraft(event.target.value)}>
                      <option value="Open">Open</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Resolved">Resolved</option>
                    </select>
                  ) : incident.status}
                </td>
                <td>{incident.assignedTechnician || '-'}</td>
                <td>{incident.slaStatus}</td>
                <td>
                  <div className="table-actions">
                    {updatingIncidentId === incident.id ? (
                      <button type="button" onClick={() => handleUpdate(incident.id)}>Save</button>
                    ) : (
                      <>
                        <button type="button" className="secondary-button" onClick={() => openIncidentDetails(incident)}>Details</button>
                        <button type="button" onClick={() => { setUpdatingIncidentId(incident.id); setIncidentStatusDraft(incident.status); }}>Update</button>
                      </>
                    )}
                  </div>
                </td>
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
