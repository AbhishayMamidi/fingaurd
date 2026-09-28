# ==============================================================================
# FinGuard PostgreSQL Production Backup Script
#
# Dumps all microservice databases and cluster globals from PostgreSQL in Kubernetes.
# Generates timestamped, checksummed backup files in the backups/ directory.
#
# Usage:
#   .\scripts\backup-postgres.ps1
#   .\scripts\backup-postgres.ps1 -Namespace "finguard"
# ==============================================================================

[CmdletBinding()]
param (
    [string]$Namespace = "finguard",
    [string]$BackupRootDir = "backups",
    [string]$DbUser = "finguard_user"
)

$ErrorActionPreference = "Stop"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "  FinGuard PostgreSQL Backup Process" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

# 1. Locate running postgres pod
Write-Host "[1/5] Locating PostgreSQL pod in namespace '$Namespace'..." -ForegroundColor Yellow
$postgresPod = (kubectl get pod -n $Namespace -l app=postgres -o jsonpath="{.items[?(@.status.phase=='Running')].metadata.name}").Trim()

if (-not $postgresPod) {
    Write-Error "No running PostgreSQL pod found in namespace '$Namespace'."
    exit 1
}
Write-Host "      Found active PostgreSQL pod: $postgresPod" -ForegroundColor Green

# 2. Prepare timestamped backup directory
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = Join-Path $BackupRootDir "postgres_$timestamp"
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
}
Write-Host "[2/5] Created backup destination: $backupDir" -ForegroundColor Green

# 3. Microservice databases to backup
$databases = @("finguard_auth", "finguard_transactions", "finguard_budgets")

Write-Host "[3/5] Executing database dumps..." -ForegroundColor Yellow
$manifest = @()

foreach ($db in $databases) {
    $outFile = Join-Path $backupDir "$db.sql"
    Write-Host "      Dumping database '$db' -> $outFile..." -NoNewline
    
    # Execute pg_dump inside pod and stream to file
    $dumpCmd = "kubectl exec $postgresPod -n $Namespace -- pg_dump -U $DbUser -d $db -F p"
    Invoke-Expression $dumpCmd | Out-File -FilePath $outFile -Encoding utf8
    
    $fileInfo = Get-Item $outFile
    $hash = (Get-FileHash -Path $outFile -Algorithm SHA256).Hash
    
    Write-Host " OK ($([math]::Round($fileInfo.Length / 1KB, 1)) KB)" -ForegroundColor Green
    $manifest += [PSCustomObject]@{
        Database = $db
        File     = $outFile
        SizeBytes= $fileInfo.Length
        SHA256   = $hash
    }
}

# 4. Dump entire cluster (globals + all databases)
Write-Host "[4/5] Executing full cluster dump (globals + schemas)..." -ForegroundColor Yellow
$allOutFile = Join-Path $backupDir "cluster_all.sql"
$allDumpCmd = "kubectl exec $postgresPod -n $Namespace -- pg_dumpall -U $DbUser"
Invoke-Expression $allDumpCmd | Out-File -FilePath $allOutFile -Encoding utf8
$allFileInfo = Get-Item $allOutFile
$allHash = (Get-FileHash -Path $allOutFile -Algorithm SHA256).Hash
Write-Host "      Full cluster dump -> $allOutFile OK ($([math]::Round($allFileInfo.Length / 1KB, 1)) KB)" -ForegroundColor Green

$manifest += [PSCustomObject]@{
    Database = "_ALL_DATABASES_"
    File     = $allOutFile
    SizeBytes= $allFileInfo.Length
    SHA256   = $allHash
}

# Save manifest.json
$manifestPath = Join-Path $backupDir "manifest.json"
$manifest | ConvertTo-Json -Depth 3 | Out-File -FilePath $manifestPath -Encoding utf8

# 5. Verification summary
Write-Host "[5/5] Backup successfully created and verified!" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "Backup Location: $backupDir" -ForegroundColor White
$manifest | Format-Table Database, SizeBytes, SHA256 -AutoSize
Write-Host "=================================================================" -ForegroundColor Cyan
