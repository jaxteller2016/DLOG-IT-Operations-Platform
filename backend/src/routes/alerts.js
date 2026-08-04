const express = require('express');
const { authMiddleware, userCanAccessSite, seedUsers } = require('../auth');
const { loadAlerts, loadAssets } = require('../dataStore');

const router = express.Router();

router.get('/', authMiddleware, (req, res) => {
  const users = seedUsers();
  const currentUser = users.find((entry) => entry.id === req.user.id);
  const alerts = loadAlerts().filter((alert) => {
    const asset = loadAssets().find((entry) => entry.assetId === alert.assetId);
    if (!asset) return false;
    return userCanAccessSite(currentUser, asset.siteId);
  });
  return res.json({ alerts });
});

module.exports = router;
