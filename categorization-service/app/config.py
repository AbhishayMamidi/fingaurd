import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    service_name: str = "categorization-service"
    port: int = int(os.getenv("PORT", os.getenv("CATEGORIZATION_PORT", "5003")))
    rabbitmq_url: str = os.getenv("RABBITMQ_URL", os.getenv("CLOUDAMQP_URL", ""))
    rabbitmq_host: str = os.getenv("RABBITMQ_HOST", "rabbitmq")
    rabbitmq_port: int = int(os.getenv("RABBITMQ_PORT", "5672"))
    rabbitmq_user: str = os.getenv("RABBITMQ_USER", "guest")
    rabbitmq_password: str = os.getenv("RABBITMQ_PASSWORD", "guest")
    environment: str = os.getenv("ENVIRONMENT", "local")
    log_level: str = os.getenv("LOG_LEVEL", "info")

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
