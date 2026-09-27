import logging
import time
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

logger = logging.getLogger("transaction-db")

engine = create_engine(
    settings.get_database_url_object(),
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db(retries: int = 10, delay: int = 3):
    """
    Ensures connection to Postgres and idempotently creates tables and indexes.
    """
    for attempt in range(1, retries + 1):
        try:
            logger.info(f"Connecting to database {settings.postgres_db} (Attempt {attempt}/{retries})...")
            with engine.connect() as conn:
                conn.execute(text("SELECT 1;"))
                conn.execute(text("""
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
                """))
                conn.commit()
                logger.info("Transaction database tables and indexes initialized successfully.")
                return
        except Exception as e:
            logger.warning(f"Database connection attempt {attempt} failed: {e}")
            if attempt == retries:
                logger.error("Failed to connect to database after maximum retries.")
                raise e
            time.sleep(delay)
