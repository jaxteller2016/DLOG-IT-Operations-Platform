const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const path = require('path');
const { authMiddleware, requireRole, createToken, seedUsers, userCanAccessSite } = require('./auth');
const { loginRateLimiter, heartbeatRateLimiter } = require('./security/rateLimits');
const authRoutes = require('./routes/auth');
const assetRoutes = require('./routes/assets');
const incidentRoutes = require('./routes/incidents');
const monitoringRoutes = require('./routes/monitoring');
const alertRoutes = require('./routes/alerts');
const auditRoutes = require('./routes/audit');
const { loadUsers, saveUsers } = require('./dataStore');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  process.env.FRONTEND_URL
].filter(Boolean);

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json({ limit: '100kb' }));

app.use('/auth/login', loginRateLimiter);
app.use('/monitoring/heartbeat', heartbeatRateLimiter);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/auth', authRoutes);
app.use('/assets', assetRoutes);
app.use('/incidents', incidentRoutes);
app.use('/monitoring', monitoringRoutes);
app.use('/alerts', alertRoutes);
app.use('/audit', auditRoutes);

if (require.main === module) {
  app.listen(PORT, HOST, () => {
    console.log(`Backend listening on ${HOST}:${PORT}`);
  });
}

module.exports = { app, authMiddleware, requireRole, seedUsers, createToken, loadUsers, saveUsers, userCanAccessSite };
