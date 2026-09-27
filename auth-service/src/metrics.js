const client = require('prom-client');

const register = new client.Registry();
register.setDefaultLabels({
  app: 'auth-service',
});

// Enable default Node.js/process metrics (CPU, memory, event loop, GC)
client.collectDefaultMetrics({ register });

// HTTP Request Counter
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests processed',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

// HTTP Request Duration Histogram
const httpRequestDurationSeconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

// Business Metrics: Login Attempts
const authLoginsTotal = new client.Counter({
  name: 'auth_logins_total',
  help: 'Total number of login attempts',
  labelNames: ['status'],
  registers: [register],
});

// Business Metrics: Registrations
const authRegistrationsTotal = new client.Counter({
  name: 'auth_registrations_total',
  help: 'Total number of registration attempts',
  labelNames: ['status'],
  registers: [register],
});

module.exports = {
  register,
  httpRequestsTotal,
  httpRequestDurationSeconds,
  authLoginsTotal,
  authRegistrationsTotal,
};
