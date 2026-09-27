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

categorization_requests_total = Counter(
    "categorization_requests_total",
    "Total transaction categorization requests evaluated",
    ["category", "rule_matched"]
)

categorization_confidence = Histogram(
    "categorization_confidence",
    "Categorization rule confidence score",
    buckets=[0.1, 0.3, 0.5, 0.7, 0.8, 0.9, 0.95, 1.0]
)
