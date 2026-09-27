# FinGuard Phase 3: Prometheus + Grafana Observability Audit

**Project:** FinGuard Personal Finance & Fraud Detection Platform  
**Target Environment:** Local Minikube v1.39.0 (Docker Driver) on Windows 11 Pro  
**Cluster Capacity:** 2 CPUs (2000m), 8 GB RAM (8192 MiB)  
**Audit Date:** September 27, 2026  
**Status:** Audit Complete — Ready for Implementation  

---

## 1. Executive Summary

This audit assesses the current state of observability across the FinGuard microservices platform and defines a lightweight, production-grade observability architecture tailored for a resource-constrained local Minikube cluster (2 CPUs / 8 GB RAM).

### Key Audit Discoveries
1. **Application Services:** None of the 5 microservices currently expose a `/metrics` endpoint or bundle Prometheus client libraries (`prometheus-client` in Python or `prom-client` in Node.js).
2. **RabbitMQ Broker:** RabbitMQ 3.13-management already has the `rabbitmq_prometheus` plugin actively running and listening on internal port `15692` (`/metrics`), providing immediate out-of-the-box telemetry for queue depths, consumers, channels, and message rates once exposed via a Kubernetes Service.
3. **Cluster Capacity:** FinGuard currently requests **605m CPU (~30.25%)** and **992 MiB RAM (~12.1%)**, leaving ample capacity (~1395m CPU and ~7.1 GB RAM) to host Prometheus, Grafana, kube-state-metrics, and node-exporter without resource pressure or pod evictions.
4. **Helm Status:** Helm CLI is not installed on the host system. The observability stack will be implemented using pure declarative Kubernetes manifests and Kustomize (`k8s/monitoring/`), ensuring 100% native compatibility and reproducibility.

---

## 2. Current Architecture & Pod Inventory

FinGuard runs in the `finguard` namespace with 9 active pods:

| Workload | Runtime / Framework | Current Ports | Health Endpoints | Current Metrics Status | CPU Req/Lim | RAM Req/Lim |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **api-gateway** | Nginx Alpine 1.31 | 80 (`NodePort 30080`) | `/health` (HTTP 200) | Stub status module compiled in | 50m / 150m | 64Mi / 128Mi |
| **frontend** | React 18 / Vite / Nginx | 80 | `/` (HTTP 200) | Static web distribution | 25m / 100m | 32Mi / 64Mi |
| **auth-service** | Node.js 20 / Express | 5001 | `/health` (HTTP 200) | **Missing** (No `prom-client`) | 50m / 150m | 96Mi / 200Mi |
| **transaction-service** | Python 3.11 / FastAPI | 5002 | `/health` (HTTP 200) | **Missing** (No `prometheus-client`) | 80m / 250m | 128Mi / 256Mi |
| **categorization-service**| Python 3.11 / FastAPI | 5003 | `/health` (HTTP 200) | **Missing** (No `prometheus-client`) | 50m / 150m | 96Mi / 200Mi |
| **fraud-detection-service**| Python 3.11 / FastAPI | 5004 | `/health` (HTTP 200) | **Missing** (No `prometheus-client`) | 100m / 300m | 160Mi / 350Mi |
| **budget-alert-service** | Node.js 20 / Express | 5005 | `/health` (HTTP 200) | **Missing** (No `prom-client`) | 50m / 150m | 96Mi / 200Mi |
| **postgres** | PostgreSQL 16 Alpine | 5432 | `pg_isready` probe | Standard PostgreSQL engine | 100m / 300m | 128Mi / 256Mi |
| **rabbitmq** | RabbitMQ 3.13 Alpine | 5672, 15672, **15692**| `rabbitmq-diagnostics` | **Available** (`rabbitmq_prometheus` on :15692) | 100m / 300m | 192Mi / 384Mi |

---

## 3. Resource Budget & Sizing Analysis

The local Minikube cluster has 2 physical/virtual CPU cores (2000m) and 8 GB RAM (8192 MiB).

### Proposed Monitoring Stack Resource Allocations (`monitoring` namespace)
| Component | CPU Request | CPU Limit | Memory Request | Memory Limit | Storage PVC | Retention |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Prometheus Server** | 150m | 350m | 256 MiB | 512 MiB | 2 GiB (`prometheus-pvc`) | 7 days |
| **Grafana** | 50m | 150m | 128 MiB | 256 MiB | 1 GiB (`grafana-pvc`) | N/A |
| **kube-state-metrics** | 50m | 100m | 64 MiB | 128 MiB | None | N/A |
| **node-exporter** | 30m | 100m | 32 MiB | 64 MiB | None (DaemonSet) | N/A |
| **Subtotal Monitoring**| **280m** | **700m** | **480 MiB** | **960 MiB** | **3 GiB** | — |
| **FinGuard App Subtotal**| **605m** | **1850m** | **992 MiB** | **2038 MiB** | **3 GiB** | — |
| **Combined Total** | **885m (44.2%)**| **2550m** | **1472 MiB (18.0%)**| **2998 MiB (36.6%)**| **6 GiB** | — |

**Feasibility:** Total cluster resource requests will be less than **45% CPU** and **20% RAM**, leaving more than 1.1 CPU and 6.6 GB RAM available for the Kubernetes control plane, Docker daemon, and burst traffic.

---

## 4. Application Metrics Instrumentation Requirements

### Metric Design & Safety Standards
To comply with the non-negotiable safety rules:
1. **Zero Secret Exposure:** Metric names and label values must never contain passwords, tokens, JWTs, hashes, or connection strings.
2. **Cardinality Management:** Request paths must be normalized to parameterized route templates (e.g. `/api/transactions/:id` rather than raw `/api/transactions/d3b07384...`).
3. **Core Telemetry:**
   - `http_requests_total{method, route, status_code, service}` (Counter)
   - `http_request_duration_seconds{method, route, service}` (Histogram with standard latency buckets)
   - Runtime/process metrics: memory usage, active event loops, GC pauses, CPU seconds.

### Service-Specific Plan

#### 1. FastAPI Services (`transaction-service`, `categorization-service`, `fraud-detection-service`)
- **Library:** `prometheus-client==0.21.0`
- **Endpoints:** Expose `/metrics` returning standard Prometheus exposition format.
- **Middleware:** Add standard timing and counter middleware that captures method, normalized path, and HTTP status code.

#### 2. Node.js Express Services (`auth-service`, `budget-alert-service`)
- **Library:** `prom-client`
- **Endpoints:** Expose `/metrics` endpoint.
- **Middleware:** Add standard Express middleware measuring response duration and status codes, and enable `promClient.collectDefaultMetrics()`.

---

## 5. Implementation Roadmap

1. **Step 1:** Complete and save this initial audit report (`reports/phase3_step1_observability_audit.md`).
2. **Step 2:** Instrument application code with Prometheus metrics, add unit tests, build updated Docker images, and update Minikube image cache.
3. **Step 3:** Deploy Prometheus in namespace `monitoring` with RBAC, scrape configs, and PVC. Expose RabbitMQ metrics port 15692 on Service `rabbitmq`.
4. **Step 4:** Deploy `kube-state-metrics` and `node-exporter` for infrastructure telemetry.
5. **Step 5:** Deploy Grafana with provisioned Prometheus data source and pre-built JSON dashboards (Cluster Overview, FinGuard App Overview, and Database/Messaging Overview).
6. **Step 6:** Validate scraping targets, metrics ingestion, dashboard queries, and verify zero regressions on existing FinGuard pods and Docker Compose.
7. **Step 7:** Document final findings in `reports/phase3_step1_observability_report.md` and update `README.md`.
