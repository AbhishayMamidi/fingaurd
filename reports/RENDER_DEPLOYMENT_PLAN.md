# FinGuard — Render Cloud Deployment Plan

**Date:** 2026-09-28  
**Architecture:** Microservices + Ingress API Gateway + Static Single Page Application  
**Target Platform:** Render Cloud Platform (`https://render.com`)  
**Deployment Tool:** Render Blueprints (`render.yaml` Infrastructure-as-Code)  

---

## 1. System Architecture Overview

FinGuard is deployed to Render using a decoupled, production-grade cloud topology designed for maximum reliability, security, and cost efficiency.

```
Internet (Users)
    │
    ├─── HTTPS ───> [finguard-frontend] (Render Static Site on Global CDN)
    │                     │
    │                     ▼ (REST API / JSON calls via HTTPS)
    └─── HTTPS ───> [finguard-gateway] (Render Web Service: Nginx Reverse Proxy, dynamic $PORT)
                          │
          ┌───────────────┼───────────────┬────────────────┬───────────────┐
          │ (Internal DNS)│ (Internal DNS)│ (Internal DNS) │ (Internal DNS)│ (Internal DNS)
          ▼               ▼               ▼                ▼               ▼
   [finguard-auth] [finguard-tx]   [finguard-cat]   [finguard-fraud] [finguard-budget]
      Port: 5001      Port: 5002      Port: 5003       Port: 5004       Port: 5005
          │               │                                                │
          └───────────────┼────────────────────────────────────────────────┘
                          ▼
            [finguard-postgres] (Render Managed PostgreSQL Database)
                          ▲
                          │
            [External RabbitMQ / CloudAMQP] (AMQPS TLS Event Broker)
                          │ (transaction.created -> q.budget_evaluation)
```

---

## 2. Component Specifications

### 2.1. Frontend (`finguard-frontend`)
* **Render Type:** `static`
* **Build System:** Vite 5.4.21, Node.js 20
* **Build Command:** `npm install && npm run build`
* **Publish Directory:** `dist`
* **Routing:** Single Page Application (SPA) catch-all rewrite rule (`/* -> /index.html`)
* **API Target:** Configured via `VITE_API_URL=https://finguard-gateway.onrender.com/api`
* **Cost:** Free tier (unlimited traffic on Render CDN, zero spin-down latency)

### 2.2. Ingress API Gateway (`finguard-gateway`)
* **Render Type:** `web` (Docker Runtime)
* **Image Base:** `nginx:alpine` with `libexpat` security patch (CVE-2026-93990 resolved)
* **Entrypoint:** Dynamic `$PORT` binding script (`/docker-entrypoint.sh`)
* **Health Check:** `GET /health` -> `200 OK`
* **Routing Rules:**
  - `/api/auth/*` -> `http://finguard-auth:5001/api/auth/*`
  - `/api/transactions/*` -> `http://finguard-transactions:5002/api/transactions/*`
  - `/api/categories/*` -> `http://finguard-categorization:5003/api/categories/*`
  - `/api/fraud/*` -> `http://finguard-fraud:5004/api/fraud/*`
  - `/api/budgets/*` & `/api/alerts/*` -> `http://finguard-budget:5005/api/*`
  - `/health` -> Gateway status

### 2.3. Authentication Microservice (`finguard-auth`)
* **Render Type:** `web` (Docker Runtime, Node.js 20 Express)
* **Database Connection:** `DATABASE_URL` with SSL mode enabled
* **JWT Token Security:** Secret generated automatically by Render (`generateValue: true`)

### 2.4. Transaction Microservice (`finguard-transactions`)
* **Render Type:** `web` (Docker Runtime, Python 3.11 FastAPI + SQLAlchemy)
* **Database Connection:** `DATABASE_URL` (mapped to `postgresql+psycopg2://`)
* **Event Publishing:** Topic exchange `finguard.events`, routing key `transaction.created` via `RABBITMQ_URL` (`amqps://`)

### 2.5. Categorization Microservice (`finguard-categorization`)
* **Render Type:** `web` (Docker Runtime, Python 3.11 FastAPI)
* **Engine:** In-memory deterministic rule engine for merchant and keyword parsing
* **Async Consumer:** Threaded RabbitMQ consumer for asynchronous event categorization

### 2.6. Fraud Detection Microservice (`finguard-fraud`)
* **Render Type:** `web` (Docker Runtime, Python 3.11 FastAPI + scikit-learn)
* **Model:** Isolation Forest anomaly detector + heuristic financial indicators
* **Training & Startup:** Synthetic baseline trained in memory on startup (<50ms). Zero network latency for model artifacts.

### 2.7. Budget & Alert Microservice (`finguard-budget`)
* **Render Type:** `web` (Docker Runtime, Node.js 20 Express)
* **Database Connection:** `DATABASE_URL` with SSL
* **Async Consumer:** Durable queue `q.budget_evaluation` bound to `finguard.events` with dead-letter exchange `finguard.dlx`

### 2.8. Database (`finguard-postgres`)
* **Render Type:** Managed PostgreSQL
* **Plan:** Free tier (1 GB storage, SSL enabled)
* **Access Control:** Render Private Network

### 2.9. Message Broker (RabbitMQ)
* **Provider:** CloudAMQP (Free "Little Lemur" tier) or custom hosted broker
* **Protocol:** `amqps://` (TLS encrypted port 5671)
* **Configuration:** Managed via `RABBITMQ_URL` in Render Dashboard (`sync: false`)

---

## 3. Deployment Phases & Execution Order

1. **Pre-flight Validation:** Run all local unit tests, Docker builds, and E2E integration tests.
2. **GitHub Synchronization:** User reviews and authorizes Git commit and push to `origin/main`.
3. **Render Blueprint Sync:** User opens Render Dashboard, selects "New Blueprint Instance", and links `AbhishayMamidi/fingaurd`.
4. **Environment Configuration:** Set `RABBITMQ_URL` in the Render dashboard prompt.
5. **Database Initialization:** Idempotent schema initialization runs automatically on service startup or via `scripts/init_render_db.py`.
6. **Live Verification:** E2E smoke tests executed against the live public HTTPS endpoint.
