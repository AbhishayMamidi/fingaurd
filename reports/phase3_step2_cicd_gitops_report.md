# Phase 3 Step 2 — CI/CD and GitOps Readiness Report

**Date:** 2026-09-28  
**Project:** FinGuard Microservices Platform  
**Status:** ✅ COMPLETE

---

## Summary

All Phase 3 Step 2 deliverables have been implemented:

| Deliverable | Status |
|---|---|
| GitHub Actions CI — auth-service | ✅ Created |
| GitHub Actions CI — transaction-service | ✅ Created |
| GitHub Actions CI — categorization-service | ✅ Created |
| GitHub Actions CI — fraud-detection-service | ✅ Created |
| GitHub Actions CI — budget-alert-service | ✅ Created |
| GitHub Actions CI — frontend | ✅ Created |
| GitHub Actions CI — api-gateway | ✅ Created |
| Trivy image scanning in all CI pipelines | ✅ Included |
| Immutable Git SHA image tags | ✅ Defined |
| ArgoCD Application — finguard namespace | ✅ Created |
| ArgoCD Application — monitoring namespace | ✅ Created |
| ArgoCD bootstrap script (PowerShell) | ✅ Created |
| Argo Rollouts canary Rollout — auth-service | ✅ Prepared |
| Argo Rollouts AnalysisTemplate (Prometheus-backed) | ✅ Prepared |
| Transaction service container rebuilt and verified | ✅ 11 tests pass |

---

## 1. Pre-Flight Verification

Before implementation, all existing workloads were verified healthy:

**finguard namespace — 9 pods, all 1/1 Running:**
```
api-gateway, auth-service, budget-alert-service, categorization-service,
fraud-detection-service, frontend, postgres, rabbitmq, transaction-service
```

**monitoring namespace — 4 pods, all 1/1 Running:**
```
grafana, kube-state-metrics, node-exporter, prometheus
```

**Transaction service container rebuilt** (`docker compose build transaction-service`) so the
running container now includes `tests/test_database_url.py`.

**Transaction service test result: 11 tests PASSED**
```
tests/test_database_url.py — 8 passed
tests/test_transactions.py — 3 passed
```

---

## 2. GitHub Actions CI Workflows

### Location
```
.github/
  workflows/
    ci-auth-service.yml
    ci-transaction-service.yml
    ci-categorization-service.yml
    ci-fraud-detection-service.yml
    ci-budget-alert-service.yml
    ci-frontend.yml
    ci-api-gateway.yml
```

### Trigger Strategy
Each workflow uses **path filters** so only the relevant service's workflow runs when its code changes. Pushing a change to `auth-service/` triggers only `ci-auth-service.yml`, not all seven pipelines.

### Pipeline Structure (per service)

```
Job 1: test
  ├─ Checkout code
  ├─ Set up runtime (Node.js 20 or Python 3.11)
  ├─ Install dependencies (npm ci / pip install -r requirements.txt)
  ├─ [Lint] flake8 for Python services (continue-on-error while codebase is being cleaned up)
  └─ Run unit tests

Job 2: build  (needs: test — only runs if tests pass)
  ├─ Set up Docker Buildx
  ├─ Build Docker image with SHA tag (no push to registry)
  └─ Trivy scan (HIGH + CRITICAL vulnerabilities, exit-code: 1)
```

### Immutable Image Tags
Every workflow sets:
```yaml
env:
  IMAGE_TAG: ${{ github.sha }}
```
Images are tagged as both `finguard-<service>:<FULL_SHA>` and `finguard-<service>:latest`.
Using the full Git SHA as the image tag means every image is uniquely traceable to a single commit.
There is no mutable `latest` tag ambiguity in a real registry.

### Per-Service Test Strategy

| Service | Language | Test command | Lint |
|---|---|---|---|
| auth-service | Node.js 20 | `node --test tests/*.test.js` | None configured |
| budget-alert-service | Node.js 20 | `node --test tests/*.test.js` | None configured |
| transaction-service | Python 3.11 | `pytest tests/ -v --tb=short` | flake8 (continue-on-error) |
| categorization-service | Python 3.11 | `pytest tests/ -v --tb=short` | flake8 (continue-on-error) |
| fraud-detection-service | Python 3.11 | `pytest tests/ -v --tb=short` | flake8 (continue-on-error) |
| frontend | Node.js 20 | `npm run build` (Vite build) | None; build failure is the gate |
| api-gateway | Nginx Alpine | `docker run nginx:alpine nginx -t` | N/A (config-only service) |

> **Why `continue-on-error` on flake8?**  
> The Python services have a few lines exceeding 79 characters (the default PEP 8 limit).
> These are style issues, not bugs. Flake8 is run with `--max-line-length=120` to reduce
> noise. The `continue-on-error: true` flag means lint issues are **visible** in CI but do
> not block a build. Remove `continue-on-error: true` once the codebase is fully clean.

### Trivy Scanning
All seven pipelines include:
```yaml
- uses: aquasecurity/trivy-action@master
  with:
    image-ref: '<image>:<sha>'
    severity: 'HIGH,CRITICAL'
    exit-code: '1'
    ignore-unfixed: true
```
- **`ignore-unfixed: true`** — Only reports vulnerabilities that have a published fix available. Avoids noise from upstream base-image CVEs with no available remediation.
- **`exit-code: '1'`** — The CI build fails if any HIGH or CRITICAL fixable vulnerability is found.

### ⚠️ Blocker: GitHub Remote Not Configured

The workflows exist locally but **cannot run** until:

1. Create a GitHub repository (go to https://github.com/new)
2. Connect the local repo:
   ```powershell
   git remote add origin https://github.com/YOUR_USERNAME/finguard.git
   git push -u origin main
   ```
3. GitHub Actions will automatically pick up `.github/workflows/` on the next push.

**No paid GitHub plan is required.** Public repositories get free GitHub Actions minutes.

---

## 3. ArgoCD GitOps

### Application Definitions

| File | Manages | Namespace |
|---|---|---|
| `k8s/argocd/finguard-app.yaml` | All finguard services, PostgreSQL, RabbitMQ | `finguard` |
| `k8s/argocd/finguard-monitoring-app.yaml` | Prometheus, Grafana, kube-state-metrics, node-exporter | `monitoring` |

### Why Two Separate Applications?

Using two Applications (finguard + monitoring) enforces clean separation:
- A change to a Grafana dashboard does not restart auth-service pods
- A bug in a new auth-service image does not affect Prometheus availability
- Each team/persona can be granted separate ArgoCD access (RBAC future step)

### Sync Strategy (Manual — Beginner-Safe)

Both Applications are configured with **manual sync** by default:
```yaml
# syncPolicy:
#   automated:
#     prune: true
#     selfHeal: true
```
You must click "Sync" in the ArgoCD UI or run `argocd app sync finguard` to apply changes.
This gives you review time before changes hit the cluster.

When you're comfortable with GitOps, uncomment `automated:` to enable auto-sync.

### ArgoCD Source Configuration

Both Application manifests contain a placeholder:
```yaml
repoURL: https://github.com/YOUR_GITHUB_USERNAME/finguard.git
```
**You must replace this** with your actual GitHub repository URL before applying.
The bootstrap script validates this and exits with an error if the placeholder is still present.

### Bootstrap Script

`scripts/argocd-bootstrap.ps1` automates:
1. Creating the `argocd` namespace
2. Installing ArgoCD from the official stable manifests
3. Waiting for the ArgoCD server Deployment to be ready
4. Retrieving and displaying the initial admin password
5. Checking the Application manifests for the placeholder URL
6. Applying both Application definitions

**To run ArgoCD bootstrap** (after pushing to GitHub and editing the manifests):
```powershell
# Edit REPO_URL in scripts\argocd-bootstrap.ps1 first
# Edit k8s\argocd\finguard-app.yaml — replace YOUR_GITHUB_USERNAME
# Edit k8s\argocd\finguard-monitoring-app.yaml — replace YOUR_GITHUB_USERNAME
.\scripts\argocd-bootstrap.ps1
```

### Access the ArgoCD UI (after bootstrap)
```powershell
# In a separate terminal — keep this running while you use the UI
kubectl port-forward svc/argocd-server -n argocd 8082:443

# Open: https://localhost:8082
# Username: admin
# Password: (shown by the bootstrap script)
```

---

## 4. Argo Rollouts — Canary Deployment

### Location
```
k8s/rollouts/auth-service-rollout.yaml
```

### Status: PREPARED — NOT Applied

The `auth-service-rollout.yaml` manifest is a fully configured Rollout spec.
It is **not applied** to the live cluster because activating a Rollout requires
first deleting the existing Deployment, which is a destructive action.

### Canary Strategy

```
Step 1:  10% canary traffic → pause 2 minutes → AnalysisRun checks success rate
Step 2:  30% canary traffic → pause 2 minutes → AnalysisRun checks success rate
Step 3:  60% canary traffic → pause 2 minutes → AnalysisRun checks success rate
Step 4: 100% canary traffic → promotion complete
```

If the AnalysisRun fails at any step (auth-service HTTP success rate < 95%),
Argo Rollouts automatically rolls back to the previous stable image.

### Prometheus-backed AnalysisTemplate

The `AnalysisTemplate` named `auth-service-success-rate` queries Prometheus:
```promql
sum(rate(http_requests_total{service="auth-service",status!~"5.."}[2m]))
/
sum(rate(http_requests_total{service="auth-service"}[2m]))
```
- Success condition: result >= 0.95 (95% of requests return non-5xx)
- Failure limit: 3 consecutive failures before automatic rollback
- Evaluation interval: every 30 seconds

### Rollout Activation Procedure (Future Step)

```powershell
# Step A: Install Argo Rollouts CRDs and controller
kubectl create namespace argo-rollouts
kubectl apply -n argo-rollouts `
  -f https://github.com/argoproj/argo-rollouts/releases/latest/download/install.yaml

# Step B: Verify the controller is running
kubectl get pods -n argo-rollouts

# Step C: Delete the current standard Deployment (DESTRUCTIVE — confirm first)
kubectl delete deployment auth-service -n finguard

# Step D: Apply the Rollout
kubectl apply -f k8s/rollouts/auth-service-rollout.yaml -n finguard

# Step E: Monitor the Rollout (install kubectl argo rollouts plugin first)
kubectl argo rollouts get rollout auth-service -n finguard --watch
```

---

## 5. Resource Headroom Analysis

Current Minikube state: 2 CPUs, 8 GB RAM, 13 pods running.

| Component | Additional Pods | Notes |
|---|---|---|
| ArgoCD | ~7 pods | argocd-server, argocd-repo-server, argocd-application-controller, argocd-dex-server, argocd-redis, argocd-notifications-controller, argocd-applicationset-controller |
| Argo Rollouts controller | 1 pod | Lightweight — ~50m CPU, 100Mi RAM |
| **Total new pods** | **~8** | |

**Total with ArgoCD:** ~21 pods. With 8 GB RAM and 2 CPUs this is tight but viable.
Minikube on Windows with Docker driver has overhead from the Docker VM layer.

> **Tip:** If ArgoCD pods are slow to start or the cluster becomes unresponsive,
> increase Minikube resources before bootstrapping:
> ```powershell
> minikube stop
> minikube config set memory 10240
> minikube config set cpus 4
> minikube start
> ```

---

## 6. Open Items and Next Steps

| Item | Priority | Notes |
|---|---|---|
| Create GitHub repository and push code | **Required to use CI/CD** | See blocker above |
| Update `repoURL` in ArgoCD Application manifests | **Required to use ArgoCD** | Replace `YOUR_GITHUB_USERNAME` |
| Run `.\scripts\argocd-bootstrap.ps1` | When GitHub is ready | |
| Remove `continue-on-error: true` from flake8 steps | Low | After fixing style issues |
| Add ESLint to auth-service and budget-alert-service | Medium | No ESLint config currently exists |
| Add frontend unit tests (Vitest) | Medium | Currently, build is the only gate |
| Activate Argo Rollouts for auth-service | Future | After ArgoCD and CI/CD are proven stable |
| Configure Docker registry (GHCR or DockerHub) for real image pushes | Future | Workflows currently build without pushing |

---

## 7. Files Created This Session

```
.github/
  workflows/
    ci-auth-service.yml
    ci-transaction-service.yml
    ci-categorization-service.yml
    ci-fraud-detection-service.yml
    ci-budget-alert-service.yml
    ci-frontend.yml
    ci-api-gateway.yml

k8s/
  argocd/
    finguard-app.yaml
    finguard-monitoring-app.yaml
  rollouts/
    auth-service-rollout.yaml

scripts/
  argocd-bootstrap.ps1

reports/
  phase3_step2_cicd_gitops_report.md  ← this file
```
