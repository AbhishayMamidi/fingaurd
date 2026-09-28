import json
import logging
import time
import pika
from app.config import settings

logger = logging.getLogger("transaction-publisher")

class RabbitMQPublisher:
    def __init__(self):
        self.connection = None
        self.channel = None
        self.is_connected = False

    def connect(self):
        try:
            if settings.rabbitmq_url:
                logger.info("Connecting publisher to RabbitMQ using URL connection string (CloudAMQP/TLS supported)...")
                parameters = pika.URLParameters(settings.rabbitmq_url)
            else:
                logger.info(f"Connecting publisher to RabbitMQ at {settings.rabbitmq_host}:{settings.rabbitmq_port}...")
                credentials = pika.PlainCredentials(settings.rabbitmq_user, settings.rabbitmq_password)
                parameters = pika.ConnectionParameters(
                    host=settings.rabbitmq_host,
                    port=settings.rabbitmq_port,
                    credentials=credentials,
                    heartbeat=30,
                    blocked_connection_timeout=30,
                )
            self.connection = pika.BlockingConnection(parameters)
            self.channel = self.connection.channel()

            self.channel.exchange_declare(
                exchange="finguard.events",
                exchange_type="topic",
                durable=True
            )
            self.is_connected = True
            logger.info("RabbitMQ Publisher connected successfully.")
        except Exception as e:
            self.is_connected = False
            logger.warning(f"Could not connect to RabbitMQ for publishing: {e}")

    def publish_event(self, routing_key: str, event_data: dict):
        if not self.is_connected or not self.channel or self.channel.is_closed:
            self.connect()

        if self.is_connected and self.channel:
            try:
                body = json.dumps(event_data)
                self.channel.basic_publish(
                    exchange="finguard.events",
                    routing_key=routing_key,
                    body=body,
                    properties=pika.BasicProperties(
                        delivery_mode=2,  # Persistent message
                        content_type="application/json",
                        timestamp=int(time.time()),
                    )
                )
                logger.info(f"Published event '{routing_key}' for tx_id={event_data.get('transaction_id')}")
            except Exception as e:
                logger.error(f"Failed to publish event to RabbitMQ: {e}")
                self.is_connected = False
        else:
            logger.warning(f"RabbitMQ publisher disconnected; skipped message delivery for '{routing_key}'")

publisher = RabbitMQPublisher()
