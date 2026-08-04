const express = require('express');
const { authMiddleware, requireRole } = require('../auth');
const { loadAuditLogs } = require('../dataStore');

const router = express.Router();

router.get('/', authMiddleware, requireRole('Administrator'), (req, res) => {
  const limitParam = Number.parseInt(req.query.limit, 10);
  const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(500, limitParam)) : 100;
  const entries = loadAuditLogs(limit);
  return res.json({ entries });
});

module.exports = router;
