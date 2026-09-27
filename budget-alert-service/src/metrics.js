const client = require('prom-client');

const register = new client.Registry();
register.setDefaultLabels({
  app: 'budget-alert-service',
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

// Business Metrics: Budget Events Processed
const budgetEventsProcessedTotal = new client.Counter({
  name: 'budget_events_processed_total',
  help: 'Total number of RabbitMQ transaction events processed',
  labelNames: ['status', 'event_type'],
  registers: [register],
});

// Business Metrics: Alerts Triggered
const budgetAlertsTriggeredTotal = new client.Counter({
  name: 'budget_alerts_triggered_total',
  help: 'Total number of budget and fraud alerts generated',
  labelNames: ['alert_type', 'category'],
  registers: [register],
});

module.exports = {
  register,
  httpRequestsTotal,
  httpRequestDurationSeconds,
  budgetEventsProcessedTotal,
  budgetAlertsTriggeredTotal,
};
