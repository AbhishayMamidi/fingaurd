# FinGuard — Master DevOps Baseline Audit Report

**Date:** 2026-09-28  
**Repository:** `https://github.com/AbhishayMamidi/fingaurd`  
**Branch:** `main`  
**Commit:** `43773e6`  
**Environment:** Windows 11 Pro, PowerShell, Docker Desktop, Minikube (Docker driver), kubectl v1.36.1  

---

## 1. Executive Summary

This audit establishes the ground-truth technical baseline of the FinGuard microservices platform prior to executing the Master DevOps Completion phases. All telemetry is gathered directly from the environment, active Docker containers, Git history, GitHub Actions API, and Kubernetes manifest validation.

---

## 2. Git & Version Control Baseline

* **Branch:** `main` (synchronized with `origin/main`).
* **Remote Origin:** `https://github.com/AbhishayMamidi/fingaurd.git`
* **Secret Protection:** `.gitignore` explicitly excludes:
  - `k8s/*secret*.yaml`
  - `k8s/*secrets*.yaml`
  - `.env`, `.env.local`
  - Key files and certificates (`*.pem`, `*.key`)
* **Local Secret Configuration:** `k8s/02-secrets.yaml` is present locally for cluster deployments, and `k8s/02-secrets.yaml.example` provides the committed sanitised reference template.

---

## 3. GitHub Actions CI Baseline

All seven microservices have dedicated GitHub Actions workflows enforcing dependency validation, linting, unit testing, Docker image building, and vulnerability scanning with Trivy.

| Service | CI Workflow File | Last Verified Run | Result | Security Policy |
| :--- | :--- | :---: | :---: | :---: |
| **Frontend** | `.github/workflows/ci-frontend.yml` | Run 36405599284 | **Success** | HIGH,CRITICAL (exit 1) |
| **API Gateway** | `.github/workflows/ci-api-gateway.yml` | Run 36344188559 | **Success** | HIGH,CRITICAL (exit 1) |
| **Auth Service** | `.github/workflows/ci-auth-service.yml` | Run 36424507251 | **Success** | HIGH,CRITICAL (exit 1) |
| **Budget Alert Service** | `.github/workflows/ci-budget-alert-service.yml` | Run 36424507288 | **Success** | HIGH,CRITICAL (exit 1) |
| **Transaction Service** | `.github/workflows/ci-transaction-service.yml` | Run 36426331807 | **Success** | HIGH,CRITICAL (exit 1) |
| **Categorization Service** | `.github/workflows/ci-categorization-service.yml` | Run 36426331797 | **Success** | HIGH,CRITICAL (exit 1) |
| **Fraud Detection Service** | `.github/workflows/ci-fraud-detection-service.yml` | Run 36426331697 | **Success** | HIGH,CRITICAL (exit 1) |

---

## 4. Local Container Architecture (Docker Compose)

All nine application services and supporting infrastructure are running and healthy under Docker Compose on Docker Desktop:

* `finguard-api-gateway`: Port 8080 (Health check 200 OK verified)
* `finguard-auth-service`: Port 5001 (Healthy)
* `finguard-transaction-service`: Port 5002 (Healthy)
* `finguard-categorization-service`: Port 5003 (Healthy)
* `finguard-fraud-service`: Port 5004 (Healthy)
* `finguard-budget-service`: Port 5005 (Healthy)
* `finguard-frontend`: Port 80 (Healthy)
* `finguard-postgres`: Port 5432 (Healthy)
* `finguard-rabbitmq`: Ports 5672, 15672 (Healthy)

---

## 5. Kubernetes & GitOps Manifest Baseline

* **Application Manifests (`k8s/`):**
  - Syntactically validated via `kubectl kustomize k8s/`.
  - Declares namespaces, ConfigMaps, Secrets, Deployments, Services, and PVCs (`postgres-pvc`, `rabbitmq-pvc`).
* **Monitoring Manifests (`k8s/monitoring/`):**
  - Syntactically validated via `kubectl kustomize k8s/monitoring/`.
  - Configures Prometheus, Grafana, `kube-state-metrics`, and `node-exporter`.
* **GitOps Definitions (`k8s/argocd/`):**
  - `finguard-app.yaml` points to `https://github.com/AbhishayMamidi/fingaurd.git` (`finguard` namespace).
  - `finguard-monitoring-app.yaml` points to `https://github.com/AbhishayMamidi/fingaurd.git` (`monitoring` namespace).
* **Canary Delivery Manifests (`k8s/rollouts/`):**
  - `auth-service-rollout.yaml` prepared with progressive 4-step canary weighting (`10% -> 30% -> 60% -> 100%`) and Prometheus `AnalysisTemplate`.

---

## 6. Outstanding Work & Execution Roadmap

1. **Phase 1:** Reconcile application onto Minikube, load local images, verify PVC persistence and end-to-end service endpoints.
2. **Phase 2:** Bootstrap ArgoCD on Minikube, apply application manifests, verify GitOps sync.
3. **Phase 3:** Complete observability stack (verify scrape targets, Grafana dashboards, implement Loki log aggregation and Prometheus alerting rules).
4. **Phase 4:** Install Argo Rollouts controller, execute canary traffic-shifting experiment and verify automated rollback.
5. **Phase 5:** Install Metrics Server, configure HPAs for stateless services, run controlled load tests.
6. **Phase 6:** Harden container security (NetworkPolicies, readOnlyRootFilesystem, dropped capabilities, RBAC).
7. **Phase 7:** Implement database and broker backup procedures, perform test restore, validate pod resilience.
8. **Phase 8:** Execute full end-to-end regression testing.
9. **Phase 9:** Compile final comprehensive evidence documentation.
