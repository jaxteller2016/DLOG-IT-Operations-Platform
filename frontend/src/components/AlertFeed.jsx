import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

const PAGE_SIZE = 8;

export default function AlertFeed() {
  const { alerts } = useApp();
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [page, setPage] = useState(1);

  const filteredAlerts = alerts.filter((alert) => {
    const query = search.trim().toLowerCase();
    const matchesQuery = !query
      || alert.type.toLowerCase().includes(query)
      || alert.message.toLowerCase().includes(query)
      || alert.assetId.toLowerCase().includes(query);
    const isResolved = Boolean(alert.resolvedAt);
    const matchesState = stateFilter === 'all' || (stateFilter === 'active' && !isResolved) || (stateFilter === 'resolved' && isResolved);
    return matchesQuery && matchesState;
  });

  const totalPages = Math.max(1, Math.ceil(filteredAlerts.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedAlerts = filteredAlerts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <section className="card">
      <div className="section-title">
        <h2>Alert feed</h2>
      </div>

      <div className="filters-bar">
        <input
          placeholder="Search type, message, asset"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <select
          value={stateFilter}
          onChange={(event) => {
            setStateFilter(event.target.value);
            setPage(1);
          }}
        >
          <option value="all">All alerts</option>
          <option value="active">Active only</option>
          <option value="resolved">Resolved only</option>
        </select>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Asset</th>
              <th>Message</th>
              <th>Severity</th>
              <th>Created</th>
              <th>State</th>
            </tr>
          </thead>
          <tbody>
            {paginatedAlerts.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty-cell">No alerts match your filter.</td>
              </tr>
            ) : paginatedAlerts.map((alert) => (
              <tr key={alert.id}>
                <td>{alert.type}</td>
                <td>{alert.assetId}</td>
                <td>{alert.message}</td>
                <td>{alert.severity || '-'}</td>
                <td>{alert.createdAt || '-'}</td>
                <td>{alert.resolvedAt ? 'Resolved' : 'Active'}</td>
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
    </section>
  );
}
