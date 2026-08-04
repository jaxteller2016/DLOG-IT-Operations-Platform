const express = require('express');
const { authMiddleware, requireRole } = require('../auth');
const { loadAssets, findAssetByAssetId, upsertAsset, findOpenAlertByType, upsertAlert, saveMonitoringResult, logAuditEvent } = require('../dataStore');

const router = express.Router();

router.post('/heartbeat', authMiddleware, requireRole('Administrator', 'IT Technician'), (req, res) => {
  const { assetId, timestamp, ipAddress, cpuUsage, memoryUsage, diskFreePercent, backupStatus } = req.body || {};

  if (!assetId || !timestamp) {
    return res.status(400).json({ error: 'assetId and timestamp are required' });
  }

  const asset = findAssetByAssetId(assetId) || loadAssets().find((entry) => entry.assetId === assetId);
  if (!asset) {
    return res.status(404).json({ error: 'Asset not found' });
  }

  asset.lastOnlineTimestamp = timestamp;
  asset.ipAddress = ipAddress || asset.ipAddress;
  asset.status = 'Online';
  upsertAsset(asset);

  saveMonitoringResult({
    assetId,
    timestamp,
    ipAddress,
    cpuUsage,
    memoryUsage,
    diskFreePercent,
    backupStatus
  });

  logAuditEvent({
    source: 'system',
    actor: req.user.email || req.user.id || 'monitoring-endpoint',
    entity: 'asset',
    entityId: asset.id,
    action: 'heartbeat-update',
    previousValue: null,
    newValue: {
      assetId,
      timestamp,
      ipAddress,
      cpuUsage,
      memoryUsage,
      diskFreePercent,
      backupStatus
    }
  });

  const newAlerts = [];

  if (diskFreePercent !== undefined && diskFreePercent < 15) {
    const existingAlert = findOpenAlertByType(assetId, 'low-disk-space');
    if (!existingAlert) {
      newAlerts.push({ id: `alert-${Date.now()}-disk`, assetId, type: 'low-disk-space', message: 'Low disk space detected', severity: 'high', createdAt: timestamp, resolvedAt: null });
    }
  }

  if (backupStatus === 'failed') {
    const existingAlert = findOpenAlertByType(assetId, 'backup-failed');
    if (!existingAlert) {
      newAlerts.push({ id: `alert-${Date.now()}-backup`, assetId, type: 'backup-failed', message: 'Backup failed', severity: 'high', createdAt: timestamp, resolvedAt: null });
    }
  }

  if (newAlerts.length > 0) {
    newAlerts.forEach((alert) => upsertAlert(alert));

    newAlerts.forEach((alert) => {
      logAuditEvent({
        source: 'system',
        actor: req.user.email || req.user.id || 'monitoring-endpoint',
        entity: 'alert',
        entityId: alert.id,
        action: 'create',
        previousValue: null,
        newValue: alert
      });
    });
  }

  return res.status(201).json({ asset, alerts: newAlerts });
});

module.exports = router;
