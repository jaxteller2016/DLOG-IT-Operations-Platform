const test = require('node:test');
const assert = require('node:assert/strict');
const { app } = require('../src/server');
const { loadMonitoringResults, loadAuditLogs } = require('../src/dataStore');

let server;
let baseUrl;

function startServer() {
  return new Promise((resolve) => {
    server = app.listen(0, () => {
      const address = server.address();
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
}

test.before(async () => {
  await startServer();
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('heartbeat updates asset status and creates alerts', async () => {
  const login = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'Admin123!' })
  });
  const { token } = await login.json();

  const uniqueAssetId = `PLT-LAP-${Date.now()}`;
  const uniqueSerial = `SN${Date.now()}`;

  const createAsset = await fetch(`${baseUrl}/assets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      assetId: uniqueAssetId,
      serialNumber: uniqueSerial,
      category: 'Laptop',
      manufacturer: 'Lenovo',
      model: 'ThinkPad',
      siteId: 'site-bucharest',
      assignedEmployee: 'mina@example.com',
      ipAddress: '192.168.20.20',
      macAddress: '00:11:22:33:44:66',
      operatingSystem: 'Linux',
      purchaseDate: '2024-06-10',
      warrantyExpirationDate: '2027-06-10',
      status: 'Offline',
      notes: 'Monitoring test asset'
    })
  });
  const assetBody = await createAsset.json();
  const assetId = assetBody.asset.assetId;

  const response = await fetch(`${baseUrl}/monitoring/heartbeat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      assetId,
      serialNumber: uniqueSerial,
      timestamp: '2026-08-04T09:35:00Z',
      ipAddress: '192.168.20.20',
      macAddress: '00:11:22:33:44:66',
      operatingSystem: 'Linux',
      cpuUsage: 42,
      memoryUsage: 71,
      diskFreePercent: 12,
      backupStatus: 'failed'
    })
  });

  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.asset.lastOnlineTimestamp, '2026-08-04T09:35:00Z');
  assert.ok(body.alerts.some((alert) => alert.type === 'low-disk-space'));
  assert.ok(body.alerts.some((alert) => alert.type === 'backup-failed'));

  const monitoringResults = loadMonitoringResults();
  assert.ok(monitoringResults.some((entry) => entry.assetId === assetId && entry.timestamp === '2026-08-04T09:35:00Z'));
  assert.ok(monitoringResults.some((entry) => entry.assetId === assetId && entry.serialNumber === uniqueSerial));

  const auditLogs = loadAuditLogs(200);
  assert.ok(auditLogs.some((entry) => entry.entity === 'asset' && entry.action === 'heartbeat-update'));
  assert.ok(auditLogs.some((entry) => entry.entity === 'alert' && entry.action === 'create'));

  const pagedAlerts = await fetch(`${baseUrl}/alerts?paginate=true&page=1&pageSize=1`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.equal(pagedAlerts.status, 200);
  const pagedBody = await pagedAlerts.json();
  assert.ok(Array.isArray(pagedBody.alerts));
  assert.equal(pagedBody.alerts.length, 1);
  assert.ok(pagedBody.pagination);

  const activeBackupAlerts = await fetch(`${baseUrl}/alerts?state=active&type=backup-failed`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.equal(activeBackupAlerts.status, 200);
  const filteredBody = await activeBackupAlerts.json();
  assert.ok(filteredBody.alerts.every((alert) => alert.type === 'backup-failed' && alert.resolvedAt === null));

  const unknownHeartbeatAssetId = `UNKNOWN-ASSET-${Date.now()}`;
  const unknownHeartbeatResponse = await fetch(`${baseUrl}/monitoring/heartbeat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      assetId: unknownHeartbeatAssetId,
      serialNumber: `UNKNOWN-SN-${Date.now()}`,
      timestamp: '2026-08-04T10:00:00Z',
      ipAddress: '192.168.20.99',
      macAddress: 'AA:BB:CC:DD:EE:FF',
      operatingSystem: 'Windows 11',
      cpuUsage: 18,
      memoryUsage: 40,
      diskFreePercent: 60,
      backupStatus: 'ok'
    })
  });

  assert.equal(unknownHeartbeatResponse.status, 201);
  const knownAssetsResponse = await fetch(`${baseUrl}/monitoring/known-assets`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.equal(knownAssetsResponse.status, 200);
  const knownAssetsBody = await knownAssetsResponse.json();
  const unknownSource = knownAssetsBody.knownAssets.find((entry) => entry.assetId === unknownHeartbeatAssetId);
  assert.ok(unknownSource);
  assert.equal(unknownSource.serialNumber.startsWith('UNKNOWN-SN-'), true);
  assert.equal(unknownSource.macAddress, 'AA:BB:CC:DD:EE:FF');
  assert.equal(unknownSource.operatingSystem, 'Windows 11');
  assert.equal(unknownSource.isRegistered, false);

  const linkedSerial = `LINKEDSN${Date.now()}`;
  const createLinkedAsset = await fetch(`${baseUrl}/assets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      serialNumber: linkedSerial,
      heartbeatSourceId: unknownHeartbeatAssetId,
      category: 'Laptop',
      siteId: 'site-bucharest',
      status: 'Offline'
    })
  });
  assert.equal(createLinkedAsset.status, 201);
  const linkedAssetBody = await createLinkedAsset.json();

  const linkedHeartbeat = await fetch(`${baseUrl}/monitoring/heartbeat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      assetId: unknownHeartbeatAssetId,
      serialNumber: linkedSerial,
      timestamp: '2026-08-04T10:15:00Z',
      ipAddress: '192.168.20.99',
      macAddress: 'AA:BB:CC:DD:EE:FF',
      operatingSystem: 'Windows 11',
      cpuUsage: 80,
      memoryUsage: 65,
      diskFreePercent: 10,
      backupStatus: 'failed'
    })
  });
  assert.equal(linkedHeartbeat.status, 201);
  const linkedHeartbeatBody = await linkedHeartbeat.json();
  assert.equal(linkedHeartbeatBody.asset.assetId, linkedAssetBody.asset.assetId);
  assert.ok(linkedHeartbeatBody.alerts.some((alert) => alert.assetId === linkedAssetBody.asset.assetId && alert.type === 'low-disk-space'));
  assert.ok(linkedHeartbeatBody.alerts.some((alert) => alert.assetId === linkedAssetBody.asset.assetId && alert.type === 'backup-failed'));
});
