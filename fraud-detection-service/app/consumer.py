import json
import logging
import threading
import time
import pika
from app.config import settings
from app.model import fraud_detector

logger = logging.getLogger("fraud-consumer")

class FraudRabbitMQConsumer:
    def __init__(self):
        self.connected = False
        self.channel = None
        self.connection = None
        self.thread = None
        self.should_run = True

    def start_background(self):
        self.thread = threading.Thread(target=self._run, daemon=True)
        self.thread.start()

    def _run(self):
        while self.should_run:
            try:
                logger.info(f"Connecting to RabbitMQ at {settings.rabbitmq_host}:{settings.rabbitmq_port}...")
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

                # Declare exchanges
                self.channel.exchange_declare(
                    exchange="finguard.events",
                    exchange_type="topic",
                    durable=True
                )
                self.channel.exchange_declare(
                    exchange="finguard.dlx",
                    exchange_type="direct",
                    durable=True
                )

                # Queue with DLX
                args = {
                    "x-dead-letter-exchange": "finguard.dlx",
                    "x-dead-letter-routing-key": "dlx.fraud",
                }
                self.channel.queue_declare(queue="q.fraud_detection", durable=True, arguments=args)
                self.channel.queue_bind(
                    queue="q.fraud_detection",
                    exchange="finguard.events",
                    routing_key="transaction.created"
                )

                self.connected = True
                logger.info("RabbitMQ Consumer connected. Listening for 'transaction.created' events on 'q.fraud_detection'...")

                self.channel.basic_qos(prefetch_count=1)
                self.channel.basic_consume(
                    queue="q.fraud_detection",
                    on_message_callback=self._on_message
                )
                self.channel.start_consuming()

            except Exception as err:
                self.connected = False
                logger.warning(f"RabbitMQ fraud consumer connection error: {err}. Retrying in 5 seconds...")
                time.sleep(5)

    def _on_message(self, ch, method, properties, body):
        try:
            data = json.loads(body.decode("utf-8"))
            logger.info(f"Evaluating fraud risk for tx_id={data.get('transaction_id')}")

            evaluation = fraud_detector.evaluate(
                amount=float(data.get("amount", 0.0)),
                description=data.get("description", ""),
                merchant=data.get("merchant", ""),
                tx_type=data.get("type", "expense")
            )

            if evaluation["is_fraud"]:
                logger.warning(
                    f"FRAUD DETECTED for tx_id={data.get('transaction_id')} "
                    f"score={evaluation['fraud_score']} reasons={evaluation['reasons']}"
                )

            ch.basic_ack(delivery_tag=method.delivery_tag)
        except Exception as e:
            logger.error(f"Error processing fraud evaluation event: {e}")
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

    def stop(self):
        self.should_run = False
        if self.connection and not self.connection.is_closed:
            self.connection.close()

fraud_consumer = FraudRabbitMQConsumer()
