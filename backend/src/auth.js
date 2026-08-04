const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');
const { loadUsers, saveUsers } = require('./dataStore');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'local-dev-secret';

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

module.exports = {
  JWT_SECRET,
  createToken,
  authMiddleware,
  requireRole,
  userCanAccessSite,
  seedUsers
};
