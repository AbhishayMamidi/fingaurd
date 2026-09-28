#!/usr/bin/env python3
"""
FinGuard — Render PostgreSQL Migration & Initialization Script
Applies idempotent schema initialization to a target PostgreSQL database using DATABASE_URL.
"""

import os
import sys
from pathlib import Path
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

def main():
    db_url = os.getenv("DATABASE_URL")
    if len(sys.argv) > 1:
        db_url = sys.argv[1]

    if not db_url:
        print("ERROR: DATABASE_URL environment variable or command argument is required.")
        print("Usage: python init_render_db.py [DATABASE_URL]")
        sys.exit(1)

    # Path to SQL init script
    sql_file = Path(__file__).resolve().parent.parent / "infrastructure" / "render" / "init-render-database.sql"
    if not sql_file.is_file():
        print(f"ERROR: SQL script not found at {sql_file}")
        sys.exit(1)

    with open(sql_file, "r", encoding="utf-8") as f:
        sql_content = f.read()

    print("[init_render_db] Connecting to target PostgreSQL instance...")
    # Cloud databases (e.g. Render) require SSL
    sslmode = "disable" if ("localhost" in db_url or "127.0.0.1" in db_url) else "require"

    try:
        conn = psycopg2.connect(db_url, sslmode=sslmode)
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        with conn.cursor() as cur:
            print("[init_render_db] Executing idempotent schema setup...")
            cur.execute(sql_content)
        conn.close()
        print("[init_render_db] SUCCESS: FinGuard PostgreSQL schema verified and ready!")
    except Exception as e:
        print(f"[init_render_db] ERROR: Database initialization failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
