#!/bin/bash
set -e

function create_db() {
    local db=$1
    echo "Checking and creating database '$db' if not exists..."
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "postgres" <<-EOSQL
        SELECT 'CREATE DATABASE $db'
        WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$db')\gexec
        GRANT ALL PRIVILEGES ON DATABASE $db TO $POSTGRES_USER;
EOSQL
}

create_db "finguard_auth"
create_db "finguard_transactions"
create_db "finguard_budgets"
echo "FinGuard PostgreSQL databases successfully initialized."
