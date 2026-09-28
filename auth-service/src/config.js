require('dotenv').config();

module.exports = {
  port: parseInt(process.env.AUTH_PORT || '5001', 10),
  jwtSecret: process.env.JWT_SECRET || 'dev_insecure_jwt_secret_must_override_in_env',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  postgres: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    user: process.env.POSTGRES_USER || 'finguard_user',
    password: process.env.POSTGRES_PASSWORD || 'finguard_dev_secret_2026',
    database: process.env.POSTGRES_AUTH_DB || 'finguard_auth',
  },
  env: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
};
