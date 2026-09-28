-- ============================================================================
-- FinGuard — Render Cloud PostgreSQL Schema Initialization
-- Idempotent, production-grade schema setup for shared/dedicated cloud databases
-- ============================================================================

-- Ensure UUID generation functions are available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Users Table (auth-service)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 2. Transactions Table (transaction-service)
CREATE TABLE IF NOT EXISTS transactions (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'expense',
    description VARCHAR(255) NOT NULL,
    merchant VARCHAR(255) DEFAULT '',
    category VARCHAR(100) NOT NULL DEFAULT 'Other',
    date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_fraud_flagged BOOLEAN DEFAULT FALSE,
    fraud_score NUMERIC(5, 3) DEFAULT 0.0,
    fraud_reason TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
CREATE INDEX IF NOT EXISTS idx_transactions_is_fraud ON transactions(is_fraud_flagged);

-- 3. Budgets Table (budget-alert-service)
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
CREATE INDEX IF NOT EXISTS idx_budgets_user_month ON budgets(user_id, month_year);

-- 4. Alerts Table (budget-alert-service)
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
CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON alerts(user_id);

-- 5. Processed Events Table (budget-alert-service idempotency)
CREATE TABLE IF NOT EXISTS processed_events (
    event_id VARCHAR(255) PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
