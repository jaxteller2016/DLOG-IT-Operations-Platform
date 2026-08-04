const express = require('express');
const { authMiddleware, requireRole } = require('../auth');
const { loadAssets, saveAssets, loadAlerts, saveAlerts } = require('../dataStore');

const router = express.Router();

router.post('/heartbeat', authMiddleware, requireRole('Administrator', 'IT Technician'), (req, res) => {
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

module.exports = router;
