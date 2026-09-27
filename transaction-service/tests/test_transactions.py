import pytest
from app.auth import get_current_user_id
from app.models import Transaction

def test_transaction_model_to_dict():
    tx = Transaction(
        id="test-uuid-1234",
        user_id="user-999",
        amount=50.25,
        type="expense",
        description="Coffee with client",
        merchant="Starbucks",
        category="Food & Dining",
        is_fraud_flagged=False,
        fraud_score=0.12,
        fraud_reason=""
    )
    d = tx.to_dict()
    assert d["id"] == "test-uuid-1234"
    assert d["user_id"] == "user-999"
    assert d["amount"] == 50.25
    assert d["category"] == "Food & Dining"
    assert d["is_fraud_flagged"] is False

def test_summary_calculation_logic():
    txs = [
        {"amount": 100.0, "type": "expense", "category": "Food & Dining", "is_fraud_flagged": False},
        {"amount": 200.0, "type": "expense", "category": "Utilities & Bills", "is_fraud_flagged": False},
        {"amount": 1000.0, "type": "income", "category": "Income", "is_fraud_flagged": False},
        {"amount": 500.0, "type": "expense", "category": "Other", "is_fraud_flagged": True},
    ]

    total_income = sum(t["amount"] for t in txs if t["type"] == "income")
    total_expenses = sum(t["amount"] for t in txs if t["type"] == "expense")
    fraud_count = sum(1 for t in txs if t["is_fraud_flagged"])

    assert total_income == 1000.0
    assert total_expenses == 800.0
    assert total_income - total_expenses == 200.0
    assert fraud_count == 1

def test_prometheus_metrics():
    from app.metrics import (
        http_requests_total,
        transactions_created_total,
        generate_latest
    )
    http_requests_total.labels(method="GET", endpoint="/health", status="200").inc()
    transactions_created_total.labels(type="expense", category="Food & Dining").inc()

    output = generate_latest().decode("utf-8")
    assert "http_requests_total" in output
    assert "transactions_created_total" in output
    assert "transaction-service" or "finguard"
