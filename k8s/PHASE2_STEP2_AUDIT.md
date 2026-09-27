# Phase 2 Step 2: Forensic Audit & Kubernetes Manifest Verification

**Project:** FinGuard Personal Finance & Fraud Detection Platform  
**Target Environment:** Local Minikube v1.39.0 (Docker Driver) on Windows 11 Pro  
**Node Resource Allocation:** 2 CPUs, 8 GB RAM  
**Audit Date:** September 27, 2026  
**Auditor Status:** Senior DevOps & Kubernetes Infrastructure Engineer  

---

## 1. Files Inspected

A comprehensive forensic audit was performed across the FinGuard repository:

### Core Configuration & Orchestration
- `docker-compose.yml`: Analyzed all 9 container services, healthchecks, dependencies, volume mounts, and network configurations.
- `.env` & `.env.example`: Compared runtime environment variable names and defaults.
- `.gitignore`: Audited Git exclusion rules to guarantee no secrets leak to source control.

### Application Source Code & Dockerfiles
- **API Gateway (`api-gateway/`):**
  - `Dockerfile`: Verified Nginx base image (`nginx:alpine`), exposed port `80`, and health check.
  - `nginx.conf`: Inspected upstream targets (`auth_backend`, `transaction_backend`, `categorization_backend`, `fraud_backend`, `budget_backend`, `frontend_backend`), security headers, and proxy routing rules.
- **Frontend (`frontend/`):**
  - `Dockerfile`: Multi-stage Node.js 20 build -> Nginx Alpine serving static distribution.
  - `nginx.conf`: Single-page application fallback routing (`try_files $uri $uri/ /index.html`).
  - `src/api/client.js`: Confirmed relative API base route (`API_BASE = '/api'`) and lack of hardcoded hostnames.
- **Auth Service (`auth-service/`):**
  - `Dockerfile`: Node.js 20 Alpine, exposed port `5001`.
  - `src/config.js`: Verified environment variable mappings for PostgreSQL and JWT.
  - `src/db.js`: Audited PostgreSQL connection pool and self-initializing schema migration logic.
  - `src/server.js` & `src/routes/auth.js`: Audited `/health` endpoint and authentication routes.
- **Transaction Service (`transaction-service/`):**
  - `Dockerfile`: Python 3.11 slim, exposed port `5002`.
  - `app/config.py`: Verified Pydantic Settings for PostgreSQL, RabbitMQ, and downstream service URLs.
  - `app/database.py`: Audited SQLAlchemy engine initialization and schema migration logic.
  - `app/publisher.py`: Audited RabbitMQ event publishing, topic exchange `finguard.events`, and persistence.
  - `app/main.py`: Inspected `/health` probe, `/categorize`, and `/detect` HTTP client invocations.
- **Categorization Service (`categorization-service/`):**
  - `Dockerfile`: Python 3.11 slim, exposed port `5003`.
  - `app/config.py`: Verified port `5003` and RabbitMQ consumer settings.
  - `app/consumer.py`: Inspected background AMQP consumer, queue `q.categorization`, and dead-letter exchange `finguard.dlx`.
  - `app/main.py`: Verified `/health` and `/categorize` endpoints.
- **Fraud Detection Service (`fraud-detection-service/`):**
  - `Dockerfile`: Python 3.11 slim, exposed port `5004`.
  - `app/config.py`: Verified port `5004` and RabbitMQ consumer settings.
  - `app/consumer.py`: Inspected background AMQP consumer, queue `q.fraud_detection`, and dead-letter exchange `finguard.dlx`.
  - `app/main.py` & `app/model.py`: Verified `/health`, `/detect`, and scikit-learn Isolation Forest model.
- **Budget Alert Service (`budget-alert-service/`):**
  - `Dockerfile`: Node.js 20 Alpine, exposed port `5005`.
  - `src/config.js`: Verified PostgreSQL, RabbitMQ, and `TRANSACTION_SERVICE_URL` settings.
  - `src/db.js`: Audited schema initialization for budgets, alerts, and idempotency tracking.
  - `src/consumer.js`: Inspected queue `q.budget_evaluation` bound to `transaction.*` topic.
  - `src/server.js`: Verified `/health` database check.
- **Database & Messaging Infrastructure:**
  - `infrastructure/local/postgres/init-databases.sh`: Audited multi-database SQL bootstrap logic.
  - `infrastructure/local/postgres/init-databases.sql`: Audited PostgreSQL `\gexec` script.

### Kubernetes Manifests (`k8s/`)
- `00-namespace.yaml`
- `01-configmap.yaml`
- `02-secrets.yaml.example`
- `02-secrets.yaml` (local development copy, Git-ignored)
- `03-postgres.yaml`
- `04-rabbitmq.yaml`
- `05-categorization-service.yaml`
- `06-fraud-detection-service.yaml`
- `07-auth-service.yaml`
- `08-transaction-service.yaml`
- `09-budget-alert-service.yaml`
- `10-frontend.yaml`
- `11-api-gateway.yaml`
- `kustomization.yaml`
- `README.md`

---

## 2. Files Created or Modified

| File | Action | Purpose / Modification |
| :--- | :--- | :--- |
| `k8s/03-postgres.yaml` | **Modified** | Updated `01-init-databases.sh` to POSIX shell standard (`create_db() {`), bound database creation directly to `${POSTGRES_AUTH_DB}`, `${POSTGRES_TRANSACTIONS_DB}`, and `${POSTGRES_BUDGETS_DB}` from `finguard-config`, and added `envFrom: [configMapRef: finguard-config]` to the postgres container. |
| `k8s/02-secrets.yaml.example` | **Verified** | Standardized all required secret keys with explicit placeholders without exposing real credentials. |
| `k8s/02-secrets.yaml` | **Verified** | Confirmed presence in local workspace for dry-run schema validation and verified exclusion in `.gitignore`. |
| `k8s/PHASE2_STEP2_AUDIT.md` | **Created** | Comprehensive forensic audit and verification report. |

---

## 3. Configuration Mismatches Discovered & Corrected

1. **PostgreSQL Init Script Portability:**
   - *Issue Discovered:* In `03-postgres.yaml`, `01-init-databases.sh` used `function create_db()` and hardcoded database strings (`finguard_auth`, `finguard_transactions`, `finguard_budgets`), rather than referencing the environment variables provided in `finguard-config`.
   - *Correction:* Converted to standard POSIX `create_db()` syntax and dynamically parameterised database names using `${POSTGRES_AUTH_DB:-finguard_auth}`, `${POSTGRES_TRANSACTIONS_DB:-finguard_transactions}`, and `${POSTGRES_BUDGETS_DB:-finguard_budgets}`. Added `envFrom: [configMapRef: {name: finguard-config}]` to the postgres container.
2. **PostgreSQL Persistent Storage Ext4 Conflict Prevention:**
   - *Finding:* In standard Kubernetes PVCs, mounting directly to `/var/lib/postgresql/data` can fail or cause issues when ext4 creates a `lost+found` directory in the root.
   - *Verification:* Verified that `PGDATA` is explicitly configured to `/var/lib/postgresql/data/pgdata`, isolating database files into a subfolder on the persistent volume.
3. **Frontend API URL Portability:**
   - *Finding:* Verified that the React frontend uses relative paths (`const API_BASE = '/api'`) with no hardcoded `localhost:8080` URLs. This ensures the frontend functions identically whether accessed via `kubectl port-forward service/api-gateway 8080:80` or via `minikube service api-gateway -n finguard`.
4. **RabbitMQ Multi-Consumer Consistency:**
   - *Finding:* Both Python background consumer threads (`categorization-service`, `fraud-detection-service`) and Node.js consumer (`budget-alert-service`) share the topic exchange `finguard.events` and dead-letter exchange `finguard.dlx`.
   - *Verification:* Verified that all consumer and publisher workloads receive identical `RABBITMQ_HOST`, `RABBITMQ_PORT`, `RABBITMQ_USER`, and `RABBITMQ_PASSWORD` from the unified `finguard-config` ConfigMap and `finguard-secrets` Secret.

---

## 4. Actual Service Names, Ports, DNS Names & Environment References

| Service | Internal Kubernetes DNS | Container Port | Service Type & Port | Environment Source |
| :--- | :--- | :--- | :--- | :--- |
| **api-gateway** | `api-gateway.finguard.svc` | `80` | NodePort (`80:30080`) | N/A (configured via `nginx.conf`) |
| **frontend** | `frontend.finguard.svc` | `80` | ClusterIP (`80`) | N/A (Static distribution in Nginx) |
| **auth-service** | `auth-service.finguard.svc` | `5001` | ClusterIP (`5001`) | ConfigMap: `AUTH_PORT`, `NODE_ENV`, `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_AUTH_DB`, `JWT_EXPIRES_IN`. Secrets: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `JWT_SECRET`. |
| **transaction-service** | `transaction-service.finguard.svc` | `5002` | ClusterIP (`5002`) | ConfigMap: `TRANSACTION_PORT`, `ENVIRONMENT`, `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_TRANSACTIONS_DB`, `RABBITMQ_HOST`, `RABBITMQ_PORT`, `CATEGORIZATION_SERVICE_URL`, `FRAUD_SERVICE_URL`. Secrets: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `RABBITMQ_USER`, `RABBITMQ_PASSWORD`, `JWT_SECRET`. |
| **categorization-service** | `categorization-service.finguard.svc` | `5003` | ClusterIP (`5003`) | ConfigMap: `CATEGORIZATION_PORT`, `ENVIRONMENT`, `RABBITMQ_HOST`, `RABBITMQ_PORT`. Secrets: `RABBITMQ_USER`, `RABBITMQ_PASSWORD`. |
| **fraud-detection-service** | `fraud-detection-service.finguard.svc` | `5004` | ClusterIP (`5004`) | ConfigMap: `FRAUD_PORT`, `ENVIRONMENT`, `RABBITMQ_HOST`, `RABBITMQ_PORT`. Secrets: `RABBITMQ_USER`, `RABBITMQ_PASSWORD`. |
| **budget-alert-service** | `budget-alert-service.finguard.svc` | `5005` | ClusterIP (`5005`) | ConfigMap: `BUDGET_PORT`, `NODE_ENV`, `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_BUDGETS_DB`, `RABBITMQ_HOST`, `RABBITMQ_PORT`, `TRANSACTION_SERVICE_URL`. Secrets: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `RABBITMQ_USER`, `RABBITMQ_PASSWORD`, `JWT_SECRET`. |
| **postgres** | `postgres.finguard.svc` | `5432` | ClusterIP (`5432`) | ConfigMap: `POSTGRES_DB`, `POSTGRES_AUTH_DB`, `POSTGRES_TRANSACTIONS_DB`, `POSTGRES_BUDGETS_DB`. Secrets: `POSTGRES_USER`, `POSTGRES_PASSWORD`. |
| **rabbitmq** | `rabbitmq.finguard.svc` | `5672`, `15672` | ClusterIP (`5672`, `15672`) | Secrets: `rabbitmq-user` -> `RABBITMQ_DEFAULT_USER`, `rabbitmq-password` -> `RABBITMQ_DEFAULT_PASS`. |

---

## 5. Database Initialization & Persistence Findings

1. **Storage Provisioning:**
   - PostgreSQL uses a `PersistentVolumeClaim` named `postgres-pvc` (requesting 2Gi with `ReadWriteOnce`).
   - Sizing is appropriate for local Minikube storage provisioner (`standard` hostpath).
2. **Deployment Strategy:**
   - PostgreSQL uses `strategy: {type: Recreate}` to prevent volume attachment deadlocks during pod redeployments.
3. **Multi-Database Bootstrapping:**
   - Mounted via ConfigMap `postgres-init-scripts` to `/docker-entrypoint-initdb.d/`.
   - On first startup with an empty volume, PostgreSQL creates the 3 isolated databases: `finguard_auth`, `finguard_transactions`, and `finguard_budgets`, and grants full privileges to `POSTGRES_USER`.
   - On pod restart with an existing volume, PostgreSQL detects existing data in `/var/lib/postgresql/data/pgdata`, skips initialization scripts, and preserves all tables and records.
4. **Application Migration Autonomy:**
   - All three database-dependent microservices (`auth-service`, `transaction-service`, `budget-alert-service`) implement self-healing startup migration logic: they retry database connectivity for 30–60 seconds, connect to their designated database, and execute `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` statements idempotently.

---

## 6. RabbitMQ Configuration Findings

1. **Broker Storage & Persistence:**
   - RabbitMQ uses a `PersistentVolumeClaim` named `rabbitmq-pvc` (1Gi `ReadWriteOnce`).
   - Uses `strategy: {type: Recreate}` to guarantee clean volume detachment and reattachment.
2. **Topology & Exchange Architecture:**
   - **Main Event Exchange:** `finguard.events` (Topic exchange, durable).
   - **Dead Letter Exchange (DLX):** `finguard.dlx` (Direct exchange, durable).
3. **Queue Bindings:**
   - `q.categorization`: Bound to `finguard.events` on topic `transaction.created`. DLX routing key: `dlx.categorization`.
   - `q.fraud_detection`: Bound to `finguard.events` on topic `transaction.created`. DLX routing key: `dlx.fraud`.
   - `q.budget_evaluation`: Bound to `finguard.events` on topic `transaction.*`. DLX routing key: `dlx.budget`.
4. **Publishing Semantics:**
   - `transaction-service` publishes events with `delivery_mode=2` (persistent message flag) and JSON content-type.

---

## 7. Required Secret Keys (Zero Credential Exposure)

The FinGuard Kubernetes deployment requires exactly 5 secret keys defined in `finguard-secrets`:

| Secret Key | Target Consumers | Purpose |
| :--- | :--- | :--- |
| `postgres-user` | `postgres`, `auth-service`, `transaction-service`, `budget-alert-service` | PostgreSQL master administrative and application user |
| `postgres-password` | `postgres`, `auth-service`, `transaction-service`, `budget-alert-service` | PostgreSQL authentication password |
| `rabbitmq-user` | `rabbitmq`, `categorization-service`, `fraud-detection-service`, `transaction-service`, `budget-alert-service` | RabbitMQ AMQP / Management user |
| `rabbitmq-password` | `rabbitmq`, `categorization-service`, `fraud-detection-service`, `transaction-service`, `budget-alert-service` | RabbitMQ authentication password |
| `jwt-secret` | `auth-service`, `transaction-service`, `budget-alert-service` | Symmetric secret key for signing & verifying JWT bearer tokens |

> **Security Verification:**  
> - Template file: [`k8s/02-secrets.yaml.example`](file:///C:/Users/Abhishay%20Mamidi/.gemini/antigravity/scratch/finguard/k8s/02-secrets.yaml.example) contains only generic placeholders.  
> - Source control protection: `.gitignore` explicitly matches `k8s/*secret*.yaml` and `k8s/*secrets*.yaml` while ignoring examples (`!k8s/*example*`). No real secrets can be committed.

---

## 8. Validation Commands Executed & Actual Results

### Command 1: Kustomize Build & Assembly
```powershell
kubectl kustomize k8s/
```
- **Result:** **Exit Code 0 (Success)**.
- **Verification:** All 12 YAML documents assembled into a valid multi-document Kubernetes stream. Namespace `finguard` consistently injected.

### Command 2: Client-Side Schema Validation
```powershell
kubectl apply --dry-run=client -k k8s/
```
- **Result:** **Exit Code 0 (Success)**.
- **Output:**
  - `namespace/finguard created (dry run)`
  - `configmap/finguard-config created (dry run)`
  - `configmap/postgres-init-scripts created (dry run)`
  - `secret/finguard-secrets created (dry run)`
  - `service/api-gateway created (dry run)`
  - `service/auth-service created (dry run)`
  - `service/budget-alert-service created (dry run)`
  - `service/categorization-service created (dry run)`
  - `service/fraud-detection-service created (dry run)`
  - `service/frontend created (dry run)`
  - `service/postgres created (dry run)`
  - `service/rabbitmq created (dry run)`
  - `service/transaction-service created (dry run)`
  - `persistentvolumeclaim/postgres-pvc created (dry run)`
  - `persistentvolumeclaim/rabbitmq-pvc created (dry run)`
  - `deployment.apps/api-gateway created (dry run)`
  - `deployment.apps/auth-service created (dry run)`
  - `deployment.apps/budget-alert-service created (dry run)`
  - `deployment.apps/categorization-service created (dry run)`
  - `deployment.apps/fraud-detection-service created (dry run)`
  - `deployment.apps/frontend created (dry run)`
  - `deployment.apps/postgres created (dry run)`
  - `deployment.apps/rabbitmq created (dry run)`
  - `deployment.apps/transaction-service created (dry run)`

### Command 3: Existing Docker Compose Integrity Check
```powershell
curl.exe -s http://localhost:8080/health
```
- **Result:** `{"status":"healthy","service":"api-gateway","version":"1.0.0"}`
- **Verification:** Existing Docker Compose environment remained completely untouched and running.

---

## 9. Issues Still Unresolved or Requiring Manual Action

1. **Image Build & Cluster Loading:**
   - Custom images (`finguard-auth-service:latest`, `finguard-transaction-service:latest`, etc.) must be built locally and loaded into Minikube before applying manifests, because Minikube's Docker daemon runs in an isolated VM/container context.
2. **Local Secrets Customization:**
   - The user must populate `k8s/02-secrets.yaml` with their preferred credentials before live application.
3. **Live Cluster Execution:**
   - Per explicit instructions, **no live deployment command has been executed**. Application runtime health, Pod inter-connectivity in Kubernetes, and live PVC volume mounting can only be verified once the user runs `kubectl apply`.

---

## 10. Exact Next PowerShell Commands to Configure Secrets & Prepare for Deployment

Execute these commands in your PowerShell terminal when you are ready to deploy:

### Step 1: Start Minikube
```powershell
cd "C:\Users\Abhishay Mamidi\.gemini\antigravity\scratch\finguard"
minikube start --driver=docker --cpus=2 --memory=8192
```

### Step 2: Configure Secrets Locally
```powershell
# Create your local secrets file from template (ignored by Git)
Copy-Item k8s/02-secrets.yaml.example k8s/02-secrets.yaml

# (Optional) Customize passwords directly via PowerShell if desired:
# (Get-Content k8s/02-secrets.yaml) -replace "replace_with_a_secure_postgres_password", "MySecureLocalPass123" | Set-Content k8s/02-secrets.yaml
```

### Step 3: Build & Load Docker Images into Minikube
```powershell
# Build application images locally
docker build -t finguard-auth-service:latest ./auth-service
docker build -t finguard-transaction-service:latest ./transaction-service
docker build -t finguard-categorization-service:latest ./categorization-service
docker build -t finguard-fraud-detection-service:latest ./fraud-detection-service
docker build -t finguard-budget-alert-service:latest ./budget-alert-service
docker build -t finguard-frontend:latest ./frontend
docker build -t finguard-api-gateway:latest ./api-gateway

# Load images into Minikube
minikube image load finguard-auth-service:latest
minikube image load finguard-transaction-service:latest
minikube image load finguard-categorization-service:latest
minikube image load finguard-fraud-detection-service:latest
minikube image load finguard-budget-alert-service:latest
minikube image load finguard-frontend:latest
minikube image load finguard-api-gateway:latest
```

### Step 4: Apply Manifests to Minikube
```powershell
kubectl apply -k k8s/
```

### Step 5: Verify Deployment Rollout
```powershell
kubectl rollout status deployment/postgres -n finguard
kubectl rollout status deployment/rabbitmq -n finguard
kubectl rollout status deployment/auth-service -n finguard
kubectl rollout status deployment/transaction-service -n finguard
kubectl rollout status deployment/categorization-service -n finguard
kubectl rollout status deployment/fraud-detection-service -n finguard
kubectl rollout status deployment/budget-alert-service -n finguard
kubectl rollout status deployment/frontend -n finguard
kubectl rollout status deployment/api-gateway -n finguard
```

### Step 6: Access Application
```powershell
kubectl port-forward service/api-gateway 8080:80 -n finguard
```
Open: [http://localhost:8080](http://localhost:8080)
