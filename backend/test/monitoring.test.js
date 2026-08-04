const test = require('node:test');
const assert = require('node:assert/strict');
const { app } = require('../src/server');

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
  const uniqueSerial = `SN-${Date.now()}`;

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
      assignedEmployee: 'Mina',
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
      timestamp: '2026-08-04T09:35:00Z',
      ipAddress: '192.168.20.20',
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
});
