import os
from pydantic_settings import BaseSettings
from sqlalchemy.engine import URL

class Settings(BaseSettings):
    service_name: str = "transaction-service"
    port: int = int(os.getenv("TRANSACTION_PORT", "5002"))
    jwt_secret: str = os.getenv("JWT_SECRET", "dev_insecure_jwt_secret_must_override_in_env")

    # PostgreSQL
    postgres_host: str = os.getenv("POSTGRES_HOST", "localhost")
    postgres_port: int = int(os.getenv("POSTGRES_PORT", "5432"))
    postgres_user: str = os.getenv("POSTGRES_USER", "finguard_user")
    postgres_password: str = os.getenv("POSTGRES_PASSWORD", "finguard_dev_secret_2026")
    postgres_transactions_db: str = os.getenv("POSTGRES_TRANSACTIONS_DB", "finguard_transactions")
    postgres_db_name: str = ""

    # RabbitMQ
    rabbitmq_host: str = os.getenv("RABBITMQ_HOST", "rabbitmq")
    rabbitmq_port: int = int(os.getenv("RABBITMQ_PORT", "5672"))
    rabbitmq_user: str = os.getenv("RABBITMQ_USER", "guest")
    rabbitmq_password: str = os.getenv("RABBITMQ_PASSWORD", "guest")

    # Dependent Microservices URLs
    categorization_service_url: str = os.getenv("CATEGORIZATION_SERVICE_URL", "http://categorization-service:5003")
    fraud_service_url: str = os.getenv("FRAUD_SERVICE_URL", "http://fraud-detection-service:5004")

    environment: str = os.getenv("ENVIRONMENT", "local")
    log_level: str = os.getenv("LOG_LEVEL", "info")

    def __init__(self, **values):
        if "postgres_db" in values:
            values["postgres_db_name"] = values.pop("postgres_db")
        super().__init__(**values)

    @property
    def postgres_db(self) -> str:
        return self.postgres_db_name or self.postgres_transactions_db

    def get_database_url_object(self) -> URL:
        """
        Constructs a safe SQLAlchemy URL object using URL.create() with discrete
        fields to avoid URL parsing corruption when passwords or usernames contain
        reserved special characters (like '@', '#', '$', ':', '/').
        """
        return URL.create(
            drivername="postgresql+psycopg2",
            username=self.postgres_user,
            password=self.postgres_password,
            host=self.postgres_host,
            port=self.postgres_port,
            database=self.postgres_db,
        )

    @property
    def database_url(self) -> str:
        """
        Returns the percent-encoded database connection string.
        Username and password components are safely percent-encoded individually.
        """
        return self.get_database_url_object().render_as_string(hide_password=False)

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
