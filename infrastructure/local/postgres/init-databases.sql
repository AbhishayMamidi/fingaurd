-- PostgreSQL database initialization script for FinGuard
SELECT 'CREATE DATABASE finguard_auth' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'finguard_auth')\gexec
SELECT 'CREATE DATABASE finguard_transactions' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'finguard_transactions')\gexec
SELECT 'CREATE DATABASE finguard_budgets' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'finguard_budgets')\gexec
