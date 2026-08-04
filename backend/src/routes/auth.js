const express = require('express');
const bcrypt = require('bcryptjs');
const { authMiddleware, requireRole, seedUsers, createToken } = require('../auth');

const router = express.Router();

router.post('/login', (req, res) => {
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

router.get('/me', authMiddleware, (req, res) => {
  const users = seedUsers();
  const user = users.find((entry) => entry.id === req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  return res.json({ user: { id: user.id, email: user.email, role: user.role, siteId: user.siteId } });
});

router.get('/roles', authMiddleware, requireRole('Administrator'), (req, res) => {
  return res.json({ roles: ['Administrator', 'IT Technician', 'Site Manager', 'Management Viewer'] });
});

router.get('/seeded-users', authMiddleware, requireRole('Administrator'), (req, res) => {
  const users = seedUsers();
  return res.json({ users: users.map(({ id, email, role, siteId }) => ({ id, email, role, siteId })) });
});

module.exports = router;
