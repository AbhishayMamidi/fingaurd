# FinGuard — Render Environment Variables & Secrets Reference

This document provides a comprehensive audit of all environment variables across FinGuard's microservices when deployed on the Render cloud platform.

> **CRITICAL SECURITY RULE:**  
> Never commit actual credentials, secret tokens, or passwords to Git or `render.yaml`. Use Render's native secret generation and dashboard inputs.

---

## 1. Environment Variable Classification Matrix

| Service | Variable Name | Purpose | Source / Management | Safe to Commit? |
| :--- | :--- | :--- | :--- | :--- |
| **`finguard-frontend`** | `VITE_API_URL` | Public API Gateway base URL | Hardcoded in `render.yaml` (`https://finguard-gateway.onrender.com/api`) | **YES** |
| **`finguard-gateway`** | `PORT` | Dynamic listening port | Injected automatically by Render runtime | **YES** |
| | `AUTH_SERVICE_HOST` | Internal hostname for auth service | Wired via `fromService.finguard-auth.host` | **YES** |
| | `TRANSACTION_SERVICE_HOST` | Internal hostname for transaction service | Wired via `fromService.finguard-transactions.host` | **YES** |
| | `CATEGORIZATION_SERVICE_HOST` | Internal hostname for categorization service | Wired via `fromService.finguard-categorization.host` | **YES** |
| | `FRAUD_SERVICE_HOST` | Internal hostname for fraud service | Wired via `fromService.finguard-fraud.host` | **YES** |
| | `BUDGET_SERVICE_HOST` | Internal hostname for budget service | Wired via `fromService.finguard-budget.host` | **YES** |
| **`finguard-auth`** | `NODE_ENV` | Runtime environment | `production` | **YES** |
| | `JWT_SECRET` | Secret key for signing Auth JWTs | Render auto-generates (`generateValue: true`) | **NO** (Managed by Render) |
| | `JWT_EXPIRES_IN` | Token expiration duration | `24h` | **YES** |
| | `DATABASE_URL` | PostgreSQL connection string | Wired via `fromDatabase.finguard-postgres.connectionString` | **NO** (Managed by Render) |
| **`finguard-transactions`**| `ENVIRONMENT` | Runtime environment | `production` | **YES** |
| | `JWT_SECRET` | Secret key to verify incoming Auth JWTs | Copied from `finguard-auth` via `fromService` | **NO** (Managed by Render) |
| | `DATABASE_URL` | PostgreSQL connection string | Wired via `fromDatabase.finguard-postgres.connectionString` | **NO** (Managed by Render) |
| | `CATEGORIZATION_SERVICE_URL` | Internal HTTP address of categorization | `http://finguard-categorization:5003` | **YES** |
| | `FRAUD_SERVICE_URL` | Internal HTTP address of fraud service | `http://finguard-fraud:5004` | **YES** |
| | `RABBITMQ_URL` | AMQPS connection string for CloudAMQP | Manual Render Dashboard input (`sync: false`) | **NO** (Secret / Dashboard only) |
| **`finguard-categorization`**| `ENVIRONMENT` | Runtime environment | `production` | **YES** |
| | `RABBITMQ_URL` | AMQPS connection string for CloudAMQP | Manual Render Dashboard input (`sync: false`) | **NO** (Secret / Dashboard only) |
| **`finguard-fraud`** | `ENVIRONMENT` | Runtime environment | `production` | **YES** |
| | `RABBITMQ_URL` | AMQPS connection string for CloudAMQP | Manual Render Dashboard input (`sync: false`) | **NO** (Secret / Dashboard only) |
| **`finguard-budget`** | `NODE_ENV` | Runtime environment | `production` | **YES** |
| | `JWT_SECRET` | Secret key to verify incoming Auth JWTs | Copied from `finguard-auth` via `fromService` | **NO** (Managed by Render) |
| | `DATABASE_URL` | PostgreSQL connection string | Wired via `fromDatabase.finguard-postgres.connectionString` | **NO** (Managed by Render) |
| | `TRANSACTION_SERVICE_URL` | Internal HTTP address of transaction service | `http://finguard-transactions:5002` | **YES** |
| | `RABBITMQ_URL` | AMQPS connection string for CloudAMQP | Manual Render Dashboard input (`sync: false`) | **NO** (Secret / Dashboard only) |

---

## 2. CloudAMQP / External RabbitMQ Configuration

To provision a free RabbitMQ instance:
1. Register a free account at [CloudAMQP](https://www.cloudamqp.com/).
2. Create a new instance on the free **"Little Lemur"** plan (0 USD/month).
3. Copy the **AMQP URL** (format: `amqps://<user>:<password>@<host>/<vhost>`).
4. When deploying the Blueprint in Render, enter this URL into the `RABBITMQ_URL` field.
