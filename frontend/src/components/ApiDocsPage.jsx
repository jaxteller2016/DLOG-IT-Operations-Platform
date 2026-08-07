import React, { useMemo, useState } from 'react';

function CodeBlock({ title, code, language = 'bash' }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-100">{title}</h4>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-lg border border-emerald-500/60 px-2.5 py-1 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto rounded-lg bg-slate-900/80 p-3 text-xs text-slate-200">
        <code className={`language-${language}`}>{code}</code>
      </pre>
    </section>
  );
}

function EndpointCard({ method, path, auth, description, requestBody, responseShape, examples }) {
  return (
    <article className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-4 shadow-[0_10px_24px_rgba(2,6,23,0.28)]">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-slate-800 px-2 py-1 text-xs font-bold tracking-wide text-emerald-300">{method}</span>
        <span className="text-sm font-semibold text-slate-100">{path}</span>
        <span className={`rounded-md px-2 py-1 text-[11px] font-medium ${auth ? 'bg-amber-500/20 text-amber-200' : 'bg-slate-700 text-slate-200'}`}>
          {auth ? 'Auth required' : 'Public'}
        </span>
      </div>

      <p className="mb-3 text-sm text-slate-300">{description}</p>

      {requestBody ? (
        <div className="mb-3 rounded-lg border border-slate-700 bg-slate-950/70 p-3">
          <h5 className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-300">Request body</h5>
          <pre className="overflow-x-auto text-xs text-slate-200"><code>{requestBody}</code></pre>
        </div>
      ) : null}

      {responseShape ? (
        <div className="mb-3 rounded-lg border border-slate-700 bg-slate-950/70 p-3">
          <h5 className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-300">Typical response</h5>
          <pre className="overflow-x-auto text-xs text-slate-200"><code>{responseShape}</code></pre>
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        {examples.map((example) => (
          <CodeBlock key={`${path}-${example.title}`} title={example.title} code={example.code} language={example.language} />
        ))}
      </div>
    </article>
  );
}

function buildEndpoints(origin, apiRoot) {
  const authHeader = 'Authorization: Bearer <JWT_TOKEN>';

  return [
    {
      method: 'GET',
      path: '/health',
      auth: false,
      description: 'Service health probe.',
      requestBody: null,
      responseShape: JSON.stringify({ status: 'ok' }, null, 2),
      examples: [
        {
          title: 'cURL',
          language: 'bash',
          code: `curl -sS ${origin}/health`
        },
        {
          title: 'JavaScript fetch',
          language: 'javascript',
          code: `const res = await fetch('${origin}/health');\nconsole.log(await res.json());`
        }
      ]
    },
    {
      method: 'POST',
      path: '/auth/login',
      auth: false,
      description: 'Authenticate user and return JWT token + user profile.',
      requestBody: JSON.stringify({ email: 'admin@example.com', password: 'Admin123!' }, null, 2),
      responseShape: JSON.stringify({ token: '<jwt-token>', user: { email: 'admin@example.com', role: 'Administrator' } }, null, 2),
      examples: [
        {
          title: 'cURL',
          language: 'bash',
          code: `curl -sS -X POST ${apiRoot}/auth/login \\\n  -H 'Content-Type: application/json' \\\n  -d '${JSON.stringify({ email: 'admin@example.com', password: 'Admin123!' })}'`
        },
        {
          title: 'JavaScript fetch',
          language: 'javascript',
          code: `const res = await fetch('${apiRoot}/auth/login', {\n  method: 'POST',\n  headers: { 'Content-Type': 'application/json' },\n  body: JSON.stringify({ email: 'admin@example.com', password: 'Admin123!' })\n});\nconsole.log(await res.json());`
        }
      ]
    },
    {
      method: 'GET',
      path: '/auth/me',
      auth: true,
      description: 'Return the current authenticated user profile.',
      requestBody: null,
      responseShape: JSON.stringify({ user: { id: 'user-admin', email: 'admin@example.com', role: 'Administrator', siteId: 'site-bucharest' } }, null, 2),
      examples: [
        {
          title: 'cURL',
          language: 'bash',
          code: `curl -sS ${apiRoot}/auth/me -H '${authHeader}'`
        },
        {
          title: 'JavaScript fetch',
          language: 'javascript',
          code: `const res = await fetch('${apiRoot}/auth/me', {\n  headers: { Authorization: 'Bearer <JWT_TOKEN>' }\n});\nconsole.log(await res.json());`
        }
      ]
    },
    {
      method: 'POST',
      path: '/auth/logout',
      auth: true,
      description: 'Revoke the current JWT token.',
      requestBody: null,
      responseShape: JSON.stringify({ success: true }, null, 2),
      examples: [
        {
          title: 'cURL',
          language: 'bash',
          code: `curl -sS -X POST ${apiRoot}/auth/logout -H '${authHeader}'`
        },
        {
          title: 'JavaScript fetch',
          language: 'javascript',
          code: `await fetch('${apiRoot}/auth/logout', {\n  method: 'POST',\n  headers: { Authorization: 'Bearer <JWT_TOKEN>' }\n});`
        }
      ]
    },
    {
      method: 'GET',
      path: '/assets',
      auth: true,
      description: 'List assets with optional filters/pagination.',
      requestBody: null,
      responseShape: JSON.stringify({ assets: [{ id: 'asset-123', assetId: 'PLT-LAP-001' }], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } }, null, 2),
      examples: [
        {
          title: 'cURL',
          language: 'bash',
          code: `curl -sS '${apiRoot}/assets?paginate=true&page=1&pageSize=20' \\\n  -H '${authHeader}'`
        },
        {
          title: 'JavaScript fetch',
          language: 'javascript',
          code: `const res = await fetch('${apiRoot}/assets?paginate=true&page=1&pageSize=20', {\n  headers: { Authorization: 'Bearer <JWT_TOKEN>' }\n});\nconsole.log(await res.json());`
        }
      ]
    },
    {
      method: 'POST',
      path: '/assets',
      auth: true,
      description: 'Create a new asset.',
      requestBody: JSON.stringify({ serialNumber: 'SN999100', category: 'Laptop', siteId: 'site-bucharest', manufacturer: 'Dell', model: 'Latitude 7420', status: 'Online' }, null, 2),
      responseShape: JSON.stringify({ asset: { id: 'asset-123', assetId: 'PLT-LAP-777' } }, null, 2),
      examples: [
        {
          title: 'cURL',
          language: 'bash',
          code: `curl -sS -X POST ${apiRoot}/assets \\\n  -H 'Content-Type: application/json' \\\n  -H '${authHeader}' \\\n  -d '${JSON.stringify({ serialNumber: 'SN999100', category: 'Laptop', siteId: 'site-bucharest', manufacturer: 'Dell', model: 'Latitude 7420', status: 'Online' })}'`
        },
        {
          title: 'JavaScript fetch',
          language: 'javascript',
          code: `await fetch('${apiRoot}/assets', {\n  method: 'POST',\n  headers: {\n    'Content-Type': 'application/json',\n    Authorization: 'Bearer <JWT_TOKEN>'\n  },\n  body: JSON.stringify({ serialNumber: 'SN999100', category: 'Laptop', siteId: 'site-bucharest', status: 'Online' })\n});`
        }
      ]
    },
    {
      method: 'DELETE',
      path: '/assets',
      auth: true,
      description: 'Bulk delete assets by internal ids (admin only).',
      requestBody: JSON.stringify({ assetIds: ['asset-123', 'asset-124'] }, null, 2),
      responseShape: JSON.stringify({ deletedCount: 2, assetIds: ['asset-123', 'asset-124'] }, null, 2),
      examples: [
        {
          title: 'cURL',
          language: 'bash',
          code: `curl -sS -X DELETE ${apiRoot}/assets \\\n+  -H 'Content-Type: application/json' \\\n+  -H '${authHeader}' \\\n+  -d '${JSON.stringify({ assetIds: ['asset-123', 'asset-124'] })}'`
        },
        {
          title: 'JavaScript fetch',
          language: 'javascript',
          code: `await fetch('${apiRoot}/assets', {\n  method: 'DELETE',\n  headers: {\n    'Content-Type': 'application/json',\n    Authorization: 'Bearer <JWT_TOKEN>'\n  },\n  body: JSON.stringify({ assetIds: ['asset-123', 'asset-124'] })\n});`
        }
      ]
    },
    {
      method: 'GET',
      path: '/incidents',
      auth: true,
      description: 'List incidents sorted newest-first with optional filters.',
      requestBody: null,
      responseShape: JSON.stringify({ incidents: [{ id: 'incident-123', incidentNumber: 'INC-001', status: 'Open' }] }, null, 2),
      examples: [
        {
          title: 'cURL',
          language: 'bash',
          code: `curl -sS '${apiRoot}/incidents?paginate=true&page=1&pageSize=20&status=Open' \\\n  -H '${authHeader}'`
        },
        {
          title: 'JavaScript fetch',
          language: 'javascript',
          code: `const res = await fetch('${apiRoot}/incidents?paginate=true&page=1&pageSize=20', {\n  headers: { Authorization: 'Bearer <JWT_TOKEN>' }\n});\nconsole.log(await res.json());`
        }
      ]
    },
    {
      method: 'POST',
      path: '/incidents',
      auth: true,
      description: 'Create incident with SLA deadlines.',
      requestBody: JSON.stringify({ siteId: 'site-bucharest', assetId: 'PLT-LAP-001', priority: 'High', category: 'Hardware', description: 'Device not booting', status: 'Open', responseDeadline: '2026-08-07T16:00:00Z', resolutionDeadline: '2026-08-08T16:00:00Z' }, null, 2),
      responseShape: JSON.stringify({ incident: { id: 'incident-123', incidentNumber: 'INC-001', slaStatus: 'within' } }, null, 2),
      examples: [
        {
          title: 'cURL',
          language: 'bash',
          code: `curl -sS -X POST ${apiRoot}/incidents \\\n  -H 'Content-Type: application/json' \\\n  -H '${authHeader}' \\\n  -d '${JSON.stringify({ siteId: 'site-bucharest', assetId: 'PLT-LAP-001', priority: 'High', category: 'Hardware', description: 'Device not booting', status: 'Open', responseDeadline: '2026-08-07T16:00:00Z', resolutionDeadline: '2026-08-08T16:00:00Z' })}'`
        },
        {
          title: 'JavaScript fetch',
          language: 'javascript',
          code: `await fetch('${apiRoot}/incidents', {\n  method: 'POST',\n  headers: {\n    'Content-Type': 'application/json',\n    Authorization: 'Bearer <JWT_TOKEN>'\n  },\n  body: JSON.stringify({ siteId: 'site-bucharest', assetId: 'PLT-LAP-001', priority: 'High', category: 'Hardware', description: 'Device not booting', status: 'Open', responseDeadline: '2026-08-07T16:00:00Z', resolutionDeadline: '2026-08-08T16:00:00Z' })\n});`
        }
      ]
    },
    {
      method: 'PATCH',
      path: '/incidents/:id',
      auth: true,
      description: 'Update incident status, assignment, or deadlines.',
      requestBody: JSON.stringify({ status: 'In Progress', assignedTechnician: 'tech@example.com' }, null, 2),
      responseShape: JSON.stringify({ incident: { id: 'incident-123', status: 'In Progress', responseSlaStatus: 'within' } }, null, 2),
      examples: [
        {
          title: 'cURL',
          language: 'bash',
          code: `curl -sS -X PATCH ${apiRoot}/incidents/incident-123 \\\n+  -H 'Content-Type: application/json' \\\n+  -H '${authHeader}' \\\n+  -d '${JSON.stringify({ status: 'In Progress', assignedTechnician: 'tech@example.com' })}'`
        },
        {
          title: 'JavaScript fetch',
          language: 'javascript',
          code: `await fetch('${apiRoot}/incidents/incident-123', {\n  method: 'PATCH',\n  headers: {\n    'Content-Type': 'application/json',\n    Authorization: 'Bearer <JWT_TOKEN>'\n  },\n  body: JSON.stringify({ status: 'In Progress', assignedTechnician: 'tech@example.com' })\n});`
        }
      ]
    },
    {
      method: 'DELETE',
      path: '/incidents',
      auth: true,
      description: 'Bulk delete incidents by internal ids (admin only).',
      requestBody: JSON.stringify({ incidentIds: ['incident-123', 'incident-124'] }, null, 2),
      responseShape: JSON.stringify({ deletedCount: 2, incidentIds: ['incident-123', 'incident-124'] }, null, 2),
      examples: [
        {
          title: 'cURL',
          language: 'bash',
          code: `curl -sS -X DELETE ${apiRoot}/incidents \\\n+  -H 'Content-Type: application/json' \\\n+  -H '${authHeader}' \\\n+  -d '${JSON.stringify({ incidentIds: ['incident-123', 'incident-124'] })}'`
        },
        {
          title: 'JavaScript fetch',
          language: 'javascript',
          code: `await fetch('${apiRoot}/incidents', {\n  method: 'DELETE',\n  headers: {\n    'Content-Type': 'application/json',\n    Authorization: 'Bearer <JWT_TOKEN>'\n  },\n  body: JSON.stringify({ incidentIds: ['incident-123', 'incident-124'] })\n});`
        }
      ]
    },
    {
      method: 'POST',
      path: '/monitoring/heartbeat',
      auth: true,
      description: 'Submit monitoring heartbeat and trigger alerting conditions.',
      requestBody: JSON.stringify({ assetId: 'PLT-LAP-001', timestamp: '2026-08-07T09:35:00Z', cpuUsage: 42, memoryUsage: 71, diskFreePercent: 12, backupStatus: 'failed' }, null, 2),
      responseShape: JSON.stringify({ asset: { assetId: 'PLT-LAP-001', status: 'Online' }, alerts: [{ type: 'low-disk-space' }, { type: 'backup-failed' }] }, null, 2),
      examples: [
        {
          title: 'cURL',
          language: 'bash',
          code: `curl -sS -X POST ${apiRoot}/monitoring/heartbeat \\\n  -H 'Content-Type: application/json' \\\n  -H '${authHeader}' \\\n  -d '${JSON.stringify({ assetId: 'PLT-LAP-001', timestamp: '2026-08-07T09:35:00Z', cpuUsage: 42, memoryUsage: 71, diskFreePercent: 12, backupStatus: 'failed' })}'`
        },
        {
          title: 'JavaScript fetch',
          language: 'javascript',
          code: `await fetch('${apiRoot}/monitoring/heartbeat', {\n  method: 'POST',\n  headers: {\n    'Content-Type': 'application/json',\n    Authorization: 'Bearer <JWT_TOKEN>'\n  },\n  body: JSON.stringify({ assetId: 'PLT-LAP-001', timestamp: new Date().toISOString(), cpuUsage: 42, memoryUsage: 71, diskFreePercent: 12, backupStatus: 'failed' })\n});`
        }
      ]
    },
    {
      method: 'GET',
      path: '/monitoring/known-assets',
      auth: true,
      description: 'List known heartbeat sources and registration status.',
      requestBody: null,
      responseShape: JSON.stringify({ knownAssets: [{ assetId: 'HB-MAC1234', isRegistered: false, operatingSystem: 'Windows 11' }] }, null, 2),
      examples: [
        {
          title: 'cURL',
          language: 'bash',
          code: `curl -sS ${apiRoot}/monitoring/known-assets -H '${authHeader}'`
        },
        {
          title: 'JavaScript fetch',
          language: 'javascript',
          code: `const res = await fetch('${apiRoot}/monitoring/known-assets', {\n  headers: { Authorization: 'Bearer <JWT_TOKEN>' }\n});\nconsole.log(await res.json());`
        }
      ]
    },
    {
      method: 'GET',
      path: '/alerts',
      auth: true,
      description: 'List alerts with filtering and pagination options.',
      requestBody: null,
      responseShape: JSON.stringify({ alerts: [{ id: 'alert-123', type: 'backup-failed', resolvedAt: null }] }, null, 2),
      examples: [
        {
          title: 'cURL',
          language: 'bash',
          code: `curl -sS '${apiRoot}/alerts?paginate=true&page=1&pageSize=20' \\\n  -H '${authHeader}'`
        },
        {
          title: 'JavaScript fetch',
          language: 'javascript',
          code: `const res = await fetch('${apiRoot}/alerts?paginate=true&page=1&pageSize=20', {\n  headers: { Authorization: 'Bearer <JWT_TOKEN>' }\n});\nconsole.log(await res.json());`
        }
      ]
    },
    {
      method: 'GET',
      path: '/audit',
      auth: true,
      description: 'Retrieve audit records (admin only).',
      requestBody: null,
      responseShape: JSON.stringify({ entries: [{ source: 'user', actor: 'admin@example.com', entity: 'asset', action: 'create' }] }, null, 2),
      examples: [
        {
          title: 'cURL',
          language: 'bash',
          code: `curl -sS '${apiRoot}/audit?limit=100' -H '${authHeader}'`
        },
        {
          title: 'JavaScript fetch',
          language: 'javascript',
          code: `const res = await fetch('${apiRoot}/audit?limit=100', {\n  headers: { Authorization: 'Bearer <JWT_TOKEN>' }\n});\nconsole.log(await res.json());`
        }
      ]
    }
  ];
}

export default function ApiDocsPage() {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4173';
  const apiRoot = `${origin}/api`;
  const endpoints = useMemo(() => buildEndpoints(origin, apiRoot), [origin, apiRoot]);

  return (
    <main className="mx-auto w-full max-w-[1900px] px-4 pb-12 pt-8 sm:px-6 lg:px-8">
      <header className="mb-5 rounded-2xl border border-slate-700/70 bg-slate-900/75 p-5 shadow-[0_20px_45px_rgba(2,6,23,0.45)]">
        <p className="mb-1 text-[11px] uppercase tracking-[0.28em] text-emerald-300">Developer Reference</p>
        <h1 className="text-3xl font-semibold text-slate-50">DLOG API Documentation</h1>
        <p className="mt-2 text-sm text-slate-300">
          Complete API reference with request and response examples. Use Copy to paste snippets directly into your terminal or scripts.
        </p>
        <div className="mt-4 grid gap-2 text-sm text-slate-200 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2"><strong className="text-emerald-300">Public app origin:</strong> {origin}</div>
          <div className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2"><strong className="text-emerald-300">API root:</strong> {apiRoot}</div>
          <div className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2"><strong className="text-emerald-300">Auth:</strong> Bearer JWT</div>
          <div className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2"><strong className="text-emerald-300">Token expiry:</strong> default 8h</div>
        </div>
      </header>

      <section className="mb-5 rounded-2xl border border-slate-700/70 bg-slate-900/75 p-5 shadow-[0_20px_45px_rgba(2,6,23,0.45)]">
        <h2 className="text-xl font-semibold text-slate-50">Quick Start</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-300">
          <li>Login via POST /auth/login and copy your token from the response.</li>
          <li>Use Authorization: Bearer token for protected routes.</li>
          <li>Use paginated list endpoints for large datasets.</li>
          <li>Call POST /auth/logout when ending the session.</li>
        </ol>
      </section>

      <section className="grid gap-4">
        {endpoints.map((endpoint) => (
          <EndpointCard key={`${endpoint.method}-${endpoint.path}`} {...endpoint} />
        ))}
      </section>
    </main>
  );
}
