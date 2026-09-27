const express = require('express');
const cors = require('cors');
const config = require('./config');
const db = require('./db');
const authRoutes = require('./routes/auth');
const { register, httpRequestsTotal, httpRequestDurationSeconds } = require('./metrics');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '1mb' }));

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
        service: 'auth-service',
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: duration,
        ip: req.ip,
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
  const statusCode = isHealthy ? 200 : 503;

  return res.status(statusCode).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    service: 'auth-service',
    timestamp: new Date().toISOString(),
    database: dbStatus,
  });
});

// API Routes
app.use('/api/auth', authRoutes);
// Direct route fallback if mounted without gateway prefix
app.use('/auth', authRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'NotFound',
    message: `Cannot ${req.method} ${req.path}`,
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[auth-service:error]', {
    message: err.message,
    stack: config.env === 'development' ? err.stack : undefined,
  });

  const statusCode = err.statusCode || 500;
  return res.status(statusCode).json({
    error: err.name || 'InternalServerError',
    message: statusCode === 500 ? 'An unexpected internal error occurred.' : err.message,
  });
});

// Start Server
if (process.env.NODE_ENV !== 'test') {
  (async () => {
    try {
      await db.initDb();
      app.listen(config.port, '0.0.0.0', () => {
        console.log(`[auth-service] Listening on port ${config.port} (env: ${config.env})`);
      });
    } catch (err) {
      console.error('[auth-service:fatal] Startup failed:', err.message);
      process.exit(1);
    }
  })();
}

module.exports = app;
