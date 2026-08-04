const fs = require('fs');
const path = require('path');
const { db, DB_FILE } = require('./db');
const { runMigrations } = require('./migrate');

const DATA_DIR = path.resolve(__dirname, '../data');
const DATA_FILE = path.join(DATA_DIR, 'users.json');
const ASSETS_FILE = path.join(DATA_DIR, 'assets.json');
const INCIDENTS_FILE = path.join(DATA_DIR, 'incidents.json');
const ALERTS_FILE = path.join(DATA_DIR, 'alerts.json');

runMigrations(db);

function ensureDataFile(filePath, initialValue) {
  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(initialValue, null, 2));
  }
}

function parseRows(rows) {
  return rows.map((row) => JSON.parse(row.json_data));
}

function parseRow(row) {
  return row ? JSON.parse(row.json_data) : null;
}

function syncUsers(users) {
  const tx = db.transaction((entries) => {
    db.prepare('DELETE FROM users').run();
    const insert = db.prepare('INSERT INTO users (id, email, password, role, site_id, json_data) VALUES (?, ?, ?, ?, ?, ?)');
    entries.forEach((user) => {
      insert.run(user.id, user.email, user.password, user.role, user.siteId || null, JSON.stringify(user));
    });
  });
  tx(users);
}

function syncAssets(assets) {
  const tx = db.transaction((entries) => {
    db.prepare('DELETE FROM assets').run();
    const insert = db.prepare('INSERT INTO assets (id, asset_id, serial_number, site_id, status, json_data) VALUES (?, ?, ?, ?, ?, ?)');
    entries.forEach((asset) => {
      insert.run(asset.id, asset.assetId, asset.serialNumber, asset.siteId, asset.status || null, JSON.stringify(asset));
    });
  });
  tx(assets);
}

function syncIncidents(incidents) {
  const tx = db.transaction((entries) => {
    db.prepare('DELETE FROM incidents').run();
    const insert = db.prepare('INSERT INTO incidents (id, incident_number, site_id, asset_id, status, priority, json_data) VALUES (?, ?, ?, ?, ?, ?, ?)');
    entries.forEach((incident) => {
      insert.run(incident.id, incident.incidentNumber, incident.siteId, incident.assetId, incident.status, incident.priority, JSON.stringify(incident));
    });
  });
  tx(incidents);
}

function syncAlerts(alerts) {
  const tx = db.transaction((entries) => {
    db.prepare('DELETE FROM alerts').run();
    const insert = db.prepare('INSERT INTO alerts (id, asset_id, type, resolved_at, created_at, json_data) VALUES (?, ?, ?, ?, ?, ?)');
    entries.forEach((alert) => {
      insert.run(alert.id, alert.assetId, alert.type, alert.resolvedAt || null, alert.createdAt || null, JSON.stringify(alert));
    });
  });
  tx(alerts);
}

function bootstrapFromJson(filePath, key, loadFn) {
  ensureDataFile(filePath, { [key]: [] });
  const row = db.prepare(`SELECT COUNT(1) AS count FROM ${key}`).get();
  if (row.count > 0) return;

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const items = parsed[key] || [];
  if (items.length > 0) {
    loadFn(items);
  }
}

bootstrapFromJson(DATA_FILE, 'users', syncUsers);
bootstrapFromJson(ASSETS_FILE, 'assets', syncAssets);
bootstrapFromJson(INCIDENTS_FILE, 'incidents', syncIncidents);
bootstrapFromJson(ALERTS_FILE, 'alerts', syncAlerts);

function bootstrapAuditLogs() {
  const countRow = db.prepare('SELECT COUNT(1) AS count FROM audit_logs').get();
  if (countRow.count > 0) return;

  const now = new Date().toISOString();
  const insert = db.prepare(`
    INSERT INTO audit_logs (source, actor, entity, entity_id, action, previous_value, new_value, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    const assets = loadAssets();
    assets.forEach((asset) => {
      insert.run('system', 'migration-bootstrap', 'asset', asset.id, 'import', null, JSON.stringify(asset), now);
    });

    const incidents = loadIncidents();
    incidents.forEach((incident) => {
      insert.run('system', 'migration-bootstrap', 'incident', incident.id, 'import', null, JSON.stringify(incident), now);
    });

    const alerts = loadAlerts();
    alerts.forEach((alert) => {
      insert.run('system', 'migration-bootstrap', 'alert', alert.id, 'import', null, JSON.stringify(alert), now);
    });
  });

  tx();
}

bootstrapAuditLogs();

function loadUsers() {
  return parseRows(db.prepare('SELECT json_data FROM users ORDER BY rowid ASC').all());
}

function saveUsers(users) {
  syncUsers(users);
}

function loadAssets() {
  return parseRows(db.prepare('SELECT json_data FROM assets ORDER BY rowid ASC').all());
}

function saveAssets(assets) {
  syncAssets(assets);
}

function loadIncidents() {
  return parseRows(db.prepare('SELECT json_data FROM incidents ORDER BY rowid ASC').all());
}

function saveIncidents(incidents) {
  syncIncidents(incidents);
}

function loadAlerts() {
  return parseRows(db.prepare('SELECT json_data FROM alerts ORDER BY rowid ASC').all());
}

function saveAlerts(alerts) {
  syncAlerts(alerts);
}

function findAssetByAssetId(assetId) {
  const row = db.prepare('SELECT json_data FROM assets WHERE asset_id = ?').get(assetId);
  return parseRow(row);
}

function findAssetById(id) {
  const row = db.prepare('SELECT json_data FROM assets WHERE id = ?').get(id);
  return parseRow(row);
}

function upsertAsset(asset) {
  db.prepare(`
    INSERT INTO assets (id, asset_id, serial_number, site_id, status, json_data)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      asset_id = excluded.asset_id,
      serial_number = excluded.serial_number,
      site_id = excluded.site_id,
      status = excluded.status,
      json_data = excluded.json_data
  `).run(asset.id, asset.assetId, asset.serialNumber, asset.siteId, asset.status || null, JSON.stringify(asset));
}

function findIncidentById(id) {
  const row = db.prepare('SELECT json_data FROM incidents WHERE id = ?').get(id);
  return parseRow(row);
}

function findIncidentByNumber(incidentNumber) {
  const row = db.prepare('SELECT json_data FROM incidents WHERE incident_number = ?').get(incidentNumber);
  return parseRow(row);
}

function upsertIncident(incident) {
  db.prepare(`
    INSERT INTO incidents (id, incident_number, site_id, asset_id, status, priority, json_data)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      incident_number = excluded.incident_number,
      site_id = excluded.site_id,
      asset_id = excluded.asset_id,
      status = excluded.status,
      priority = excluded.priority,
      json_data = excluded.json_data
  `).run(
    incident.id,
    incident.incidentNumber,
    incident.siteId,
    incident.assetId,
    incident.status,
    incident.priority,
    JSON.stringify(incident)
  );
}

function findOpenAlertByType(assetId, type) {
  const row = db.prepare('SELECT json_data FROM alerts WHERE asset_id = ? AND type = ? AND resolved_at IS NULL ORDER BY rowid DESC LIMIT 1').get(assetId, type);
  return parseRow(row);
}

function upsertAlert(alert) {
  db.prepare(`
    INSERT INTO alerts (id, asset_id, type, resolved_at, created_at, json_data)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      asset_id = excluded.asset_id,
      type = excluded.type,
      resolved_at = excluded.resolved_at,
      created_at = excluded.created_at,
      json_data = excluded.json_data
  `).run(alert.id, alert.assetId, alert.type, alert.resolvedAt || null, alert.createdAt || null, JSON.stringify(alert));
}

function saveMonitoringResult(result) {
  const id = result.id || `mon-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  db.prepare(`
    INSERT INTO monitoring_results (id, asset_id, timestamp, ip_address, cpu_usage, memory_usage, disk_free_percent, backup_status, raw_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    result.assetId,
    result.timestamp,
    result.ipAddress || null,
    result.cpuUsage ?? null,
    result.memoryUsage ?? null,
    result.diskFreePercent ?? null,
    result.backupStatus || null,
    JSON.stringify({ ...result, id })
  );

  return id;
}

function loadMonitoringResults() {
  const rows = db.prepare('SELECT raw_json FROM monitoring_results ORDER BY timestamp DESC').all();
  return rows.map((row) => JSON.parse(row.raw_json));
}

function logAuditEvent(event) {
  db.prepare(`
    INSERT INTO audit_logs (source, actor, entity, entity_id, action, previous_value, new_value, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    event.source || 'user',
    event.actor || 'unknown',
    event.entity,
    event.entityId || null,
    event.action,
    event.previousValue === undefined ? null : JSON.stringify(event.previousValue),
    event.newValue === undefined ? null : JSON.stringify(event.newValue),
    event.createdAt || new Date().toISOString()
  );
}

function loadAuditLogs(limit = 100) {
  const rows = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?').all(limit);
  return rows.map((row) => ({
    id: row.id,
    source: row.source,
    actor: row.actor,
    entity: row.entity,
    entityId: row.entity_id,
    action: row.action,
    previousValue: row.previous_value ? JSON.parse(row.previous_value) : null,
    newValue: row.new_value ? JSON.parse(row.new_value) : null,
    createdAt: row.created_at
  }));
}

module.exports = {
  DB_FILE,
  DATA_FILE,
  ASSETS_FILE,
  INCIDENTS_FILE,
  ALERTS_FILE,
  ensureDataFile,
  loadUsers,
  saveUsers,
  loadAssets,
  saveAssets,
  loadIncidents,
  saveIncidents,
  loadAlerts,
  saveAlerts,
  findAssetByAssetId,
  findAssetById,
  upsertAsset,
  findIncidentById,
  findIncidentByNumber,
  upsertIncident,
  findOpenAlertByType,
  upsertAlert,
  saveMonitoringResult,
  loadMonitoringResults,
  logAuditEvent,
  loadAuditLogs
};
