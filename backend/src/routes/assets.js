const express = require('express');
const { authMiddleware, requireRole, userCanAccessSite, seedUsers } = require('../auth');
const { loadAssets, saveAssets } = require('../dataStore');

const router = express.Router();

router.get('/', authMiddleware, (req, res) => {
  const users = seedUsers();
  const currentUser = users.find((entry) => entry.id === req.user.id);
  const assets = loadAssets().filter((asset) => userCanAccessSite(currentUser, asset.siteId));
  return res.json({ assets });
});

router.post('/', authMiddleware, requireRole('Administrator', 'IT Technician'), (req, res) => {
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

module.exports = router;
