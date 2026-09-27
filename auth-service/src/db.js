const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool(config.postgres);

pool.on('error', (err) => {
  console.error('[auth-service:db] Unexpected database error on idle client:', err.message);
});

async function initDb(retries = 10, delayMs = 3000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[auth-service:db] Connecting to database (Attempt ${attempt}/${retries})...`);
      const client = await pool.connect();
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            full_name VARCHAR(255) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        `);
        console.log('[auth-service:db] Database tables and indexes verified successfully.');
        return;
      } finally {
        client.release();
      }
    } catch (err) {
      console.warn(`[auth-service:db] Connection attempt ${attempt} failed: ${err.message}`);
      if (attempt === retries) {
        throw new Error(`Failed to initialize database after ${retries} attempts: ${err.message}`);
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (config.env === 'development' && duration > 100) {
    console.debug(`[auth-service:db] Executed query in ${duration}ms: ${text}`);
  }
  return res;
}

module.exports = {
  pool,
  query,
  initDb,
};
