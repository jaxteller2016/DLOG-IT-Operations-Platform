# DLOG IT Operations Platform

A multi-site IT asset monitoring and incident management MVP.

## Prerequisites

- Node.js 22.x (recommended)
- npm 10+
- Git

## 1. Clone from GitHub

```bash
git clone https://github.com/jaxteller2016/DLOG-IT-Operations-Platform.git
cd DLOG-IT-Operations-Platform
```

## 2. Install dependencies

From the repository root:

```bash
npm install
```

## 3. Configure local environment

Create a root `.env` file (same level as `package.json`):

Generate a JWT secret first:

```bash
openssl rand -hex 48
```

Copy the generated value and use it for `JWT_SECRET` in `.env`:

```env
NODE_ENV=development
HOST=0.0.0.0
PORT=5000
JWT_SECRET=paste-generated-secret-here
JWT_EXPIRES_IN=8h
FRONTEND_URL=http://127.0.0.1:4173
```

Notes:
- The backend reads environment values from this root `.env` file.
- If `.env` is missing, local defaults still work, but using `.env` is recommended.

## 4. Run the project locally

Start backend and frontend together from the root:

```bash
npm run dev
```

Local URLs:
- Frontend: http://127.0.0.1:4173
- Backend health: http://127.0.0.1:5000/health

## 5. Test login accounts (seeded automatically)

- Administrator: admin@example.com / Admin123!
- IT Technician: tech@example.com / Tech123!
- Site Manager: manager@example.com / Manager123!
- Management Viewer: viewer@example.com / Viewer123!

## 6. Run database migrations

From the root:

```bash
npm run migrate --workspace=backend
```

## 7. Run automated tests

Run all backend tests from the root:

```bash
npm run test
```

Or run backend tests directly:

```bash
npm run test --workspace=backend
```

## 8. Build frontend (optional verification)

```bash
npm run build
```

## Troubleshooting

- Port conflicts:
  - Frontend expects `127.0.0.1:4173`
  - Backend expects `0.0.0.0:5000`
- If install fails for native packages, ensure Node.js is version 22.x.
- If authentication fails, confirm the root `.env` exists and restart `npm run dev`.
