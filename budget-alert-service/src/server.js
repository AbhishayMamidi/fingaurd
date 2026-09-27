const express = require('express');
const cors = require('cors');
const config = require('./config');
const db = require('./db');
const consumer = require('./consumer');
const budgetRoutes = require('./routes/budgets');
const alertRoutes = require('./routes/alerts');
const { register, httpRequestsTotal, httpRequestDurationSeconds } = require('./metrics');

const app = express();

app.use(cors());
app.use(express.json());

// Structured Request Logging & Prometheus Metrics
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const durationSeconds = duration / 1000;
    const route = req.route ? req.baseUrl + req.route.path : (req.path === '/health' || req.path === '/metrics' ? req.path : 'other');
    const statusCode = String(res.statusCode || 500);

    if (req.path !== '/metrics') {
      httpRequestsTotal.inc({ method: req.method, route, status_code: statusCode });
      httpRequestDurationSeconds.observe({ method: req.method, route, status_code: statusCode }, durationSeconds);
    }

    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        service: 'budget-alert-service',
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: duration,
      })
    );
  });
  next();
});

// Prometheus metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err.message);
  }
});

// Health check endpoint
app.get('/health', async (req, res) => {
  let dbStatus = 'disconnected';
  try {
    const result = await db.query('SELECT 1 as healthy');
    if (result.rows && result.rows[0].healthy === 1) {
      dbStatus = 'connected';
    }
  } catch (err) {
    dbStatus = `error: ${err.message}`;
  }

  const isHealthy = dbStatus === 'connected';
  return res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'degraded',
    service: 'budget-alert-service',
    timestamp: new Date().toISOString(),
    database: dbStatus,
    rabbitmq: consumer.isConnected ? 'connected' : 'connecting',
  });
});

app.get('/api/budgets/health', (req, res) => res.redirect('/health'));

// Routes
app.use('/budgets', budgetRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/alerts', alertRoutes);
app.use('/api/alerts', alertRoutes);

// Error Handler
app.use((err, req, res, next) => {
  console.error('[budget-alert-service:error]', err.message);
  const status = err.statusCode || 500;
  return res.status(status).json({
    error: err.name || 'InternalServerError',
    message: err.message,
  });
});

if (process.env.NODE_ENV !== 'test') {
  (async () => {
    try {
      await db.initDb();
      consumer.start().catch((err) => {
        console.warn('[budget-alert-service] Consumer start failed:', err.message);
      });
      app.listen(config.port, '0.0.0.0', () => {
        console.log(`[budget-alert-service] Listening on port ${config.port}`);
      });
    } catch (err) {
      console.error('[budget-alert-service:fatal] Startup failure:', err.message);
      process.exit(1);
    }
  })();
}

module.exports = app;
