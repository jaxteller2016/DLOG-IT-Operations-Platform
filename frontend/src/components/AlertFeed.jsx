import React from 'react';
import { useApp } from '../context/AppContext';

export default function AlertFeed() {
  const { alerts } = useApp();

  return (
    <section className="card">
      <div className="section-title">
        <h2>Alert feed</h2>
      </div>
      <ul className="list">
        {alerts.map((alert) => (
          <li key={alert.id}>
            <div>
              <strong>{alert.type}</strong>
              <p>{alert.message}</p>
            </div>
            <span>{alert.resolvedAt ? 'Resolved' : 'Active'}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
