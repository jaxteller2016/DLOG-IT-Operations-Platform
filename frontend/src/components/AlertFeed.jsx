import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatDateTime } from '../utils/dateTime';

const cardClass = 'rounded-2xl border border-slate-700/70 bg-slate-900/75 p-5 shadow-[0_20px_45px_rgba(2,6,23,0.45)] backdrop-blur-sm';
const headingRowClass = 'mb-3 flex flex-wrap items-center justify-between gap-3';
const secondaryButtonClass = 'rounded-xl border border-slate-600 bg-slate-800/90 px-3.5 py-2 text-sm font-medium text-slate-100 transition hover:border-emerald-400 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-60';
const fieldClass = 'w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30';
const filtersClass = 'mb-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3';
const tableWrapClass = 'w-full overflow-x-auto';
const tableClass = 'w-max min-w-full table-auto border-separate border-spacing-0 text-left';
const thClass = 'whitespace-nowrap border-b border-slate-700/70 bg-slate-900/85 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-300';
const tdClass = 'whitespace-nowrap border-b border-slate-800/80 px-3 py-2 text-[12px] text-slate-100';
const emptyCellClass = 'px-3 py-8 text-center text-sm text-slate-400';

function sortAlertsNewestFirst(alerts) {
  return [...alerts].sort((left, right) => {
    const leftTime = left.createdAt ? Date.parse(left.createdAt) : 0;
    const rightTime = right.createdAt ? Date.parse(right.createdAt) : 0;
    return rightTime - leftTime;
  });
}

export default function AlertFeed() {
  const { fetchAlertsView, showToast, resultsPerPage, alertsRefreshVersion } = useApp();
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [tableLoading, setTableLoading] = useState(false);
  const [tableAlerts, setTableAlerts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: resultsPerPage, total: 0, totalPages: 1 });

  const loadAlertsPage = useCallback(async () => {
    setTableLoading(true);
    try {
      const data = await fetchAlertsView({
        page,
        pageSize: resultsPerPage,
        search,
        state: stateFilter,
        type: typeFilter
      });

      if (data.pagination) {
        setTableAlerts(sortAlertsNewestFirst(data.alerts || []));
        setPagination(data.pagination);
      } else {
        const allAlerts = sortAlertsNewestFirst(data.alerts || []);
        const query = search.trim().toLowerCase();
        const filteredAlerts = allAlerts.filter((alert) => {
          const matchesQuery = !query
            || alert.type.toLowerCase().includes(query)
            || alert.message.toLowerCase().includes(query)
            || alert.assetId.toLowerCase().includes(query);
          const isResolved = Boolean(alert.resolvedAt);
          const matchesState = stateFilter === 'all' || (stateFilter === 'active' && !isResolved) || (stateFilter === 'resolved' && isResolved);
          const matchesType = typeFilter === 'all' || alert.type === typeFilter;
          return matchesQuery && matchesState && matchesType;
        });

        const total = filteredAlerts.length;
        const totalPages = Math.max(1, Math.ceil(total / resultsPerPage));
        const safePage = Math.min(page, totalPages);
        const start = (safePage - 1) * resultsPerPage;
        setTableAlerts(filteredAlerts.slice(start, start + resultsPerPage));
        setPagination({ page: safePage, pageSize: resultsPerPage, total, totalPages });
      }
    } catch (error) {
      showToast(error.message || 'Unable to load alerts', 'error');
    } finally {
      setTableLoading(false);
    }
  }, [alertsRefreshVersion, fetchAlertsView, page, resultsPerPage, search, showToast, stateFilter, typeFilter]);

  useEffect(() => {
    loadAlertsPage();
  }, [loadAlertsPage]);

  useEffect(() => {
    setPage(1);
  }, [resultsPerPage]);

  const currentPage = pagination.page || 1;
  const totalPages = pagination.totalPages || 1;

  return (
    <section className={cardClass}>
      <div className={headingRowClass}>
        <h2 className="text-xl font-semibold text-slate-50">Alert feed</h2>
      </div>

      <div className={filtersClass}>
        <input
          className={fieldClass}
          placeholder="Search type, message, asset"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <select
          className={fieldClass}
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
        <select
          className={fieldClass}
          value={typeFilter}
          onChange={(event) => {
            setTypeFilter(event.target.value);
            setPage(1);
          }}
        >
          <option value="all">All alert types</option>
          <option value="backup-failed">Failed backups</option>
          <option value="low-disk-space">Low disk space</option>
        </select>
      </div>

      <div className={tableWrapClass}>
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>Type</th>
              <th className={thClass}>Asset</th>
              <th className={thClass}>Message</th>
              <th className={thClass}>Severity</th>
              <th className={thClass}>Created</th>
              <th className={thClass}>State</th>
            </tr>
          </thead>
          <tbody>
            {tableLoading && tableAlerts.length === 0 ? (
              <tr>
                <td colSpan={6} className={emptyCellClass}>Loading alerts...</td>
              </tr>
            ) : tableAlerts.length === 0 ? (
              <tr>
                <td colSpan={6} className={emptyCellClass}>No alerts match your filter.</td>
              </tr>
            ) : tableAlerts.map((alert) => (
              <tr key={alert.id}>
                <td className={tdClass}>{alert.type}</td>
                <td className={tdClass}>{alert.assetId}</td>
                <td className={tdClass}>{alert.message}</td>
                <td className={tdClass}>{alert.severity || '-'}</td>
                <td className={tdClass}>{formatDateTime(alert.createdAt)}</td>
                <td className={tdClass}>{alert.resolvedAt ? 'Resolved' : 'Active'}</td>
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
    </section>
  );
}
