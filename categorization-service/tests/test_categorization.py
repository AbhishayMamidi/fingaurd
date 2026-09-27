import pytest
from app.engine import CategorizationEngine

def test_food_categorization():
    engine = CategorizationEngine()
    result = engine.categorize(description="Latte and croissant", merchant="Starbucks")
    assert result["category"] == "Food & Dining"
    assert result["confidence"] > 0.8

def test_utilities_categorization():
    engine = CategorizationEngine()
    result = engine.categorize(description="Monthly electricity power bill", merchant="City Power")
    assert result["category"] == "Utilities & Bills"
    assert result["confidence"] > 0.8

def test_income_categorization():
    engine = CategorizationEngine()
    result = engine.categorize(description="Bi-weekly payroll direct deposit", merchant="Tech Corp")
    assert result["category"] == "Income"
    assert result["confidence"] > 0.8

def test_housing_categorization():
    engine = CategorizationEngine()
    result = engine.categorize(description="Monthly apartment rent payment", merchant="Oakridge Realty")
    assert result["category"] == "Housing & Rent"
    assert result["confidence"] > 0.8

def test_fallback_other():
    engine = CategorizationEngine()
    result = engine.categorize(description="Unknown random item 98712", merchant="XYZ Mystery Store")
    assert result["category"] == "Other"
    assert result["confidence"] == 0.50

def test_custom_rule():
    engine = CategorizationEngine()
    engine.add_rule(category="Hobbies", keyword="guitar", icon="Music")
    result = engine.categorize(description="Bought guitar strings", merchant="Music Store")
    assert result["category"] == "Hobbies"
    assert result["icon"] == "Music"

def test_prometheus_metrics():
    from app.metrics import (
        http_requests_total,
        categorization_requests_total,
        generate_latest
    )
    http_requests_total.labels(method="POST", endpoint="/categorize", status="200").inc()
    categorization_requests_total.labels(category="Food & Dining", rule_matched="keyword_match").inc()

    output = generate_latest().decode("utf-8")
    assert "http_requests_total" in output
    assert "categorization_requests_total" in output
