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
const JWT_SECRET = process.env.JWT_SECRET || 'local-dev-secret';
const DATA_FILE = path.resolve(__dirname, '../data/users.json');

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());

function ensureDataFile() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify({ users: [] }, null, 2));
  }
}

function loadUsers() {
  ensureDataFile();
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')).users || [];
}

function saveUsers(users) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify({ users }, null, 2));
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

app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});

module.exports = { app, authMiddleware, requireRole, seedUsers, createToken, loadUsers, saveUsers };
