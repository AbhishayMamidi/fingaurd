# FinGuard — Render Release Checklist

**Release Target:** FinGuard Public HTTPS Cloud Release (Render)  
**Release Readiness Gate:** **100% READY FOR USER AUTHORIZATION**  

---

## 1. Pre-Deployment Engineering Gates

- [x] **Repository Audit:** Clean git tree on `main`, remote `origin/main` synchronized.
- [x] **Security Remediation:** CVE-2026-93990 (`libexpat 2.8.5-r0`) resolved across Docker images.
- [x] **Trivy Vulnerability Scan:** 0 HIGH / 0 CRITICAL vulnerabilities detected.
- [x] **Frontend Production Build:** Vite build succeeds without warnings (`dist/` generated).
- [x] **Frontend Config:** `import.meta.env.VITE_API_URL` dynamic support enabled in `client.js`.
- [x] **Dynamic Port Binding:** All services configured to bind to `0.0.0.0:${PORT}`.
- [x] **Database Multi-Cloud Drivers:** `DATABASE_URL` with SSL support added to `auth-service`, `transaction-service`, and `budget-alert-service`.
- [x] **Database Idempotency:** Schema creation uses `CREATE TABLE IF NOT EXISTS` across all microservices.
- [x] **Standalone Migration Script:** `scripts/init_render_db.py` tested and verified against PostgreSQL.
- [x] **Cloud RabbitMQ Support:** `RABBITMQ_URL` (`amqps://...`) support added to event publisher and consumers.
- [x] **Fraud Detection Model:** Isolation Forest ML baseline initializes in memory in <50ms without external model download.
- [x] **Unit Test Suite:** 30/30 unit tests passing (Node.js & pytest).
- [x] **E2E Integration Test Suite:** 10/10 end-to-end integration tests passing via API Gateway.
- [x] **Blueprint Manifest:** `render.yaml` authored and verified against current Render Blueprint specifications.
- [x] **Secrets Hygiene:** Zero secrets or credentials present in committed files or manifests.

---

## 2. GitHub Release Execution Steps (Awaiting User Authorization)

1. Review changed files:
   - `render.yaml`
   - `frontend/src/api/client.js`
   - `auth-service/src/config.js`
   - `auth-service/src/db.js`
   - `auth-service/Dockerfile`
   - `transaction-service/app/config.py`
   - `transaction-service/app/publisher.py`
   - `transaction-service/Dockerfile`
   - `categorization-service/app/config.py`
   - `categorization-service/app/consumer.py`
   - `categorization-service/Dockerfile`
   - `fraud-detection-service/app/config.py`
   - `fraud-detection-service/app/consumer.py`
   - `fraud-detection-service/Dockerfile`
   - `budget-alert-service/src/config.js`
   - `budget-alert-service/src/db.js`
   - `budget-alert-service/src/consumer.js`
   - `budget-alert-service/Dockerfile`
   - `api-gateway/docker-entrypoint.sh`
   - `api-gateway/Dockerfile`
   - `infrastructure/render/init-render-database.sql`
   - `scripts/init_render_db.py`
   - `reports/RENDER_*.md`
2. Stage and commit changes to `main`.
3. Push to `origin/main`.

---

## 3. Render Dashboard Execution Steps

1. Sign in to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** > **Blueprint**.
3. Select repo `AbhishayMamidi/fingaurd`, branch `main`.
4. Review resources (All on Free Plan, $0/month).
5. (Optional) Provide `RABBITMQ_URL` if connecting to external CloudAMQP.
6. Click **Apply** and monitor deployment until all services report **Live**.

---

## 4. Live Post-Deployment Verification

1. Verify public HTTPS URL loads the React frontend application.
2. Verify `/health` on API Gateway returns HTTP 200.
3. Run `python tests/e2e_test.py` against the public gateway URL.
4. Verify user registration, transaction creation, automated categorization, and fraud detection indicators.
