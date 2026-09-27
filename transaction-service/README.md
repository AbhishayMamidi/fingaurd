# FinGuard Transaction Service

The **Transaction Service** is the core transaction processing hub for FinGuard. It manages user transaction records, orchestrates categorization and fraud scoring, and publishes asynchronous transaction events to RabbitMQ.

## Architecture & Tech Stack
- **Framework:** Python 3.11 + FastAPI + SQLAlchemy
- **Database:** PostgreSQL (`finguard_transactions` database, table `transactions`)
- **Messaging:** RabbitMQ Producer (publishes to exchange `finguard.events`, routing key `transaction.created`, `transaction.updated`, `transaction.deleted`)
- **Port:** 5002

## Data Isolation & Security
All transaction queries and mutations validate the user identity from the signed JWT Bearer token in the `Authorization` header. Records are strictly partitioned by `user_id`.

## API Endpoints

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/health` | Service health, DB & RabbitMQ connection | No |
| `GET` | `/api/transactions` | Filtered list of user transactions | Yes |
| `POST` | `/api/transactions` | Create new transaction | Yes |
| `GET` | `/api/transactions/summary` | Aggregate spending and category summary | Yes |
| `POST` | `/api/transactions/seed-demo` | Populate labeled synthetic demo records | Yes |
| `GET` | `/api/transactions/{id}` | Retrieve specific transaction | Yes |
| `PUT` | `/api/transactions/{id}` | Update transaction details | Yes |
| `DELETE` | `/api/transactions/{id}` | Delete transaction | Yes |

## Example Request
```bash
curl -X POST http://localhost:8080/api/transactions \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 75.50,
    "description": "Weekly grocery shopping",
    "merchant": "Trader Joe'\''s",
    "type": "expense"
  }'
```
