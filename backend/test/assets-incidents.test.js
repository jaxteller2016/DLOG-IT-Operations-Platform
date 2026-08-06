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
  const uniqueSerial = `SN${Date.now()}`;

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
      model: 'Latitude7420',
      siteId: 'site-bucharest',
      assignedEmployee: 'alex@example.com',
      ipAddress: '192.168.20.10',
      macAddress: '00:11:22:33:44:55',
      operatingSystem: 'Windows11',
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
      serialNumber: `${uniqueSerial}DUP`,
      category: 'Laptop',
      manufacturer: 'Dell',
      model: 'Latitude7420',
      siteId: 'site-bucharest',
      assignedEmployee: 'alex@example.com',
      ipAddress: '192.168.20.11',
      macAddress: '00:11:22:33:44:56',
      operatingSystem: 'Windows11',
      purchaseDate: '2024-01-15',
      warrantyExpirationDate: '2027-01-15',
      status: 'Online',
      notes: 'Duplicate asset id'
    })
  });

  assert.equal(duplicateResponse.status, 409);
});

test('asset creation rejects invalid formatted fields', async () => {
  const login = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'Admin123!' })
  });
  const { token } = await login.json();

  const response = await fetch(`${baseUrl}/assets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      assetId: 'BAD ID',
      serialNumber: 'SN-123',
      category: 'Laptop',
      manufacturer: 'Dell1',
      model: 'Model#1',
      siteId: 'site-bucharest',
      assignedEmployee: 'not-an-email',
      ipAddress: '192.168.1.a',
      macAddress: '00-11-22-33-44-55',
      operatingSystem: 'Windows 11',
      status: 'Online'
    })
  });

  assert.equal(response.status, 400);
  const body = await response.json();
  assert.match(body.error, /assetId|serialNumber|manufacturer|model|assignedEmployee|ipAddress|macAddress|operatingSystem/);
});

test('asset can be linked to a heartbeat source id', async () => {
  const uniqueSerial = `SNHB${Date.now()}`;
  const heartbeatSourceId = `HB-${Date.now()}`;

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
      serialNumber: uniqueSerial,
      heartbeatSourceId,
      category: 'Laptop',
      siteId: 'site-bucharest',
      status: 'Online'
    })
  });

  assert.equal(createResponse.status, 201);
  const created = await createResponse.json();
  assert.equal(created.asset.heartbeatSourceId, heartbeatSourceId);
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

test('admin can bulk delete selected assets', async () => {
  const unique = Date.now();

  const login = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'Admin123!' })
  });
  const { token } = await login.json();

  const createAsset = async (suffix) => {
    const response = await fetch(`${baseUrl}/assets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        assetId: `DEL-ASSET-${unique}-${suffix}`,
        serialNumber: `DELSN${unique}${suffix}`,
        category: 'Laptop',
        siteId: 'site-bucharest',
        status: 'Online'
      })
    });

    assert.equal(response.status, 201);
    const body = await response.json();
    return body.asset;
  };

  const assetOne = await createAsset('1');
  const assetTwo = await createAsset('2');

  const deleteResponse = await fetch(`${baseUrl}/assets`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ assetIds: [assetOne.id, assetTwo.id] })
  });

  assert.equal(deleteResponse.status, 200);
  const deleteBody = await deleteResponse.json();
  assert.equal(deleteBody.deletedCount, 2);

  const assetsResponse = await fetch(`${baseUrl}/assets`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.equal(assetsResponse.status, 200);
  const assetsBody = await assetsResponse.json();
  assert.ok(!assetsBody.assets.some((asset) => asset.id === assetOne.id || asset.id === assetTwo.id));
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

test('admin can bulk delete selected incidents', async () => {
  const unique = Date.now();

  const login = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'Admin123!' })
  });
  const { token } = await login.json();

  const createIncident = async (suffix) => {
    const response = await fetch(`${baseUrl}/incidents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        incidentNumber: `DEL-INC-${unique}-${suffix}`,
        siteId: 'site-bucharest',
        assetId: 'PLT-LAP-001',
        priority: 'Medium',
        category: 'Hardware',
        description: 'Bulk delete incident test',
        assignedTechnician: 'admin@example.com',
        status: 'Open',
        ...buildDeadlines()
      })
    });

    assert.equal(response.status, 201);
    const body = await response.json();
    return body.incident;
  };

  const incidentOne = await createIncident('1');
  const incidentTwo = await createIncident('2');

  const deleteResponse = await fetch(`${baseUrl}/incidents`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ incidentIds: [incidentOne.id, incidentTwo.id] })
  });

  assert.equal(deleteResponse.status, 200);
  const deleteBody = await deleteResponse.json();
  assert.equal(deleteBody.deletedCount, 2);

  const incidentsResponse = await fetch(`${baseUrl}/incidents`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.equal(incidentsResponse.status, 200);
  const incidentsBody = await incidentsResponse.json();
  assert.ok(!incidentsBody.incidents.some((incident) => incident.id === incidentOne.id || incident.id === incidentTwo.id));
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

  const orderResponse = await fetch(`${baseUrl}/incidents?search=PG-INC-${unique}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.equal(orderResponse.status, 200);
  const orderBody = await orderResponse.json();
  assert.equal(orderBody.incidents[0].incidentNumber, `PG-INC-${unique}-2`);
});
