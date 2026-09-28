# FinGuard — Render Cloud Deployment Audit Report

**Report Date:** 2026-09-28  
**Project:** FinGuard Personal Finance & Fraud Detection Platform  
**Target Environment:** Render Cloud Platform (HTTPS Public Deployment)  
**Git Remote:** `https://github.com/AbhishayMamidi/fingaurd.git`  
**Git Branch:** `main`  
**Current Commit:** `0fb2270a9c4ec3cd48cb3e7dcd1e39ae4dc59e8c`  
**Audit Status:** COMPLETE — READY FOR CLOUD IMPLEMENTATION  

---

## 1. Executive Summary

An independent, rigorous audit of the FinGuard codebase was conducted to evaluate cloud-readiness for deployment on Render. FinGuard is a microservices architecture consisting of a React/Vite frontend, an Nginx API Gateway, five backend microservices (Node.js and Python FastAPI), PostgreSQL database storage, and a RabbitMQ asynchronous event broker.

All seven GitHub Actions CI workflows are passing with zero HIGH/CRITICAL Trivy vulnerabilities following the recent `libexpat` security remediation (`2.8.5-r0`). The local container and Kubernetes stacks are fully verified and operational.

To deploy FinGuard to a public HTTPS website on Render while preserving its microservice architecture, fraud detection, authentication, transaction management, and budget evaluation capabilities, the audit identified key adjustments needed for dynamic port binding (`$PORT`), cloud PostgreSQL connection strings (`DATABASE_URL`), cloud RabbitMQ AMQPS support (`RABBITMQ_URL`), and gateway/frontend routing.

---

## 2. Git and Repository State

| Property | Audited Value | Status |
| :--- | :--- | :--- |
| **Branch** | `main` | Verified up to date with `origin/main` |
| **Commit** | `0fb2270a9c4ec3cd48cb3e7dcd1e39ae4dc59e8c` | Verified |
| **Working Tree** | Clean | Verified |
| **Render Artifacts** | None (`render.yaml` absent) | Greenfield Render Blueprint required |
| **Local Artifacts** | Preserved (Docker Compose, K8s manifests, Grafana, ArgoCD) | Unaffected by Render deployment |

---

## 3. Microservice Inventory & Readiness Matrix

| Service | Runtime & Stack | Port | Health Endpoint | Database / Queue Dependency | Render Cloud Compatibility Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`api-gateway`** | Nginx Alpine (Reverse Proxy) | `80` (Local: `8080`) | `GET /health` | Upstream services | Needs dynamic `$PORT` binding support and template-driven upstream host configuration. |
| **`frontend`** | React 18, Vite, TailwindCSS (Nginx Alpine) | `80` | N/A (Static SPA) | API Gateway | Needs `import.meta.env.VITE_API_URL` to support direct cloud gateway targeting and Render Static Site SPA rewrite rules (`/* -> /index.html`). |
| **`auth-service`** | Node.js 20, Express, `pg` | `5001` | `GET /health` | PostgreSQL (`users`) | Needs `PORT` env check and `DATABASE_URL` support (with SSL mode) alongside discrete parameters. |
| **`transaction-service`** | Python 3.11, FastAPI, SQLAlchemy | `5002` | `GET /health` | PostgreSQL (`transactions`), RabbitMQ | Needs `PORT` env check, `DATABASE_URL` connection object support, and `RABBITMQ_URL` (`amqps://`) support in `publisher.py`. |
| **`categorization-service`** | Python 3.11, FastAPI, Rule Engine | `5003` | `GET /health` | RabbitMQ | Needs `PORT` env check and `RABBITMQ_URL` support for event consumption. Runs standalone if RabbitMQ is delayed. |
| **`fraud-detection-service`** | Python 3.11, FastAPI, `scikit-learn` Isolation Forest | `5004` | `GET /health`, `GET /model-info` | RabbitMQ | Self-contained synthetic model training on startup (<50ms). Needs `PORT` env check and `RABBITMQ_URL` support. |
| **`budget-alert-service`** | Node.js 20, Express, `amqplib`, `pg` | `5005` | `GET /health` | PostgreSQL (`budgets`, `alerts`), RabbitMQ | Needs `PORT` env check, `DATABASE_URL` support, and `RABBITMQ_URL` (`amqps://`) support in `consumer.js`. |

---

## 4. Key Architectural Findings & Solutions for Render

### 4.1. Dynamic Port Binding (`$PORT`)
* **Finding:** Render assigns a dynamic port via the `$PORT` environment variable to Web Services. Currently, service Dockerfiles and startup scripts hardcode fixed internal ports (e.g. `5001`, `5002`, `80`).
* **Solution:** 
  - For Node.js services (`auth-service`, `budget-alert-service`): update configuration to resolve `process.env.PORT || process.env.AUTH_PORT || 5001`.
  - For Python services (`transaction-service`, `categorization-service`, `fraud-detection-service`): update Uvicorn startup commands or wrapper scripts to bind to `0.0.0.0:${PORT:-<default_port>}`.
  - For `api-gateway`: configure Nginx template substitution (`/etc/nginx/templates/default.conf.template`) so Nginx dynamically listens on `${PORT:-80}`.

### 4.2. Database Architecture (Render Managed PostgreSQL)
* **Finding:** Locally, PostgreSQL initializes three distinct databases (`finguard_auth`, `finguard_transactions`, `finguard_budgets`) via `init-databases.sh`. Render Managed PostgreSQL provides a single database instance with a single `DATABASE_URL`.
* **Verification:** Inspection of microservice tables reveals zero naming collisions:
  - `auth-service`: `users`
  - `transaction-service`: `transactions`
  - `budget-alert-service`: `budgets`, `alerts`, `processed_events`
* **Solution:** Enable all three database-backed microservices to connect to a single shared Render PostgreSQL database instance via `DATABASE_URL`, or separate databases if configured. Add idempotent `DATABASE_URL` parsing with SSL support (`sslmode=require` or `ssl: { rejectUnauthorized: false }`) in `pg` and SQLAlchemy.

### 4.3. Message Broker (RabbitMQ)
* **Finding:** Render does not provide a native managed RabbitMQ service.
* **Solution:** RabbitMQ can be hosted externally using CloudAMQP's free "Little Lemur" tier (providing a free `amqps://...` connection with TLS) or persistent container hosting. We will update `publisher.py` and `consumer.js` to parse `RABBITMQ_URL` using `pika.URLParameters` and `amqplib.connect(url)`, fully supporting secure TLS `amqps://` protocol strings while gracefully degrading with retry loops if the broker is initializing.

### 4.4. Ingress & Routing (Frontend vs. API Gateway)
* **Finding:** The React frontend expects API endpoints at `/api/...`.
* **Solution:** Render supports two valid architectures:
  - **Architecture 1 (Decoupled Cloud Native - Recommended):** Frontend deployed as a Render **Static Site** (100% free tier, CDN cached, automatic SSL, SPA routing rewrite `/* -> /index.html`). The API Gateway or backend microservices are deployed as Render **Web Services**. The frontend calls `https://<api-gateway>.onrender.com/api` configured via `VITE_API_URL`.
  - **Architecture 2 (Unified Gateway Ingress):** `api-gateway` acts as the single public entrypoint Web Service routing `/` to the frontend and `/api/*` to private microservices over Render private networking (`http://auth-service:5001`, etc.).

---

## 5. Security and Compliance Findings

1. **Secrets Management:** No secrets, `.env` files, or passwords shall be committed to `render.yaml` or Git. All secrets (`JWT_SECRET`, database passwords, RabbitMQ credentials) will use Render's native secret environment variable management (`generateValue: true` or manual dashboard entry).
2. **CORS:** All backend microservices already have CORS configured with permissive options for frontend requests (`allow_origins=["*"]`).
3. **Database Security:** Cloud PostgreSQL connections require SSL/TLS in transit. All drivers (`pg`, `psycopg2`) must enforce SSL when `DATABASE_URL` indicates a remote host.
4. **Vulnerability Scan Status:** 0 HIGH / 0 CRITICAL CVEs across all production Docker images.

---

## 6. Audit Conclusion & Next Steps

The FinGuard repository is in prime condition. The codebase is clean, well-tested, and ready for Render compatibility enhancements.

Proceeding directly to **Phase B** (Architecture Design) and **Phase C** (Service Refactoring).
