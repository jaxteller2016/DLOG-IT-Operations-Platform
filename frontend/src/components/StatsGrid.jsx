import React from 'react';
import { useApp } from '../context/AppContext';

export default function StatsGrid() {
  const { assets, incidents, alerts } = useApp();

  return (
    <section className="stats-grid">
      <article className="card stat-card">
        <p>Assets tracked</p>
        <strong>{assets.length}</strong>
      </article>
      <article className="card stat-card">
        <p>Open incidents</p>
        <strong>{incidents.filter((incident) => incident.status === 'Open').length}</strong>
      </article>
      <article className="card stat-card">
        <p>Active alerts</p>
        <strong>{alerts.filter((alert) => alert.resolvedAt === null).length}</strong>
      </article>
    </section>
  );
}
