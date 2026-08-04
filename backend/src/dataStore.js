const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '../data');
const DATA_FILE = path.join(DATA_DIR, 'users.json');
const ASSETS_FILE = path.join(DATA_DIR, 'assets.json');
const INCIDENTS_FILE = path.join(DATA_DIR, 'incidents.json');
const ALERTS_FILE = path.join(DATA_DIR, 'alerts.json');

function ensureDataFile(filePath, initialValue) {
  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(initialValue, null, 2));
  }
}

function loadUsers() {
  ensureDataFile(DATA_FILE, { users: [] });
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')).users || [];
}

function saveUsers(users) {
  ensureDataFile(DATA_FILE, { users: [] });
  fs.writeFileSync(DATA_FILE, JSON.stringify({ users }, null, 2));
}

function loadAssets() {
  ensureDataFile(ASSETS_FILE, { assets: [] });
  return JSON.parse(fs.readFileSync(ASSETS_FILE, 'utf8')).assets || [];
}

function saveAssets(assets) {
  ensureDataFile(ASSETS_FILE, { assets: [] });
  fs.writeFileSync(ASSETS_FILE, JSON.stringify({ assets }, null, 2));
}

function loadIncidents() {
  ensureDataFile(INCIDENTS_FILE, { incidents: [] });
  return JSON.parse(fs.readFileSync(INCIDENTS_FILE, 'utf8')).incidents || [];
}

function saveIncidents(incidents) {
  ensureDataFile(INCIDENTS_FILE, { incidents: [] });
  fs.writeFileSync(INCIDENTS_FILE, JSON.stringify({ incidents }, null, 2));
}

function loadAlerts() {
  ensureDataFile(ALERTS_FILE, { alerts: [] });
  return JSON.parse(fs.readFileSync(ALERTS_FILE, 'utf8')).alerts || [];
}

function saveAlerts(alerts) {
  ensureDataFile(ALERTS_FILE, { alerts: [] });
  fs.writeFileSync(ALERTS_FILE, JSON.stringify({ alerts }, null, 2));
}

module.exports = {
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
  saveAlerts
};
