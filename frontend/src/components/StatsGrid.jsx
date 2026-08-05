import React from 'react';
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { useApp } from '../context/AppContext';

const ASSET_STATUS_COLORS = ['#4cc9f0', '#ff6b6b'];
const INCIDENT_PRIORITY_COLORS = ['#ff6b6b', '#f7b267', '#7bd389'];
const SLA_COLORS = ['#4cc9f0', '#ff8a65'];

function titleCase(value) {
  if (!value) return 'Unknown';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function StatsGrid() {
  const { assets, incidents, alerts } = useApp();
  const totalAssets = assets.length;
  const onlineAssets = assets.filter((asset) => asset.status === 'Online').length;
  const offlineAssets = Math.max(totalAssets - onlineAssets, 0);
  const openIncidents = incidents.filter((incident) => incident.status === 'Open');
  const activeAlerts = alerts.filter((alert) => alert.resolvedAt === null);

  const onlinePercent = totalAssets > 0 ? Number(((onlineAssets / totalAssets) * 100).toFixed(1)) : 0;
  const offlinePercent = totalAssets > 0 ? Number(((offlineAssets / totalAssets) * 100).toFixed(1)) : 0;

  const assetAvailabilityData = [
    { name: 'Online', value: onlinePercent, count: onlineAssets },
    { name: 'Offline', value: offlinePercent, count: offlineAssets }
  ];

  const openIncidentPriorityData = ['High', 'Medium', 'Low'].map((priority) => ({
    name: priority,
    value: openIncidents.filter((incident) => incident.priority === priority).length
  }));

  const slaData = ['within', 'breach'].map((status) => ({
    name: titleCase(status),
    value: incidents.filter((incident) => (incident.slaStatus || '').toLowerCase() === status).length
  }));

  return (
    <>
      <section className="stats-grid">
        <article className="card stat-card">
          <p>Assets tracked</p>
          <strong>{assets.length}</strong>
        </article>
        <article className="card stat-card">
          <p>Open incidents</p>
          <strong>{openIncidents.length}</strong>
        </article>
        <article className="card stat-card">
          <p>Active alerts</p>
          <strong>{activeAlerts.length}</strong>
        </article>
      </section>

      <section className="chart-grid">
        <article className="card chart-card">
          <div className="section-title compact-title">
            <h2>Asset availability</h2>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={assetAvailabilityData}>
                <XAxis dataKey="name" stroke="#c4daff" />
                <YAxis domain={[0, 100]} tickCount={6} stroke="#94a9c1" unit="%" />
                <Tooltip
                  formatter={(value, name, props) => [`${value}% (${props.payload.count})`, name]}
                  contentStyle={{ background: '#0d1c2f', border: '1px solid #27415f', borderRadius: 12 }}
                  itemStyle={{ color: '#ffffff' }}
                  labelStyle={{ color: '#ffffff' }}
                />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {assetAvailabilityData.map((entry, index) => (
                    <Cell key={entry.name} fill={ASSET_STATUS_COLORS[index % ASSET_STATUS_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="card chart-card">
          <div className="section-title compact-title">
            <h2>Open incidents by priority</h2>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={openIncidentPriorityData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={54}
                  outerRadius={88}
                  paddingAngle={3}
                >
                  {openIncidentPriorityData.map((entry, index) => (
                    <Cell key={entry.name} fill={INCIDENT_PRIORITY_COLORS[index % INCIDENT_PRIORITY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#0d1c2f', border: '1px solid #27415f', borderRadius: 12 }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="card chart-card">
          <div className="section-title compact-title">
            <h2>Incidents by SLA</h2>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={slaData}>
                <XAxis dataKey="name" stroke="#c4daff" />
                <YAxis allowDecimals={false} stroke="#94a9c1" />
                <Tooltip
                  contentStyle={{ background: '#0d1c2f', border: '1px solid #27415f', borderRadius: 12 }}
                  itemStyle={{ color: '#ffffff' }}
                  labelStyle={{ color: '#ffffff' }}
                />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {slaData.map((entry, index) => (
                    <Cell key={entry.name} fill={SLA_COLORS[index % SLA_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>
    </>
  );
}
