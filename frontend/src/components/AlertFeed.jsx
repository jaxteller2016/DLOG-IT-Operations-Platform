import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';

const PAGE_SIZE = 8;

export default function AlertFeed() {
  const { fetchAlertsView, showToast } = useApp();
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [tableLoading, setTableLoading] = useState(false);
  const [tableAlerts, setTableAlerts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 });

  const loadAlertsPage = useCallback(async () => {
    setTableLoading(true);
    try {
      const data = await fetchAlertsView({
        page,
        pageSize: PAGE_SIZE,
        search,
        state: stateFilter
      });

      if (data.pagination) {
        setTableAlerts(data.alerts || []);
        setPagination(data.pagination);
      } else {
        const allAlerts = data.alerts || [];
        const query = search.trim().toLowerCase();
        const filteredAlerts = allAlerts.filter((alert) => {
          const matchesQuery = !query
            || alert.type.toLowerCase().includes(query)
            || alert.message.toLowerCase().includes(query)
            || alert.assetId.toLowerCase().includes(query);
          const isResolved = Boolean(alert.resolvedAt);
          const matchesState = stateFilter === 'all' || (stateFilter === 'active' && !isResolved) || (stateFilter === 'resolved' && isResolved);
          return matchesQuery && matchesState;
        });

        const total = filteredAlerts.length;
        const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
        const safePage = Math.min(page, totalPages);
        const start = (safePage - 1) * PAGE_SIZE;
        setTableAlerts(filteredAlerts.slice(start, start + PAGE_SIZE));
        setPagination({ page: safePage, pageSize: PAGE_SIZE, total, totalPages });
      }
    } catch (error) {
      showToast(error.message || 'Unable to load alerts', 'error');
    } finally {
      setTableLoading(false);
    }
  }, [fetchAlertsView, page, search, showToast, stateFilter]);

  useEffect(() => {
    loadAlertsPage();
  }, [loadAlertsPage]);

  const currentPage = pagination.page || 1;
  const totalPages = pagination.totalPages || 1;

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
            {tableLoading ? (
              <tr>
                <td colSpan={6} className="empty-cell">Loading alerts...</td>
              </tr>
            ) : tableAlerts.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty-cell">No alerts match your filter.</td>
              </tr>
            ) : tableAlerts.map((alert) => (
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
        <button type="button" className="secondary-button" disabled={currentPage === 1 || tableLoading} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
        <span>Page {currentPage} of {totalPages}</span>
        <button type="button" className="secondary-button" disabled={currentPage === totalPages || tableLoading} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next</button>
      </div>
    </section>
  );
}
