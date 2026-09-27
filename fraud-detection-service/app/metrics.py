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
    buckets=[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5]
)

fraud_checks_total = Counter(
    "fraud_checks_total",
    "Total fraud detection evaluations",
    ["is_fraud", "risk_level"]
)

fraud_score_distribution = Histogram(
    "fraud_score_distribution",
    "Distribution of fraud risk scores from model",
    buckets=[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
)
