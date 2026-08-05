const express = require('express');
const { authMiddleware, userCanAccessSite, seedUsers } = require('../auth');
const { loadAlerts, loadAssets } = require('../dataStore');

const router = express.Router();

function parsePaging(query) {
  const shouldPaginate = query.paginate === 'true' || query.page !== undefined || query.pageSize !== undefined;
  if (!shouldPaginate) return null;

  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const pageSize = Math.max(1, Math.min(200, Number.parseInt(query.pageSize, 10) || 20));
  return { page, pageSize };
}

router.get('/', authMiddleware, (req, res) => {
  const users = seedUsers();
  const currentUser = users.find((entry) => entry.id === req.user.id);
  const search = (req.query.search || '').toString().trim().toLowerCase();
  const state = (req.query.state || '').toString().trim().toLowerCase();
  const type = (req.query.type || '').toString().trim();
  const assetId = (req.query.assetId || '').toString().trim();

  const filteredAlerts = loadAlerts().filter((alert) => {
    const asset = loadAssets().find((entry) => entry.assetId === alert.assetId);
    if (!asset) return false;
    if (!userCanAccessSite(currentUser, asset.siteId)) return false;
    if (type && alert.type !== type) return false;
    if (assetId && alert.assetId !== assetId) return false;
    if (state === 'active' && alert.resolvedAt) return false;
    if (state === 'resolved' && !alert.resolvedAt) return false;
    if (!search) return true;

    return alert.type.toLowerCase().includes(search)
      || alert.message.toLowerCase().includes(search)
      || alert.assetId.toLowerCase().includes(search);
  });

  const sortedAlerts = filteredAlerts.sort((left, right) => {
    const leftTime = left.createdAt ? Date.parse(left.createdAt) : 0;
    const rightTime = right.createdAt ? Date.parse(right.createdAt) : 0;
    return rightTime - leftTime;
  });

  const paging = parsePaging(req.query);
  if (!paging) {
    return res.json({ alerts: sortedAlerts });
  }

  const total = sortedAlerts.length;
  const totalPages = Math.max(1, Math.ceil(total / paging.pageSize));
  const page = Math.min(paging.page, totalPages);
  const start = (page - 1) * paging.pageSize;
  const alerts = sortedAlerts.slice(start, start + paging.pageSize);

  return res.json({
    alerts,
    pagination: {
      page,
      pageSize: paging.pageSize,
      total,
      totalPages
    }
  });
});

module.exports = router;
