# FinGuard — Production Deployment & SRE Operations Runbook

**Environment:** Windows 11 PowerShell / Minikube (Docker driver) / Docker Desktop  
**Target Platform:** Kubernetes v1.31+ / Docker Compose v2+  
**Classification:** Operational Runbook  

---

## 1. Quick Reference: Port Allocation Matrix

| Service | Protocol | Docker Host Port | Minikube Service | K8s Port-Forward Command | Target URL |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **API Gateway** | HTTP | `8080` | `api-gateway:80` | `kubectl port-forward svc/api-gateway -n finguard 8081:80` | `http://localhost:8081` |
| **RabbitMQ Management** | HTTP | `15672` | `rabbitmq:15672` | `kubectl port-forward svc/rabbitmq -n finguard 15672:15672` | `http://localhost:15672` |
| **PostgreSQL** | TCP | `5432` | `postgres:5432` | `kubectl port-forward svc/postgres -n finguard 5432:5432` | `localhost:5432` |
| **Grafana** | HTTP | - | `grafana:3000` | `kubectl port-forward svc/grafana -n monitoring 3000:3000` | `http://localhost:3000` |
| **Prometheus** | HTTP | - | `prometheus:9090` | `kubectl port-forward svc/prometheus -n monitoring 9090:9090` | `http://localhost:9090` |
| **Alertmanager** | HTTP | - | `alertmanager:9093` | `kubectl port-forward svc/alertmanager -n monitoring 9093:9093` | `http://localhost:9093` |
| **ArgoCD Server** | HTTPS | - | `argocd-server:443` | `kubectl port-forward svc/argocd-server -n argocd 8082:443` | `https://localhost:8082` |

---

## 2. Docker Compose Operations (Local Development)

### 2.1 Startup
```powershell
# Navigate to repository root
Set-Location "C:\Users\Abhishay Mamidi\.gemini\antigravity\scratch\finguard"

# Setup environment configuration
Copy-Item .env.example .env

# Build and start all 10 containers in detached mode
docker compose up -d --build

# Verify healthy status
docker compose ps
```

### 2.2 Teardown
```powershell
# Stop services while preserving database and RabbitMQ volumes
docker compose stop

# Destroy containers and remove volumes (destructive fresh start)
docker compose down -v
```

---

## 3. Kubernetes Deployment (Minikube & Kustomize)

### 3.1 Cluster Initialization
```powershell
# Start Minikube with Docker driver
minikube start --driver=docker

# Enable Metrics Server for HPA
minikube addons enable metrics-server
```

### 3.2 Secret Provisioning (Out-of-Band)
```powershell
# Apply namespaces
kubectl apply -f k8s/00-namespace.yaml

# Provision secrets (never commit to Git)
Copy-Item k8s/02-secrets.yaml.example k8s/02-secrets.yaml
# Edit k8s/02-secrets.yaml with secure credentials, then apply:
kubectl apply -f k8s/02-secrets.yaml
```

### 3.3 Deploy Application Workloads via Kustomize
```powershell
# Deploy core microservices, network policies, and HPAs
kubectl apply -k k8s

# Deploy full observability stack (Prometheus, Grafana, Loki, Alertmanager)
kubectl apply -k k8s/monitoring

# Verify all pods reach Running/Ready status
kubectl get pods -n finguard
kubectl get pods -n monitoring
```

---

## 4. GitOps Operations with ArgoCD

### 4.1 Bootstrap ArgoCD
```powershell
# Install ArgoCD v2.12.0
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/v2.12.0/manifests/install.yaml

# Apply K8s v1.31+ schema compatibility patch
kubectl apply -f k8s/argocd/argocd-cm-patch.yaml

# Apply GitOps Applications
kubectl apply -f k8s/argocd/finguard-app.yaml
kubectl apply -f k8s/argocd/finguard-monitoring-app.yaml
```

### 4.2 Sync & Status
```powershell
# Retrieve initial admin password
$pwd = (kubectl get secret argocd-initial-admin-secret -n argocd -o jsonpath="{.data.password}" | [System.Convert]::FromBase64String($_) | [System.Text.Encoding]::UTF8.GetString($_))
Write-Host "ArgoCD admin password: $pwd"

# Port-forward UI to port 8082
kubectl port-forward svc/argocd-server -n argocd 8082:443
# Navigate to https://localhost:8082 (Login: admin)
```

---

## 5. Argo Rollouts & Canary Delivery Runbook

### 5.1 Triggering a Progressive Canary Release
```powershell
# Update container image to trigger automated 4-step canary (10% -> 30% -> 60% -> 100%)
kubectl patch rollout auth-service -n finguard --type='json' `
  -p='[{"op": "replace", "path": "/spec/template/spec/containers/0/image", "value": "finguard-auth-service:v1.0.1"}]'

# Monitor rollout progression and real-time AnalysisRuns
kubectl get rollout auth-service -n finguard -w
kubectl get analysisrun -n finguard
```

### 5.2 Manual Abort & Emergency Rollback
```powershell
# If manual abort is needed:
kubectl patch rollout auth-service -n finguard --type='json' `
  -p='[{"op": "replace", "path": "/spec/strategy/canary/abort", "value": true}]'

# Reset rollout to previous stable revision:
kubectl patch rollout auth-service -n finguard --type='json' `
  -p='[{"op": "replace", "path": "/spec/template/spec/containers/0/image", "value": "finguard-auth-service:latest"}]'
```

---

## 6. Autoscaling & Load Testing Runbook

### 6.1 Inspecting HPAs
```powershell
kubectl get hpa -n finguard
kubectl describe hpa transaction-service-hpa -n finguard
```

### 6.2 Running Load Simulation
```powershell
# Execute multithreaded load test (16 workers, ~55 req/s)
$env:GATEWAY_URL="http://localhost:8081"
python tests/load_test_hpa.py

# Observe replica scaling in another terminal
kubectl get pods -n finguard -l app=transaction-service -w
```

---

## 7. Disaster Recovery & Backup Runbook

### 7.1 Executing Scheduled / Manual Backup
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\backup-postgres.ps1
# Backups saved to backups/postgres_YYYYMMDD_HHMMSS/ with SHA256 checksums
```

### 7.2 Non-Destructive Restore Drill
```powershell
# Restore into isolated test database and verify row parity
powershell -ExecutionPolicy Bypass -File .\scripts\restore-postgres.ps1 `
  -BackupFile "backups\postgres_YYYYMMDD_HHMMSS\finguard_transactions.sql" `
  -TargetDatabase "finguard_restore_test" -Cleanup
```

---

## 8. Incident Response & Troubleshooting

| Symptom | Probable Cause | Verification & Triage Command | Resolution |
| :--- | :--- | :--- | :--- |
| **502 Bad Gateway from Nginx** | Upstream pod terminating or failing healthcheck | `kubectl get pods -n finguard` | Inspect logs: `kubectl logs deploy/<service> -n finguard`. Check readiness probe. |
| **Pods stuck in ContainerCreating** | PersistentVolumeClaim multi-attach deadlock | `kubectl describe pod -n finguard <pod>` | Verify deployment uses `strategy: type: Recreate`. Ensure old pod is fully deleted. |
| **RabbitMQ connection refused** | Broker initialization or URL encoding defect | `kubectl logs deploy/rabbitmq -n finguard` | Verify passwords with special characters are URL-encoded (`encodeURIComponent`). |
| **ArgoCD OutOfSync** | Local manifests differ from remote Git branch | `kubectl diff -k k8s` | Commit and push changes to remote branch, or refresh application in ArgoCD UI. |
| **HPA reports `<unknown>` metrics** | Metrics Server unavailable or scraping delay | `kubectl top nodes` | Ensure `minikube addons enable metrics-server` is active and pods specify CPU requests. |
