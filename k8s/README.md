# FinGuard Local Kubernetes Deployment Guide (Minikube on Windows)

This guide provides step-by-step instructions for deploying the FinGuard microservices platform to a local **Minikube** Kubernetes cluster on Windows using the Docker driver.

---

## 1. Architecture & Port Mapping

| Service | Pod Container Port | Service Type | K8s DNS Name | Description |
| :--- | :--- | :--- | :--- | :--- |
| **api-gateway** | 80 | NodePort (`30080:80`) | `api-gateway.finguard.svc` | Nginx Reverse Proxy & Entrypoint |
| **frontend** | 80 | ClusterIP (`80`) | `frontend.finguard.svc` | React + Vite UI (served via Nginx) |
| **auth-service** | 5001 | ClusterIP (`5001`) | `auth-service.finguard.svc` | Node.js + Express + JWT Auth |
| **transaction-service** | 5002 | ClusterIP (`5002`) | `transaction-service.finguard.svc` | FastAPI Transaction Engine |
| **categorization-service** | 5003 | ClusterIP (`5003`) | `categorization-service.finguard.svc` | FastAPI Rule-based Categorizer |
| **fraud-detection-service** | 5004 | ClusterIP (`5004`) | `fraud-detection-service.finguard.svc` | FastAPI + Scikit-Learn Anomaly Model |
| **budget-alert-service** | 5005 | ClusterIP (`5005`) | `budget-alert-service.finguard.svc` | Node.js + Express Budget Manager |
| **postgres** | 5432 | ClusterIP (`5432`) | `postgres.finguard.svc` | PostgreSQL 16 (Multi-DB Init) |
| **rabbitmq** | 5672, 15672 | ClusterIP (`5672`, `15672`) | `rabbitmq.finguard.svc` | RabbitMQ 3.13 AMQP & Management |

> **Resource Sizing for Local Cluster (2 CPUs / 8 GB RAM):**  
> Total Pod CPU Requests: **~605m** (~30% of node capacity)  
> Total Pod Memory Requests: **~1.16 GiB** (~15% of node capacity)  
> Pods have `imagePullPolicy: IfNotPresent` to utilize locally built Docker images.

---

## 2. Prerequisites

Open a **PowerShell** prompt (Administrator recommended) in the FinGuard project root:

```powershell
# Navigate to project directory
cd "C:\Users\Abhishay Mamidi\.gemini\antigravity\scratch\finguard"
```

Verify your CLI tools:
```powershell
docker --version
kubectl version --client
minikube version
```

---

## 3. Step 1: Start Minikube

Start your Minikube cluster using the Docker driver, configured specifically for the FinGuard workload:

```powershell
minikube start --driver=docker --cpus=2 --memory=8192
```

Verify the cluster node is ready:
```powershell
kubectl get nodes
```

---

## 4. Step 2: Build & Load Docker Images

To enable Minikube to run your locally modified microservice code, you need the Docker images loaded inside the cluster. You can choose either **Method A** (easiest) or **Method B** (fastest).

### Method A: Build Locally and Load (Recommended)

1. Build all 7 custom container images:
```powershell
docker build -t finguard-auth-service:latest ./auth-service
docker build -t finguard-transaction-service:latest ./transaction-service
docker build -t finguard-categorization-service:latest ./categorization-service
docker build -t finguard-fraud-detection-service:latest ./fraud-detection-service
docker build -t finguard-budget-alert-service:latest ./budget-alert-service
docker build -t finguard-frontend:latest ./frontend
docker build -t finguard-api-gateway:latest ./api-gateway
```

2. Load them directly into your running Minikube cluster:
```powershell
minikube image load finguard-auth-service:latest
minikube image load finguard-transaction-service:latest
minikube image load finguard-categorization-service:latest
minikube image load finguard-fraud-detection-service:latest
minikube image load finguard-budget-alert-service:latest
minikube image load finguard-frontend:latest
minikube image load finguard-api-gateway:latest
```

*(Optional)* Verify images loaded in Minikube:
```powershell
minikube image ls --format table | Select-String "finguard"
```

---

### Method B: Build Directly inside Minikube's Docker Engine

Point your PowerShell terminal to Minikube's in-cluster Docker daemon:
```powershell
& minikube -p minikube docker-env --shell powershell | Invoke-Expression

# Then build directly (images are instantly available without loading):
docker build -t finguard-auth-service:latest ./auth-service
docker build -t finguard-transaction-service:latest ./transaction-service
docker build -t finguard-categorization-service:latest ./categorization-service
docker build -t finguard-fraud-detection-service:latest ./fraud-detection-service
docker build -t finguard-budget-alert-service:latest ./budget-alert-service
docker build -t finguard-frontend:latest ./frontend
docker build -t finguard-api-gateway:latest ./api-gateway
```

---

## 5. Step 3: Configure Secrets

Copy the secret template to `02-secrets.yaml`:

```powershell
Copy-Item k8s/02-secrets.yaml.example k8s/02-secrets.yaml
```

> **Security Note:** `k8s/02-secrets.yaml` is listed in `.gitignore` and will never be committed to Git. Edit `k8s/02-secrets.yaml` if you want to customize your database or RabbitMQ passwords before deploying.

---

## 6. Step 4: Apply Kubernetes Manifests

### Option 1: Apply All with Kustomize (Single Command)

```powershell
kubectl apply -k k8s/
```

### Option 2: Apply Step-by-Step (Ordered Dependency Sequence)

```powershell
# 1. Namespace, ConfigMap & Secrets
kubectl apply -f k8s/00-namespace.yaml
kubectl apply -f k8s/01-configmap.yaml
kubectl apply -f k8s/02-secrets.yaml

# 2. Infrastructure (PostgreSQL & RabbitMQ)
kubectl apply -f k8s/03-postgres.yaml
kubectl apply -f k8s/04-rabbitmq.yaml

# 3. Core Independent Microservices
kubectl apply -f k8s/05-categorization-service.yaml
kubectl apply -f k8s/06-fraud-detection-service.yaml

# 4. Database-Dependent Services
kubectl apply -f k8s/07-auth-service.yaml
kubectl apply -f k8s/08-transaction-service.yaml
kubectl apply -f k8s/09-budget-alert-service.yaml

# 5. Frontend & API Gateway
kubectl apply -f k8s/10-frontend.yaml
kubectl apply -f k8s/11-api-gateway.yaml
```

---

## 7. Step 5: Verify Deployment & Rollout Status

Watch the deployment rollout in real time:

```powershell
# Infrastructure Rollouts
kubectl rollout status deployment/postgres -n finguard --timeout=90s
kubectl rollout status deployment/rabbitmq -n finguard --timeout=90s

# Service Rollouts
kubectl rollout status deployment/categorization-service -n finguard --timeout=60s
kubectl rollout status deployment/fraud-detection-service -n finguard --timeout=60s
kubectl rollout status deployment/auth-service -n finguard --timeout=60s
kubectl rollout status deployment/transaction-service -n finguard --timeout=60s
kubectl rollout status deployment/budget-alert-service -n finguard --timeout=60s
kubectl rollout status deployment/frontend -n finguard --timeout=60s
kubectl rollout status deployment/api-gateway -n finguard --timeout=60s
```

Check the health and readiness of all pods, services, and PVCs:

```powershell
kubectl get pods -n finguard -o wide
kubectl get services -n finguard
kubectl get pvc -n finguard
```

Expected Pod state: All 9 Pods should show `STATUS: Running` and `READY: 1/1`.

---

## 8. Step 6: Access FinGuard

### Method 1: Port-Forwarding (Recommended on Windows)

Forward port `8080` from your local workstation to the `api-gateway` service:

```powershell
kubectl port-forward service/api-gateway 8080:80 -n finguard
```

Open your browser to:
- **Web Application & Dashboard:** [http://localhost:8080](http://localhost:8080)
- **Gateway Health Check:** [http://localhost:8080/health](http://localhost:8080/health)

*(Optional)* Forward RabbitMQ Management Console:
```powershell
kubectl port-forward service/rabbitmq 15672:15672 -n finguard
```
Open: [http://localhost:15672](http://localhost:15672) (User: `guest`, Password: `guest` or your configured secret)

---

### Method 2: Minikube Service URL

In a separate PowerShell terminal, retrieve the URL directly from Minikube:

```powershell
minikube service api-gateway -n finguard
```

---

## 9. Step 7: View Logs & Debug

Stream live logs from any service using its label:

```powershell
# API Gateway logs
kubectl logs -f -l app=api-gateway -n finguard

# Auth Service logs
kubectl logs -f -l app=auth-service -n finguard

# Transaction Service logs
kubectl logs -f -l app=transaction-service -n finguard

# Categorization Service logs
kubectl logs -f -l app=categorization-service -n finguard

# Fraud Detection Service logs
kubectl logs -f -l app=fraud-detection-service -n finguard

# Budget & Alert Service logs
kubectl logs -f -l app=budget-alert-service -n finguard

# PostgreSQL logs
kubectl logs -f -l app=postgres -n finguard

# RabbitMQ logs
kubectl logs -f -l app=rabbitmq -n finguard
```

To inspect pod events or troubleshoot restarts:
```powershell
kubectl describe pod -l app=transaction-service -n finguard
```

---

## 10. Step 8: Teardown & Clean Up

To safely remove all FinGuard Kubernetes resources:

```powershell
# Option A: Delete all resources via Kustomize
kubectl delete -k k8s/

# Option B: Delete the entire namespace (removes all associated workloads and PVCs)
kubectl delete namespace finguard
```

To stop Minikube and release system CPU/RAM resources:
```powershell
minikube stop
```
