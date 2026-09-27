const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool(config.postgres);

pool.on('error', (err) => {
  console.error('[budget-service:db] Unexpected database pool error:', err.message);
});

async function initDb(retries = 10, delayMs = 3000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[budget-service:db] Connecting to database (Attempt ${attempt}/${retries})...`);
      const client = await pool.connect();
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS budgets (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id VARCHAR(255) NOT NULL,
            category VARCHAR(100) NOT NULL,
            monthly_limit NUMERIC(12, 2) NOT NULL,
            month_year VARCHAR(7) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, category, month_year)
          );

          CREATE TABLE IF NOT EXISTS alerts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id VARCHAR(255) NOT NULL,
            type VARCHAR(50) NOT NULL,
            title VARCHAR(255) NOT NULL,
            message TEXT NOT NULL,
            category VARCHAR(100) DEFAULT '',
            current_spent NUMERIC(12, 2) DEFAULT 0.0,
            budget_limit NUMERIC(12, 2) DEFAULT 0.0,
            is_read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );

          CREATE TABLE IF NOT EXISTS processed_events (
            event_id VARCHAR(255) PRIMARY KEY,
            event_type VARCHAR(100) NOT NULL,
            processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );

          CREATE INDEX IF NOT EXISTS idx_budgets_user_month ON budgets(user_id, month_year);
          CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON alerts(user_id);
        `);
        console.log('[budget-service:db] Database tables and indexes verified successfully.');
        return;
      } finally {
        client.release();
      }
    } catch (err) {
      console.warn(`[budget-service:db] Attempt ${attempt} failed: ${err.message}`);
      if (attempt === retries) {
        throw new Error(`Failed to initialize budget database: ${err.message}`);
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

async function query(text, params) {
  return pool.query(text, params);
}

module.exports = {
  pool,
  query,
  initDb,
};
