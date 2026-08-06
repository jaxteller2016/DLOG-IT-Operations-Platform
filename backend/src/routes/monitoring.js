const express = require('express');
const { authMiddleware, requireRole } = require('../auth');
const { loadAssets, findAssetByAssetId, upsertAsset, findOpenAlertByType, upsertAlert, saveMonitoringResult, loadMonitoringResults, logAuditEvent } = require('../dataStore');

const router = express.Router();

function findAssetForHeartbeat(assetId) {
  return findAssetByAssetId(assetId)
    || loadAssets().find((entry) => entry.assetId === assetId || entry.heartbeatSourceId === assetId);
}

router.post('/heartbeat', authMiddleware, requireRole('Administrator', 'IT Technician'), (req, res) => {
  const { assetId, timestamp, serialNumber, ipAddress, macAddress, operatingSystem, cpuUsage, memoryUsage, diskFreePercent, backupStatus } = req.body || {};

  if (!assetId || !timestamp) {
    return res.status(400).json({ error: 'assetId and timestamp are required' });
  }

  const asset = findAssetForHeartbeat(assetId);
  if (asset) {
    asset.lastOnlineTimestamp = timestamp;
    asset.ipAddress = ipAddress || asset.ipAddress;
    asset.macAddress = macAddress || asset.macAddress;
    asset.operatingSystem = operatingSystem || asset.operatingSystem;
    asset.serialNumber = serialNumber || asset.serialNumber;
    asset.status = 'Online';
    upsertAsset(asset);
  }

  saveMonitoringResult({
    assetId,
    timestamp,
    serialNumber,
    ipAddress,
    macAddress,
    operatingSystem,
    cpuUsage,
    memoryUsage,
    diskFreePercent,
    backupStatus
  });

  logAuditEvent({
    source: 'system',
    actor: req.user.email || req.user.id || 'monitoring-endpoint',
    entity: asset ? 'asset' : 'monitoring-source',
    entityId: asset ? asset.id : assetId,
    action: 'heartbeat-update',
    previousValue: null,
    newValue: {
      assetId,
      timestamp,
      serialNumber,
      ipAddress,
      macAddress,
      operatingSystem,
      cpuUsage,
      memoryUsage,
      diskFreePercent,
      backupStatus
    }
  });

  const newAlerts = [];

  const alertAssetId = asset ? asset.assetId : assetId;

  if (asset && diskFreePercent !== undefined && diskFreePercent < 15) {
    const existingAlert = findOpenAlertByType(alertAssetId, 'low-disk-space');
    if (!existingAlert) {
      newAlerts.push({ id: `alert-${Date.now()}-disk`, assetId: alertAssetId, type: 'low-disk-space', message: 'Low disk space detected', severity: 'high', createdAt: timestamp, resolvedAt: null });
    }
  }

  if (asset && backupStatus === 'failed') {
    const existingAlert = findOpenAlertByType(alertAssetId, 'backup-failed');
    if (!existingAlert) {
      newAlerts.push({ id: `alert-${Date.now()}-backup`, assetId: alertAssetId, type: 'backup-failed', message: 'Backup failed', severity: 'high', createdAt: timestamp, resolvedAt: null });
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

  return res.status(201).json({ asset: asset || null, alerts: newAlerts });
});

router.get('/known-assets', authMiddleware, requireRole('Administrator', 'IT Technician', 'Site Manager'), (req, res) => {
  const monitoringResults = loadMonitoringResults();
  const registeredAssets = new Map(loadAssets().map((asset) => [asset.assetId, asset]));
  const knownSources = new Map();

  monitoringResults.forEach((result) => {
    if (!result.assetId || knownSources.has(result.assetId)) return;

    const registeredAsset = registeredAssets.get(result.assetId);
    knownSources.set(result.assetId, {
      assetId: result.assetId,
      serialNumber: result.serialNumber || registeredAsset?.serialNumber || '',
      ipAddress: result.ipAddress || registeredAsset?.ipAddress || '',
      macAddress: result.macAddress || registeredAsset?.macAddress || '',
      operatingSystem: result.operatingSystem || registeredAsset?.operatingSystem || '',
      lastHeartbeatAt: result.timestamp || null,
        isRegistered: Boolean(registeredAsset),
        registeredAssetId: registeredAsset?.assetId || ''
    });
  });

  return res.json({ knownAssets: Array.from(knownSources.values()) });
});

module.exports = router;
