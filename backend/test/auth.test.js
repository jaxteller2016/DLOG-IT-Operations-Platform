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

test('login returns a token for seeded admin', async () => {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'Admin123!' })
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.ok(body.token);
  assert.equal(body.user.role, 'Administrator');
});

test('role-protected endpoint rejects non-admin access', async () => {
  const login = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'viewer@example.com', password: 'Viewer123!' })
  });
  const authBody = await login.json();

  const response = await fetch(`${baseUrl}/auth/roles`, {
    headers: { Authorization: `Bearer ${authBody.token}` }
  });

  assert.equal(response.status, 403);
});

test('auth/me returns the current user', async () => {
  const login = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'tech@example.com', password: 'Tech123!' })
  });
  const authBody = await login.json();

  const response = await fetch(`${baseUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${authBody.token}` }
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.user.email, 'tech@example.com');
});
