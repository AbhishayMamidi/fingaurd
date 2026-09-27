# FinGuard Categorization Service

The **Categorization Service** is a lightweight, high-performance microservice that inspects transactions and automatically determines spending categories (Food & Dining, Housing, Utilities, Transportation, Entertainment, etc.) using a rule-based engine and keyword extraction.

## Architecture & Tech Stack
- **Framework:** Python 3.11 + FastAPI + Uvicorn
- **Messaging:** RabbitMQ Consumer (listens for `transaction.created` events on queue `q.categorization`)
- **Port:** 5003

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Service health and RabbitMQ connection status |
| `POST` | `/api/categories/categorize` | Categorize transaction synchronously |
| `GET` | `/api/categories/rules` | List all active categorization rules |
| `POST` | `/api/categories/rules` | Add custom category matching rules |

## Example Request
```json
POST /api/categories/categorize
{
  "merchant": "Trader Joe's",
  "description": "Weekly grocery run",
  "amount": 84.50,
  "type": "expense"
}
```

Response:
```json
{
  "category": "Food & Dining",
  "confidence": 0.88,
  "rule_matched": "Keyword matched: 'grocery'",
  "icon": "Utensils"
}
```
