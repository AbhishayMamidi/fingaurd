import pytest
import datetime
from app.model import FraudDetector, DISCLAIMER

def test_normal_transaction():
    detector = FraudDetector()
    normal_time = datetime.datetime(2026, 9, 27, 14, 30, 0, tzinfo=datetime.timezone.utc)
    res = detector.evaluate(
        amount=42.50,
        description="Grocery shopping",
        merchant="Safeway",
        timestamp=normal_time,
        tx_type="expense"
    )
    assert res["is_fraud"] is False
    assert res["fraud_score"] < 0.60
    assert res["risk_level"] == "LOW"
    assert res["disclaimer"] == DISCLAIMER

def test_extreme_amount_transaction():
    detector = FraudDetector()
    res = detector.evaluate(
        amount=8500.0,
        description="Unusual high value purchase",
        merchant="Luxury Boutique",
        tx_type="expense"
    )
    assert res["is_fraud"] is True
    assert res["fraud_score"] >= 0.70
    assert res["risk_level"] == "HIGH"
    assert any("elevated" in r.lower() or "anomaly" in r.lower() for r in res["reasons"])

def test_high_risk_keyword_trigger():
    detector = FraudDetector()
    res = detector.evaluate(
        amount=450.0,
        description="Withdrawal to offshore wire service",
        merchant="Crypto Tumbler Global",
        tx_type="expense"
    )
    assert res["is_fraud"] is True
    assert res["risk_level"] == "HIGH"
    assert any("indicator" in r.lower() for r in res["reasons"])

def test_income_transaction_not_flagged():
    detector = FraudDetector()
    res = detector.evaluate(
        amount=5000.0,
        description="Bi-weekly executive payroll",
        merchant="Corporation HR",
        tx_type="income"
    )
    assert res["is_fraud"] is False
    assert res["risk_level"] == "LOW"

def test_prometheus_metrics():
    from app.metrics import (
        http_requests_total,
        fraud_checks_total,
        fraud_score_distribution,
        generate_latest
    )
    http_requests_total.labels(method="POST", endpoint="/detect", status="200").inc()
    fraud_checks_total.labels(is_fraud="True", risk_level="HIGH").inc()
    fraud_score_distribution.observe(0.85)

    output = generate_latest().decode("utf-8")
    assert "http_requests_total" in output
    assert "fraud_checks_total" in output
    assert "fraud_score_distribution" in output
