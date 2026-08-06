import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatDateTime } from '../utils/dateTime';

const cardClass = 'rounded-2xl border border-slate-700/70 bg-slate-900/75 p-5 shadow-[0_20px_45px_rgba(2,6,23,0.45)] backdrop-blur-sm';
const headingRowClass = 'mb-3 flex flex-wrap items-center justify-between gap-3';
const secondaryButtonClass = 'rounded-xl border border-slate-600 bg-slate-800/90 px-3.5 py-2 text-sm font-medium text-slate-100 transition hover:border-emerald-400 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-60';
const fieldClass = 'w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30';
const filtersClass = 'mb-3 grid gap-2 md:grid-cols-2';
const tableWrapClass = 'w-full overflow-x-auto';
const tableClass = 'w-max min-w-full table-auto border-separate border-spacing-0 text-left';
const thClass = 'whitespace-nowrap border-b border-slate-700/70 bg-slate-900/85 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-300';
const tdClass = 'whitespace-nowrap border-b border-slate-800/80 px-3 py-2 text-[12px] text-slate-100';
const emptyCellClass = 'px-3 py-8 text-center text-sm text-slate-400';

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
    <section className={cardClass}>
      <div className={headingRowClass}>
        <h2 className="text-xl font-semibold text-slate-50">Audit log</h2>
        <button type="button" className={secondaryButtonClass} onClick={loadAuditLogs} disabled={loading}>Refresh</button>
      </div>

      {loadError ? <p className="mb-3 text-sm font-medium text-rose-300">{loadError}</p> : null}

      <div className={filtersClass}>
        <input
          className={fieldClass}
          placeholder="Search actor, entity, action, id"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <select
          className={fieldClass}
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

      <div className={tableWrapClass}>
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>Timestamp</th>
              <th className={thClass}>Actor</th>
              <th className={thClass}>Source</th>
              <th className={thClass}>Entity</th>
              <th className={thClass}>Action</th>
              <th className={thClass}>Entity ID</th>
            </tr>
          </thead>
          <tbody>
            {loading && paginatedEntries.length === 0 ? (
              <tr>
                <td colSpan={6} className={emptyCellClass}>Loading audit logs...</td>
              </tr>
            ) : paginatedEntries.length === 0 ? (
              <tr>
                <td colSpan={6} className={emptyCellClass}>No audit entries match your filter.</td>
              </tr>
            ) : paginatedEntries.map((entry) => (
              <tr key={entry.id}>
                <td className={tdClass}>{formatDateTime(entry.createdAt)}</td>
                <td className={tdClass}>{entry.actor}</td>
                <td className={tdClass}>{entry.source}</td>
                <td className={tdClass}>{entry.entity}</td>
                <td className={tdClass}>{entry.action}</td>
                <td className={tdClass}>{entry.entityId || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-sm text-slate-300">
        <button type="button" className={secondaryButtonClass} disabled={currentPage === 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
        <span>Page {currentPage} of {totalPages}</span>
        <button type="button" className={secondaryButtonClass} disabled={currentPage === totalPages || loading} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next</button>
      </div>
    </section>
  );
}
