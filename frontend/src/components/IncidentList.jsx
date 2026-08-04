import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

const INITIAL_INCIDENT_FORM = { incidentNumber: '', siteId: 'site-bucharest', assetId: '', priority: 'Medium', category: 'Hardware', description: '', status: 'Open' };

export default function IncidentList() {
  const { incidents, loading, createIncident, updateIncidentStatus } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_INCIDENT_FORM);
  const [updatingIncidentId, setUpdatingIncidentId] = useState('');
  const [incidentStatusDraft, setIncidentStatusDraft] = useState('Open');

  async function handleSubmit(event) {
    event.preventDefault();
    await createIncident(form);
    setForm(INITIAL_INCIDENT_FORM);
    setModalOpen(false);
  }

  async function handleUpdate(incidentId) {
    await updateIncidentStatus(incidentId, incidentStatusDraft);
    setUpdatingIncidentId('');
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
              <input placeholder="Site ID" value={form.siteId} onChange={(event) => setForm({ ...form, siteId: event.target.value })} required />
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

      <ul className="list">
        {incidents.map((incident) => (
          <li key={incident.id}>
            <div>
              <strong>{incident.incidentNumber}</strong>
              <p>{incident.description}</p>
            </div>
            <div className="incident-actions">
              {updatingIncidentId === incident.id ? (
                <>
                  <select value={incidentStatusDraft} onChange={(event) => setIncidentStatusDraft(event.target.value)}>
                    <option value="Open">Open</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Resolved">Resolved</option>
                  </select>
                  <button type="button" onClick={() => handleUpdate(incident.id)}>Save</button>
                </>
              ) : (
                <button type="button" onClick={() => { setUpdatingIncidentId(incident.id); setIncidentStatusDraft(incident.status); }}>Update</button>
              )}
              <span>{incident.slaStatus}</span>
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}
