const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';
const JWT_SECRET = process.env.JWT_SECRET || 'local-dev-secret';
const DATA_FILE = path.resolve(__dirname, '../data/users.json');
const ASSETS_FILE = path.resolve(__dirname, '../data/assets.json');
const INCIDENTS_FILE = path.resolve(__dirname, '../data/incidents.json');
const ALERTS_FILE = path.resolve(__dirname, '../data/alerts.json');

const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json());

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

function createToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role, siteId: user.siteId }, JWT_SECRET, { expiresIn: '8h' });
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

function userCanAccessSite(user, siteId) {
  if (!siteId) return true;
  if (user.role === 'Administrator' || user.role === 'Management Viewer') return true;
  if (user.role === 'Site Manager') return user.siteId === siteId;
  if (user.role === 'IT Technician') return true;
  return false;
}

function calculateSlaStatus(responseDeadline, resolutionDeadline) {
  const now = new Date();
  const responseDue = new Date(responseDeadline);
  const resolutionDue = new Date(resolutionDeadline);

  if (responseDue < now || resolutionDue < now) return 'breach';
  return 'within';
}

function seedUsers() {
  const users = loadUsers();
  if (users.length > 0) return users;

  const initialUsers = [
    { id: 'user-admin', email: 'admin@example.com', password: bcrypt.hashSync('Admin123!', 10), role: 'Administrator', siteId: 'site-bucharest' },
    { id: 'user-tech', email: 'tech@example.com', password: bcrypt.hashSync('Tech123!', 10), role: 'IT Technician', siteId: 'site-bucharest' },
    { id: 'user-manager', email: 'manager@example.com', password: bcrypt.hashSync('Manager123!', 10), role: 'Site Manager', siteId: 'site-ploiesti' },
    { id: 'user-viewer', email: 'viewer@example.com', password: bcrypt.hashSync('Viewer123!', 10), role: 'Management Viewer', siteId: null }
  ];

  saveUsers(initialUsers);
  return initialUsers;
}

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.post('/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const users = seedUsers();
  const user = users.find((entry) => entry.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = createToken(user);
  return res.json({ token, user: { id: user.id, email: user.email, role: user.role, siteId: user.siteId } });
});

app.get('/auth/me', authMiddleware, (req, res) => {
  const users = seedUsers();
  const user = users.find((entry) => entry.id === req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  return res.json({ user: { id: user.id, email: user.email, role: user.role, siteId: user.siteId } });
});

app.get('/auth/roles', authMiddleware, requireRole('Administrator'), (req, res) => {
  return res.json({ roles: ['Administrator', 'IT Technician', 'Site Manager', 'Management Viewer'] });
});

app.get('/auth/seeded-users', authMiddleware, requireRole('Administrator'), (req, res) => {
  const users = seedUsers();
  return res.json({ users: users.map(({ id, email, role, siteId }) => ({ id, email, role, siteId })) });
});

app.get('/assets', authMiddleware, (req, res) => {
  const users = seedUsers();
  const currentUser = users.find((entry) => entry.id === req.user.id);
  const assets = loadAssets().filter((asset) => userCanAccessSite(currentUser, asset.siteId));
  return res.json({ assets });
});

app.post('/assets', authMiddleware, requireRole('Administrator', 'IT Technician'), (req, res) => {
  const { assetId, serialNumber, category, manufacturer, model, siteId, assignedEmployee, ipAddress, macAddress, operatingSystem, purchaseDate, warrantyExpirationDate, status, notes } = req.body || {};

  if (!assetId || !serialNumber || !category || !siteId) {
    return res.status(400).json({ error: 'assetId, serialNumber, category, and siteId are required' });
  }

  const assets = loadAssets();
  const duplicateAsset = assets.find((asset) => asset.assetId === assetId || asset.serialNumber === serialNumber);
  if (duplicateAsset) {
    return res.status(409).json({ error: 'Duplicate asset ID or serial number' });
  }

  const asset = {
    id: `asset-${Date.now()}`,
    assetId,
    serialNumber,
    category,
    manufacturer: manufacturer || '',
    model: model || '',
    siteId,
    assignedEmployee: assignedEmployee || '',
    ipAddress: ipAddress || '',
    macAddress: macAddress || '',
    operatingSystem: operatingSystem || '',
    purchaseDate: purchaseDate || '',
    warrantyExpirationDate: warrantyExpirationDate || '',
    status: status || 'Unknown',
    notes: notes || '',
    lastOnlineTimestamp: null
  };

  assets.push(asset);
  saveAssets(assets);
  return res.status(201).json({ asset });
});

app.get('/incidents', authMiddleware, (req, res) => {
  const users = seedUsers();
  const currentUser = users.find((entry) => entry.id === req.user.id);
  const incidents = loadIncidents().filter((incident) => userCanAccessSite(currentUser, incident.siteId));
  return res.json({ incidents });
});

app.post('/incidents', authMiddleware, requireRole('Administrator', 'IT Technician', 'Site Manager'), (req, res) => {
  const { incidentNumber, siteId, assetId, priority, category, description, assignedTechnician, status, responseDeadline, resolutionDeadline, resolutionNotes } = req.body || {};

  if (!incidentNumber || !siteId || !assetId || !priority || !category || !description) {
    return res.status(400).json({ error: 'incidentNumber, siteId, assetId, priority, category, and description are required' });
  }

  const incidents = loadIncidents();
  const duplicateIncident = incidents.find((incident) => incident.incidentNumber === incidentNumber);
  if (duplicateIncident) {
    return res.status(409).json({ error: 'Duplicate incident number' });
  }

  const incident = {
    id: `incident-${Date.now()}`,
    incidentNumber,
    siteId,
    assetId,
    priority,
    category,
    description,
    assignedTechnician: assignedTechnician || '',
    status: status || 'Open',
    createdAt: new Date().toISOString(),
    responseDeadline: responseDeadline || new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    resolutionDeadline: resolutionDeadline || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    resolutionNotes: resolutionNotes || '',
    slaStatus: calculateSlaStatus(responseDeadline || new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), resolutionDeadline || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())
  };

  incidents.push(incident);
  saveIncidents(incidents);
  return res.status(201).json({ incident });
});

app.post('/monitoring/heartbeat', authMiddleware, requireRole('Administrator', 'IT Technician'), (req, res) => {
  const { assetId, timestamp, ipAddress, cpuUsage, memoryUsage, diskFreePercent, backupStatus } = req.body || {};

  if (!assetId || !timestamp) {
    return res.status(400).json({ error: 'assetId and timestamp are required' });
  }

  const assets = loadAssets();
  const asset = assets.find((entry) => entry.assetId === assetId);
  if (!asset) {
    return res.status(404).json({ error: 'Asset not found' });
  }

  asset.lastOnlineTimestamp = timestamp;
  asset.ipAddress = ipAddress || asset.ipAddress;
  asset.status = 'Online';
  saveAssets(assets);

  const alerts = loadAlerts();
  const newAlerts = [];

  if (diskFreePercent !== undefined && diskFreePercent < 15) {
    const existingAlert = alerts.find((alert) => alert.assetId === assetId && alert.type === 'low-disk-space' && alert.resolvedAt === null);
    if (!existingAlert) {
      newAlerts.push({ id: `alert-${Date.now()}-disk`, assetId, type: 'low-disk-space', message: 'Low disk space detected', severity: 'high', createdAt: timestamp, resolvedAt: null });
    }
  }

  if (backupStatus === 'failed') {
    const existingAlert = alerts.find((alert) => alert.assetId === assetId && alert.type === 'backup-failed' && alert.resolvedAt === null);
    if (!existingAlert) {
      newAlerts.push({ id: `alert-${Date.now()}-backup`, assetId, type: 'backup-failed', message: 'Backup failed', severity: 'high', createdAt: timestamp, resolvedAt: null });
    }
  }

  if (newAlerts.length > 0) {
    alerts.push(...newAlerts);
    saveAlerts(alerts);
  }

  return res.status(201).json({ asset, alerts: newAlerts });
});

app.get('/alerts', authMiddleware, (req, res) => {
  const users = seedUsers();
  const currentUser = users.find((entry) => entry.id === req.user.id);
  const alerts = loadAlerts().filter((alert) => {
    const asset = loadAssets().find((entry) => entry.assetId === alert.assetId);
    if (!asset) return false;
    return userCanAccessSite(currentUser, asset.siteId);
  });
  return res.json({ alerts });
});

if (require.main === module) {
  app.listen(PORT, HOST, () => {
    console.log(`Backend listening on ${HOST}:${PORT}`);
  });
}

module.exports = { app, authMiddleware, requireRole, seedUsers, createToken, loadUsers, saveUsers };
