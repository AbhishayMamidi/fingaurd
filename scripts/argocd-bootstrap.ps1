#!/usr/bin/env pwsh
# =============================================================================
# FinGuard — ArgoCD Bootstrap Script for Local Minikube
# =============================================================================
# PURPOSE: Install ArgoCD into your Minikube cluster, configure it to watch
#          the FinGuard GitHub repository, and create the Application definitions.
#
# RUN THIS SCRIPT IN POWERSHELL:
#   .\scripts\argocd-bootstrap.ps1
#
# PREREQUISITES:
#   1. Minikube running:  minikube status
#   2. kubectl connected: kubectl cluster-info
#   3. Git remote set:    git remote -v  (must show your GitHub repo URL)
#   4. ArgoCD CLI installed or download it (see below)
# =============================================================================

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── CONFIGURATION — edit these before running ─────────────────────────────
$ARGOCD_VERSION = "v2.12.0"
$ARGOCD_NAMESPACE = "argocd"
$FINGUARD_NAMESPACE = "finguard"
$MONITORING_NAMESPACE = "monitoring"

# REQUIRED: Set this to your actual GitHub repository URL
$REPO_URL = "https://github.com/YOUR_GITHUB_USERNAME/finguard.git"

# ArgoCD admin password (change this after first login)
# If left empty, ArgoCD generates a random password (retrieve with the command below)
$ARGOCD_INITIAL_PASSWORD = ""
# ── END CONFIGURATION ──────────────────────────────────────────────────────

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " FinGuard ArgoCD Bootstrap — Step 1: Install ArgoCD" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# 1. Create argocd namespace
kubectl create namespace $ARGOCD_NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
Write-Host "[OK] Namespace '$ARGOCD_NAMESPACE' ready." -ForegroundColor Green

# 2. Install ArgoCD
Write-Host "Installing ArgoCD $ARGOCD_VERSION ..."
kubectl apply -n $ARGOCD_NAMESPACE `
  -f "https://raw.githubusercontent.com/argoproj/argo-cd/$ARGOCD_VERSION/manifests/install.yaml"

# 3. Wait for ArgoCD server to be ready (up to 3 minutes)
Write-Host "Waiting for ArgoCD server Deployment to become available (timeout: 180s)..."
kubectl rollout status deployment/argocd-server -n $ARGOCD_NAMESPACE --timeout=180s
Write-Host "[OK] ArgoCD server is ready." -ForegroundColor Green

# 4. Retrieve the initial admin password
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " Step 2: Retrieve ArgoCD Admin Password" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

$INITIAL_PW = kubectl get secret argocd-initial-admin-secret `
  -n $ARGOCD_NAMESPACE `
  -o jsonpath="{.data.password}" | `
  ForEach-Object { [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($_)) }

Write-Host ""
Write-Host "ArgoCD initial admin password: $INITIAL_PW" -ForegroundColor Yellow
Write-Host "IMPORTANT: Save this password and change it after first login." -ForegroundColor Yellow
Write-Host ""

# 5. Port-forward ArgoCD UI (run in background, user opens browser manually)
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " Step 3: Access the ArgoCD UI" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Start port-forward to access ArgoCD UI (run this in a separate terminal):" -ForegroundColor White
Write-Host "  kubectl port-forward svc/argocd-server -n argocd 8082:443" -ForegroundColor White
Write-Host "Then open: https://localhost:8082" -ForegroundColor White
Write-Host "Username: admin | Password: (shown above)" -ForegroundColor White
Write-Host ""

# 6. Register the repository (HTTPS, public repo needs no credentials)
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " Step 4: Register GitHub Repository" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

if ($REPO_URL -like "*YOUR_GITHUB_USERNAME*") {
    Write-Host "ERROR: You must edit this script and set REPO_URL to your real GitHub repository URL." -ForegroundColor Red
    Write-Host "Open scripts\argocd-bootstrap.ps1 and set the REPO_URL variable at the top." -ForegroundColor Red
    exit 1
}

Write-Host "Repository: $REPO_URL"
Write-Host ""
Write-Host "To add the repository using the ArgoCD CLI (after port-forwarding):" -ForegroundColor White
Write-Host "  argocd login localhost:8082 --username admin --password '$INITIAL_PW' --insecure" -ForegroundColor White
Write-Host "  argocd repo add $REPO_URL" -ForegroundColor White
Write-Host ""

# 7. Apply ArgoCD Application manifests
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " Step 5: Apply ArgoCD Application Definitions" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# Check that the repo URL has been updated in the Application manifests
$finguardApp = Get-Content "k8s\argocd\finguard-app.yaml" -Raw
if ($finguardApp -like "*YOUR_GITHUB_USERNAME*") {
    Write-Host ""
    Write-Host "ERROR: k8s\argocd\finguard-app.yaml still contains the placeholder repo URL." -ForegroundColor Red
    Write-Host "Edit k8s\argocd\finguard-app.yaml and replace YOUR_GITHUB_USERNAME with your actual username." -ForegroundColor Red
    exit 1
}

kubectl apply -f k8s\argocd\finguard-app.yaml
kubectl apply -f k8s\argocd\finguard-monitoring-app.yaml
Write-Host "[OK] ArgoCD Application definitions applied." -ForegroundColor Green
Write-Host ""

# 8. Summary
Write-Host "============================================================" -ForegroundColor Green
Write-Host " ArgoCD Bootstrap Complete!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Host "  1. Push your code to GitHub:  git push -u origin main" -ForegroundColor White
Write-Host "  2. Start port-forward:        kubectl port-forward svc/argocd-server -n argocd 8082:443" -ForegroundColor White
Write-Host "  3. Open ArgoCD UI:            https://localhost:8082" -ForegroundColor White
Write-Host "  4. Sync the finguard app:     click 'Sync' in the UI, or run:" -ForegroundColor White
Write-Host "       argocd app sync finguard" -ForegroundColor White
Write-Host "  5. Sync monitoring:           argocd app sync finguard-monitoring" -ForegroundColor White
Write-Host ""
Write-Host "To check Application status:" -ForegroundColor White
Write-Host "  kubectl get applications -n argocd" -ForegroundColor White
Write-Host ""
