const test = require('node:test');
const assert = require('node:assert/strict');
const { app } = require('../src/server');

let server;
let baseUrl;

function buildDeadlines() {
  return {
    responseDeadline: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
    resolutionDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    resolutionNotes: ''
  };
}

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

test('admin can create an asset and duplicate values are rejected', async () => {
  const uniqueAssetId = `PLT-LAP-${Date.now()}`;
  const uniqueSerial = `SN-${Date.now()}`;

  const login = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'Admin123!' })
  });
  const { token } = await login.json();

  const createResponse = await fetch(`${baseUrl}/assets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      assetId: uniqueAssetId,
      serialNumber: uniqueSerial,
      category: 'Laptop',
      manufacturer: 'Dell',
      model: 'Latitude 7420',
      siteId: 'site-bucharest',
      assignedEmployee: 'Alex',
      ipAddress: '192.168.20.10',
      macAddress: '00:11:22:33:44:55',
      operatingSystem: 'Windows 11',
      purchaseDate: '2024-01-15',
      warrantyExpirationDate: '2027-01-15',
      status: 'Online',
      notes: 'Test asset'
    })
  });

  assert.equal(createResponse.status, 201);
  const created = await createResponse.json();
  assert.equal(created.asset.assetId, uniqueAssetId);

  const duplicateResponse = await fetch(`${baseUrl}/assets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      assetId: uniqueAssetId,
      serialNumber: `${uniqueSerial}-dup`,
      category: 'Laptop',
      manufacturer: 'Dell',
      model: 'Latitude 7420',
      siteId: 'site-bucharest',
      assignedEmployee: 'Alex',
      ipAddress: '192.168.20.11',
      macAddress: '00:11:22:33:44:56',
      operatingSystem: 'Windows 11',
      purchaseDate: '2024-01-15',
      warrantyExpirationDate: '2027-01-15',
      status: 'Online',
      notes: 'Duplicate asset id'
    })
  });

  assert.equal(duplicateResponse.status, 409);
});

test('site manager only sees assets from their own site', async () => {
  const login = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'manager@example.com', password: 'Manager123!' })
  });
  const { token } = await login.json();

  const response = await fetch(`${baseUrl}/assets`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.ok(body.assets.every((asset) => asset.siteId === 'site-ploiesti'));
});

test('incident creation calculates SLA and stores the status', async () => {
  const uniqueIncidentNumber = `INC-${Date.now()}`;

  const login = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'tech@example.com', password: 'Tech123!' })
  });
  const { token } = await login.json();

  const response = await fetch(`${baseUrl}/incidents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      incidentNumber: uniqueIncidentNumber,
      siteId: 'site-bucharest',
      assetId: 'PLT-LAP-001',
      priority: 'High',
      category: 'Hardware',
      description: 'Laptop not responding',
      assignedTechnician: 'tech@example.com',
      status: 'Open',
      responseDeadline: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
      resolutionDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      resolutionNotes: ''
    })
  });

  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.incident.slaStatus, 'within');
});

test('incident details can be retrieved and assigned technician updated', async () => {
  const uniqueIncidentNumber = `INC-DETAIL-${Date.now()}`;

  const login = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'tech@example.com', password: 'Tech123!' })
  });
  const { token } = await login.json();

  const created = await fetch(`${baseUrl}/incidents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      incidentNumber: uniqueIncidentNumber,
      siteId: 'site-bucharest',
      assetId: 'PLT-LAP-001',
      priority: 'Medium',
      category: 'Software',
      description: 'Assignment workflow test',
      assignedTechnician: ''
      ,
      ...buildDeadlines()
    })
  });
  const createdBody = await created.json();

  const detailResponse = await fetch(`${baseUrl}/incidents/${createdBody.incident.id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  assert.equal(detailResponse.status, 200);
  const detailBody = await detailResponse.json();
  assert.equal(detailBody.incident.incidentNumber, uniqueIncidentNumber);

  const updateResponse = await fetch(`${baseUrl}/incidents/${createdBody.incident.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ assignedTechnician: 'tech@example.com' })
  });

  assert.equal(updateResponse.status, 200);
  const updatedBody = await updateResponse.json();
  assert.equal(updatedBody.incident.assignedTechnician, 'tech@example.com');
});

test('incident status updates are persisted', async () => {
  const uniqueIncidentNumber = `INC-UPD-${Date.now()}`;

  const login = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'tech@example.com', password: 'Tech123!' })
  });
  const { token } = await login.json();

  const created = await fetch(`${baseUrl}/incidents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      incidentNumber: uniqueIncidentNumber,
      siteId: 'site-bucharest',
      assetId: 'PLT-LAP-001',
      priority: 'Medium',
      category: 'Software',
      description: 'Update workflow test',
      assignedTechnician: 'tech@example.com',
      status: 'Open',
      ...buildDeadlines()
    })
  });
  const createdBody = await created.json();

  const response = await fetch(`${baseUrl}/incidents/${createdBody.incident.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ status: 'Resolved', resolutionNotes: 'Fixed in testing' })
  });

  assert.equal(response.status, 200);
  const updatedBody = await response.json();
  assert.equal(updatedBody.incident.status, 'Resolved');
  assert.equal(updatedBody.incident.resolutionNotes, 'Fixed in testing');
});

test('assets endpoint supports pagination and filtering', async () => {
  const unique = Date.now();

  const login = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'Admin123!' })
  });
  const { token } = await login.json();

  await fetch(`${baseUrl}/assets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      assetId: `PG-ASSET-${unique}-1`,
      serialNumber: `PG-SN-${unique}-1`,
      category: 'Laptop',
      siteId: 'site-bucharest',
      status: 'Online'
    })
  });

  await fetch(`${baseUrl}/assets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      assetId: `PG-ASSET-${unique}-2`,
      serialNumber: `PG-SN-${unique}-2`,
      category: 'Desktop',
      siteId: 'site-ploiesti',
      status: 'Offline'
    })
  });

  const pagedResponse = await fetch(`${baseUrl}/assets?paginate=true&page=1&pageSize=1`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.equal(pagedResponse.status, 200);
  const pagedBody = await pagedResponse.json();
  assert.ok(Array.isArray(pagedBody.assets));
  assert.equal(pagedBody.assets.length, 1);
  assert.ok(pagedBody.pagination);
  assert.equal(pagedBody.pagination.pageSize, 1);

  const filteredResponse = await fetch(`${baseUrl}/assets?siteId=site-ploiesti&status=Offline`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.equal(filteredResponse.status, 200);
  const filteredBody = await filteredResponse.json();
  assert.ok(filteredBody.assets.every((asset) => asset.siteId === 'site-ploiesti' && asset.status === 'Offline'));
});

test('incidents endpoint supports pagination and filtering', async () => {
  const unique = Date.now();

  const login = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'tech@example.com', password: 'Tech123!' })
  });
  const { token } = await login.json();

  await fetch(`${baseUrl}/incidents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      incidentNumber: `PG-INC-${unique}-1`,
      siteId: 'site-bucharest',
      assetId: 'PLT-LAP-001',
      priority: 'High',
      category: 'Hardware',
      description: 'Pagination test incident one',
      status: 'Open',
      ...buildDeadlines()
    })
  });

  await fetch(`${baseUrl}/incidents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      incidentNumber: `PG-INC-${unique}-2`,
      siteId: 'site-bucharest',
      assetId: 'PLT-LAP-001',
      priority: 'Low',
      category: 'Software',
      description: 'Pagination test incident two',
      status: 'Resolved',
      ...buildDeadlines()
    })
  });

  const pagedResponse = await fetch(`${baseUrl}/incidents?paginate=true&page=1&pageSize=1`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.equal(pagedResponse.status, 200);
  const pagedBody = await pagedResponse.json();
  assert.ok(Array.isArray(pagedBody.incidents));
  assert.equal(pagedBody.incidents.length, 1);
  assert.ok(pagedBody.pagination);
  assert.equal(pagedBody.pagination.pageSize, 1);

  const filteredResponse = await fetch(`${baseUrl}/incidents?status=Resolved&priority=Low&search=incident%20two`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.equal(filteredResponse.status, 200);
  const filteredBody = await filteredResponse.json();
  assert.ok(filteredBody.incidents.every((incident) => incident.status === 'Resolved' && incident.priority === 'Low'));
});
