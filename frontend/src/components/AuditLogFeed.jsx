import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatDateTime } from '../utils/dateTime';

export default function AuditLogFeed() {
  const { fetchAuditLogs, showToast, resultsPerPage } = useApp();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [entityFilter, setEntityFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const loadAuditLogs = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await fetchAuditLogs({ limit: 500 });
      setEntries(data.entries || []);
    } catch (error) {
      setLoadError(error.message || 'Unable to load audit logs');
      showToast(error.message || 'Unable to load audit logs', 'error');
    } finally {
      setLoading(false);
    }
  }, [fetchAuditLogs, showToast]);

  useEffect(() => {
    loadAuditLogs();
  }, [loadAuditLogs]);

  const filteredEntries = useMemo(() => {
    const query = search.trim().toLowerCase();
    return entries.filter((entry) => {
      if (entityFilter !== 'all' && entry.entity !== entityFilter) return false;
      if (!query) return true;
      const haystack = `${entry.actor} ${entry.entity} ${entry.action} ${entry.entityId || ''}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [entries, entityFilter, search]);

  useEffect(() => {
    setPage(1);
  }, [resultsPerPage]);

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / resultsPerPage));
  const currentPage = Math.min(page, totalPages);
  const paginatedEntries = filteredEntries.slice((currentPage - 1) * resultsPerPage, currentPage * resultsPerPage);

  return (
    <section className="card">
      <div className="section-title">
        <h2>Audit log</h2>
        <button type="button" className="secondary-button" onClick={loadAuditLogs} disabled={loading}>Refresh</button>
      </div>

      {loadError ? <p className="error">{loadError}</p> : null}

      <div className="filters-bar">
        <input
          placeholder="Search actor, entity, action, id"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <select
          value={entityFilter}
          onChange={(event) => {
            setEntityFilter(event.target.value);
            setPage(1);
          }}
        >
          <option value="all">All entities</option>
          <option value="asset">Asset</option>
          <option value="incident">Incident</option>
          <option value="alert">Alert</option>
        </select>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Actor</th>
              <th>Source</th>
              <th>Entity</th>
              <th>Action</th>
              <th>Entity ID</th>
            </tr>
          </thead>
          <tbody>
            {loading && paginatedEntries.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty-cell">Loading audit logs...</td>
              </tr>
            ) : paginatedEntries.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty-cell">No audit entries match your filter.</td>
              </tr>
            ) : paginatedEntries.map((entry) => (
              <tr key={entry.id}>
                <td>{formatDateTime(entry.createdAt)}</td>
                <td>{entry.actor}</td>
                <td>{entry.source}</td>
                <td>{entry.entity}</td>
                <td>{entry.action}</td>
                <td>{entry.entityId || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pagination-row">
        <button type="button" className="secondary-button" disabled={currentPage === 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
        <span>Page {currentPage} of {totalPages}</span>
        <button type="button" className="secondary-button" disabled={currentPage === totalPages || loading} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next</button>
      </div>
    </section>
  );
}
