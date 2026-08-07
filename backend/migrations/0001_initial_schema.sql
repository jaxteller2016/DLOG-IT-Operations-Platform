CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL,
  site_id TEXT,
  json_data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL UNIQUE,
  serial_number TEXT NOT NULL UNIQUE,
  site_id TEXT NOT NULL,
  status TEXT,
  json_data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY,
  incident_number TEXT NOT NULL UNIQUE,
  site_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  status TEXT NOT NULL,
  priority TEXT NOT NULL,
  json_data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL,
  type TEXT NOT NULL,
  resolved_at TEXT,
  created_at TEXT,
  json_data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS monitoring_results (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  ip_address TEXT,
  cpu_usage REAL,
  memory_usage REAL,
  disk_free_percent REAL,
  backup_status TEXT,
  raw_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  actor TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  action TEXT NOT NULL,
  previous_value TEXT,
  new_value TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assets_site_id ON assets(site_id);
CREATE INDEX IF NOT EXISTS idx_incidents_site_id ON incidents(site_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_alerts_asset_id ON alerts(asset_id);
CREATE INDEX IF NOT EXISTS idx_alerts_type_resolved ON alerts(type, resolved_at);
CREATE INDEX IF NOT EXISTS idx_monitoring_asset_ts ON monitoring_results(asset_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_entity_ts ON audit_logs(entity, created_at);
