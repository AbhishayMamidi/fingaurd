from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST

http_requests_total = Counter(
    "http_requests_total",
    "Total HTTP requests processed",
    ["method", "endpoint", "status"]
)

http_request_duration_seconds = Histogram(
    "http_request_duration_seconds",
    "HTTP request latency in seconds",
    ["method", "endpoint"],
    buckets=[0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]
)

transactions_created_total = Counter(
    "transactions_created_total",
    "Total transactions created",
    ["type", "category"]
)

fraud_flagged_transactions_total = Counter(
    "fraud_flagged_transactions_total",
    "Total transactions flagged as fraud by transaction service"
)
