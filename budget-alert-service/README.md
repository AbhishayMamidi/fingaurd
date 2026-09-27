# FinGuard Budget and Alert Service

The **Budget and Alert Service** tracks category-specific monthly spending allowances, processes asynchronous transaction events via RabbitMQ, triggers threshold alerts (80% warning and 100% exceeded), and records high-risk fraud alerts.

## Architecture & Tech Stack
- **Framework:** Node.js + Express
- **Database:** PostgreSQL (`finguard_budgets` database, tables `budgets`, `alerts`, `processed_events`)
- **Messaging:** RabbitMQ Consumer (`q.budget_evaluation` queue bound to `transaction.*` topic)
- **Reliability:** Idempotent event processing via `processed_events` table and Dead Letter Exchange (`finguard.dlx`).
- **Port:** 5005

## API Endpoints

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/health` | Service health, DB & RabbitMQ connectivity | No |
| `GET` | `/api/budgets` | Fetch current month budgets with spending progress | Yes |
| `POST` | `/api/budgets` | Set or update monthly budget for a category | Yes |
| `DELETE` | `/api/budgets/:id` | Delete a budget record | Yes |
| `GET` | `/api/alerts` | List all alerts (budget warnings, fraud alerts) | Yes |
| `PATCH` | `/api/alerts/:id/read` | Mark alert as read | Yes |
| `DELETE` | `/api/alerts/:id` | Dismiss/delete an alert | Yes |
