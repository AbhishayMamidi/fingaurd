# FinGuard Fraud Detection Service

The **Fraud Detection Service** analyzes transaction anomalies and potential fraud using an unsupervised **Isolation Forest** model (`scikit-learn`) coupled with fintech heuristic safety rules.

> **DISCLAIMER:**  
> This service provides an experimental fraud detection model designed for demonstration and educational testing. It is **not** suitable or certified for making real financial decisions or processing real payment authorizations.

## Architecture & Tech Stack
- **Framework:** Python 3.11 + FastAPI + Uvicorn
- **Machine Learning:** `scikit-learn` Isolation Forest + `numpy`
- **Messaging:** RabbitMQ Consumer (listens to `transaction.created` on queue `q.fraud_detection`)
- **Port:** 5004

## Features & Detection Pipeline
1. **Feature Vector Extraction:** Extracts transaction amount, hour of day, weekend indicator, and merchant risk factor.
2. **Isolation Forest Anomaly Scoring:** Measures deviation from baseline consumer spending habits.
3. **Heuristic Safeguards:**
   - Detects high-risk keywords (e.g., crypto tumbler, offshore wire, darknet).
   - Detects extreme single-transaction spend spikes (> $1,500 / $3,000).
   - Evaluates off-hour high-value patterns (e.g. 3 AM transactions).
4. **Structured Output:** Produces `is_fraud`, `fraud_score` (0.0 to 1.0), `risk_level` (LOW, MEDIUM, HIGH), and diagnostic reasons.

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Service health, model status, and RabbitMQ state |
| `GET` | `/api/fraud/model-info` | Inspection metadata for the ML model |
| `POST` | `/api/fraud/detect` | Synchronous transaction evaluation |

## Example Request
```json
POST /api/fraud/detect
{
  "amount": 4200.00,
  "merchant": "Global Electronics Overseas",
  "description": "Rush international transfer",
  "type": "expense"
}
```

Response:
```json
{
  "is_fraud": true,
  "fraud_score": 0.88,
  "risk_level": "HIGH",
  "reasons": [
    "Significantly elevated single-transaction volume ($4,200.00)"
  ],
  "disclaimer": "Experimental fraud detection model for demonstration purposes only. Not suitable for real financial decisions.",
  "model_version": "v1.0-isolation-forest-experimental"
}
```
