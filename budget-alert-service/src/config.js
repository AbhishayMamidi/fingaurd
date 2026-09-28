require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT || process.env.BUDGET_PORT || '5005', 10),
  jwtSecret: process.env.JWT_SECRET || 'dev_insecure_jwt_secret_must_override_in_env',
  databaseUrl: process.env.DATABASE_URL || '',
  postgres: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    user: process.env.POSTGRES_USER || 'finguard_user',
    password: process.env.POSTGRES_PASSWORD || 'finguard_dev_secret_2026',
    database: process.env.POSTGRES_BUDGETS_DB || process.env.POSTGRES_DB || 'finguard_budgets',
  },
  rabbitmq: {
    url: process.env.RABBITMQ_URL || process.env.CLOUDAMQP_URL || '',
    host: process.env.RABBITMQ_HOST || 'localhost',
    port: parseInt(process.env.RABBITMQ_PORT || '5672', 10),
    user: process.env.RABBITMQ_USER || 'guest',
    password: process.env.RABBITMQ_PASSWORD || 'guest',
  },
  transactionServiceUrl: process.env.TRANSACTION_SERVICE_URL || 'http://transaction-service:5002',
  env: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
};
