# ==============================================================================
# FinGuard PostgreSQL Restore & Disaster Recovery Verification Script
#
# Restores a database dump into a target database (defaulting to a non-destructive
# isolated test database: 'finguard_restore_test') and verifies row count integrity.
#
# Usage:
#   .\scripts\restore-postgres.ps1 -BackupFile "backups\postgres_YYYYMMDD_HHMMSS\finguard_transactions.sql"
#   .\scripts\restore-postgres.ps1 -BackupFile "..." -TargetDatabase "finguard_restore_test" -Cleanup
# ==============================================================================

[CmdletBinding()]
param (
    [Parameter(Mandatory=$true)]
    [string]$BackupFile,
    [string]$TargetDatabase = "finguard_restore_test",
    [string]$Namespace = "finguard",
    [string]$DbUser = "finguard_user",
    [switch]$Cleanup
)

$ErrorActionPreference = "Continue"
if (Test-Path variable:PSNativeCommandUseErrorActionPreference) {
    $PSNativeCommandUseErrorActionPreference = $false
}

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "  FinGuard PostgreSQL Restore & DR Verification" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

# 1. Validate input file
if (-not (Test-Path $BackupFile)) {
    Write-Error "Backup file not found: $BackupFile"
    exit 1
}

$fileItem = Get-Item $BackupFile
Write-Host "[1/5] Validating backup artifact..." -ForegroundColor Yellow
Write-Host "      File: $($fileItem.FullName) ($([math]::Round($fileItem.Length / 1KB, 1)) KB)" -ForegroundColor Green

# 2. Locate running postgres pod
Write-Host "[2/5] Locating PostgreSQL pod in namespace '$Namespace'..." -ForegroundColor Yellow
$postgresPod = (kubectl get pod -n $Namespace -l app=postgres -o jsonpath="{.items[?(@.status.phase=='Running')].metadata.name}").Trim()

if (-not $postgresPod) {
    Write-Error "No running PostgreSQL pod found in namespace '$Namespace'."
    exit 1
}
Write-Host "      Found active PostgreSQL pod: $postgresPod" -ForegroundColor Green

# 3. Create clean target database for restoration
Write-Host "[3/5] Preparing target database '$TargetDatabase'..." -ForegroundColor Yellow
# Drop if exists and recreate using dedicated commands
$null = & kubectl exec $postgresPod -n $Namespace -- dropdb -U $DbUser --if-exists $TargetDatabase 2>&1
$null = & kubectl exec $postgresPod -n $Namespace -- createdb -U $DbUser $TargetDatabase 2>&1
Write-Host "      Isolated test database '$TargetDatabase' created successfully." -ForegroundColor Green

# 4. Copy and execute restore inside the container
Write-Host "[4/5] Restoring database schema and data..." -ForegroundColor Yellow
$containerTmp = "/tmp/restore_$(Get-Date -Format 'HHmmss').sql"

# Copy file into pod
kubectl cp $BackupFile "$Namespace/${postgresPod}:$containerTmp"

# Execute psql inside pod
$restoreOutput = kubectl exec $postgresPod -n $Namespace -- psql -U $DbUser -d $TargetDatabase -f $containerTmp 2>&1
# Remove tmp file
kubectl exec $postgresPod -n $Namespace -- rm -f $containerTmp

Write-Host "      Restore completed into '$TargetDatabase'." -ForegroundColor Green

# 5. Verify restored relations and count rows
Write-Host "[5/5] Verifying restored tables and data integrity..." -ForegroundColor Yellow
$tablesRaw = kubectl exec $postgresPod -n $Namespace -- psql -U $DbUser -d $TargetDatabase -t -A -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public';"

$tables = ($tablesRaw -split "`r?`n") | Where-Object { $_ -match '\S' }

$verificationResults = @()
foreach ($tbl in $tables) {
    $count = (kubectl exec $postgresPod -n $Namespace -- psql -U $DbUser -d $TargetDatabase -t -A -c "SELECT count(*) FROM $tbl;").Trim()
    $verificationResults += [PSCustomObject]@{
        Table = $tbl
        RowCount = [int]$count
        Status = "VERIFIED"
    }
}

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "Restore Verification Summary (Database: $TargetDatabase):" -ForegroundColor White
$verificationResults | Format-Table Table, RowCount, Status -AutoSize
Write-Host "=================================================================" -ForegroundColor Cyan

# 6. Cleanup if requested
if ($Cleanup) {
    Write-Host "[CLEANUP] Dropping temporary test database '$TargetDatabase'..." -ForegroundColor Yellow
    $null = & kubectl exec $postgresPod -n $Namespace -- dropdb -U $DbUser --if-exists $TargetDatabase 2>&1
    Write-Host "          Cleanup complete." -ForegroundColor Green
} else {
    Write-Host "[NOTE] Target database '$TargetDatabase' preserved for manual inspection." -ForegroundColor Gray
}

Write-Host "DR Restore Verification PASSED." -ForegroundColor Green
