const rateLimit = require('express-rate-limit');

const isTestEnv = process.env.NODE_ENV === 'test';

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTestEnv ? 10_000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' }
});

const heartbeatRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isTestEnv ? 10_000 : 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many heartbeat requests. Please retry shortly.' }
});

module.exports = {
  loginRateLimiter,
  heartbeatRateLimiter
};