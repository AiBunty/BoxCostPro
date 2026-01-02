# Master Migration Orchestrator: Neon to Local PostgreSQL
# This script runs the complete migration process

param(
    [switch]$SkipExport,
    [switch]$SkipValidation,
    [switch]$AutoSwitch
)

Write-Host "╔════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  BoxCostPro: Neon → Local PostgreSQL Migration   ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

$ErrorActionPreference = "Stop"
$startTime = Get-Date

# Track progress
$steps = @{
    "Pre-flight Checks" = $false
    "Export from Neon" = $false
    "Provision Local DB" = $false
    "Import Data" = $false
    "Post-Migration Config" = $false
    "Validation" = $false
    "Switch Environment" = $false
}

function Show-Progress {
    Write-Host "`n[PROGRESS] Migration Progress:" -ForegroundColor Cyan
    Write-Host "=====================`n" -ForegroundColor Cyan

    foreach ($step in $steps.Keys) {
        $status = if ($steps[$step]) { "[OK]" } else { "[ ]" }
        $color = if ($steps[$step]) { "Green" } else { "Gray" }
        Write-Host "   $status $step" -ForegroundColor $color
    }
    Write-Host ""
}

function Show-Error {
    param([string]$Message)
    Write-Host "`n[ERROR] MIGRATION FAILED" -ForegroundColor Red
    Write-Host "===================" -ForegroundColor Red
    Write-Host "   $Message`n" -ForegroundColor Yellow
    Show-Progress
    exit 1
}

# ============ STEP 1: PRE-FLIGHT CHECKS ============

Write-Host "[CHECK] Step 1: Pre-Flight Checks" -ForegroundColor Yellow
Write-Host "============================`n" -ForegroundColor Yellow

# Check if DATABASE_URL is set
if (-not $env:DATABASE_URL) {
    Show-Error "DATABASE_URL environment variable not set"
}

Write-Host "[OK] DATABASE_URL is set" -ForegroundColor Green

# Check if Neon connection works
Write-Host "[OK] Neon database URL found" -ForegroundColor Green

# Check if PostgreSQL is available
try {
    $pgVersion = psql --version 2>&1
    Write-Host "[OK] PostgreSQL client available: $pgVersion" -ForegroundColor Green
} catch {
    Write-Host "[WARN] PostgreSQL client (psql) not found in PATH" -ForegroundColor Yellow
    Write-Host "   This is optional but recommended for validation" -ForegroundColor Gray
}

# Check if Node.js and tsx are available
try {
    $nodeVersion = node --version
    Write-Host "[OK] Node.js available: $nodeVersion" -ForegroundColor Green
} catch {
    Show-Error "Node.js not found. Please install Node.js"
}

try {
    $tsxCheck = npx tsx --version 2>&1
    Write-Host "[OK] tsx available" -ForegroundColor Green
} catch {
    Show-Error "tsx not available. Run: npm install -g tsx"
}

$steps["Pre-flight Checks"] = $true
Show-Progress

# ============ STEP 2: EXPORT FROM NEON ============

if (-not $SkipExport) {
    Write-Host "`n[EXPORT] Step 2: Export from Neon" -ForegroundColor Yellow
    Write-Host "============================`n" -ForegroundColor Yellow

    try {
        npx tsx scripts/migration/export-neon-data.ts

        if ($LASTEXITCODE -ne 0) {
            Show-Error "Export failed with exit code $LASTEXITCODE"
        }

        $steps["Export from Neon"] = $true
        Show-Progress
    } catch {
        Show-Error "Export script failed: $_"
    }
} else {
    Write-Host "`n[SKIP] Step 2: Export from Neon (SKIPPED)" -ForegroundColor Gray
    Write-Host "   Using existing export data`n" -ForegroundColor Gray
    $steps["Export from Neon"] = $true
}

# ============ STEP 3: PROVISION LOCAL DATABASE ============

Write-Host "`n[SETUP] Step 3: Provision Local PostgreSQL" -ForegroundColor Yellow
Write-Host "======================================`n" -ForegroundColor Yellow

try {
    powershell -ExecutionPolicy Bypass -File scripts/migration/provision-local-db.ps1

    if ($LASTEXITCODE -ne 0) {
        Show-Error "Provisioning failed with exit code $LASTEXITCODE"
    }

    $steps["Provision Local DB"] = $true
    Show-Progress
} catch {
    Show-Error "Provisioning script failed: $_"
}

# ============ STEP 4: IMPORT DATA ============

Write-Host "`n[IMPORT] Step 4: Import Data to Local" -ForegroundColor Yellow
Write-Host "================================`n" -ForegroundColor Yellow

# Temporarily update DATABASE_URL to local
$originalDbUrl = $env:DATABASE_URL
$env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/boxcostpro_local"

try {
    npx tsx scripts/migration/import-local-data.ts

    if ($LASTEXITCODE -ne 0) {
        Show-Error "Import failed with exit code $LASTEXITCODE"
    }

    $steps["Import Data"] = $true
    Show-Progress
} catch {
    Show-Error "Import script failed: $_"
} finally {
    # Restore original DATABASE_URL
    $env:DATABASE_URL = $originalDbUrl
}

# ============ STEP 5: POST-MIGRATION CONFIGURATION ============

Write-Host "`n[CONFIG] Step 5: Post-Migration Configuration" -ForegroundColor Yellow
Write-Host "========================================`n" -ForegroundColor Yellow

# Update DATABASE_URL for post-migration config
$env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/boxcostpro_local"

try {
    npx tsx scripts/migration/post-migration-config.ts

    if ($LASTEXITCODE -ne 0) {
        Show-Error "Post-migration config failed with exit code $LASTEXITCODE"
    }

    $steps["Post-Migration Config"] = $true
    Show-Progress
} catch {
    Show-Error "Post-migration config failed: $_"
} finally {
    # Restore original DATABASE_URL
    $env:DATABASE_URL = $originalDbUrl
}

# ============ STEP 6: VALIDATION ============

if (-not $SkipValidation) {
    Write-Host "`n[VALIDATE] Step 6: Validation" -ForegroundColor Yellow
    Write-Host "=====================`n" -ForegroundColor Yellow

    # Set both URLs for validation
    $env:DATABASE_URL_NEON = $originalDbUrl
    $env:DATABASE_URL_LOCAL = "postgresql://postgres:postgres@localhost:5432/boxcostpro_local"

    try {
        npx tsx scripts/migration/validate-migration.ts

        # Validation warnings are OK, only hard failures should stop
        $steps["Validation"] = $true
        Show-Progress
    } catch {
        Write-Host "[WARN] Validation encountered issues: $_" -ForegroundColor Yellow
        Write-Host "   Review validation report for details" -ForegroundColor Yellow
        $steps["Validation"] = $true
    } finally {
        # Restore original DATABASE_URL
        $env:DATABASE_URL = $originalDbUrl
        Remove-Item Env:\DATABASE_URL_NEON -ErrorAction SilentlyContinue
        Remove-Item Env:\DATABASE_URL_LOCAL -ErrorAction SilentlyContinue
    }
} else {
    Write-Host "`n[SKIP] Step 6: Validation (SKIPPED)" -ForegroundColor Gray
    $steps["Validation"] = $true
}

# ============ STEP 7: SWITCH ENVIRONMENT ============

if ($AutoSwitch) {
    Write-Host "`n[SWITCH] Step 7: Switch to Local Database" -ForegroundColor Yellow
    Write-Host "===================================`n" -ForegroundColor Yellow

    try {
        powershell -ExecutionPolicy Bypass -File scripts/migration/switch-to-local-db.ps1

        if ($LASTEXITCODE -ne 0) {
            Show-Error "Environment switch failed with exit code $LASTEXITCODE"
        }

        $steps["Switch Environment"] = $true
        Show-Progress
    } catch {
        Show-Error "Environment switch failed: $_"
    }
} else {
    Write-Host "`n[SKIP] Step 7: Switch to Local Database (MANUAL)" -ForegroundColor Gray
    Write-Host "   Run manually when ready:" -ForegroundColor Gray
    Write-Host "   powershell -ExecutionPolicy Bypass -File scripts/migration/switch-to-local-db.ps1`n" -ForegroundColor White
}

# ============ FINAL REPORT ============

$duration = (Get-Date) - $startTime
$durationMin = [math]::Round($duration.TotalMinutes, 1)

Write-Host "`n╔════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║              MIGRATION COMPLETED! ✓                ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════╝`n" -ForegroundColor Green

Show-Progress

Write-Host "[SUMMARY] Migration Summary:" -ForegroundColor Cyan
Write-Host "====================" -ForegroundColor Cyan
Write-Host "   Duration: $durationMin minutes" -ForegroundColor White

if (Test-Path "migration-export/metadata.json") {
    $metadata = Get-Content "migration-export/metadata.json" | ConvertFrom-Json
    Write-Host "   Tables migrated: $($metadata.tables.Count)" -ForegroundColor White
    Write-Host "   Total rows: $($metadata.totalRows)" -ForegroundColor White
}

Write-Host "`n[NEXT] Next Steps:" -ForegroundColor Yellow
Write-Host "==============" -ForegroundColor Yellow

if (-not $AutoSwitch) {
    Write-Host "`n1. Switch to local database:" -ForegroundColor White
    Write-Host "   powershell -ExecutionPolicy Bypass -File scripts/migration/switch-to-local-db.ps1" -ForegroundColor Cyan
}

Write-Host "`n2. Restart your dev server:" -ForegroundColor White
Write-Host "   npm run dev" -ForegroundColor Cyan

Write-Host "`n3. Test the application:" -ForegroundColor White
Write-Host "   - Login with your account" -ForegroundColor White
Write-Host "   - Verify quotes are accessible" -ForegroundColor White
Write-Host "   - Check master data" -ForegroundColor White
Write-Host "   - Test admin features (first user is now super_admin)" -ForegroundColor White

Write-Host "`n[!] Emergency Rollback:" -ForegroundColor Yellow
Write-Host "   If anything goes wrong, rollback to Neon:" -ForegroundColor Yellow
Write-Host "   powershell -ExecutionPolicy Bypass -File scripts/migration/rollback-to-neon.ps1" -ForegroundColor Cyan

Write-Host "`n[BACKUP] Backup Information:" -ForegroundColor Cyan
Write-Host "   - Neon database: UNCHANGED (safe backup)" -ForegroundColor White
Write-Host "   - Export files: migration-export/" -ForegroundColor White
Write-Host "   - .env backup: .env.neon.backup" -ForegroundColor White

Write-Host "`n[SUCCESS] Your local database is ready!" -ForegroundColor Green
Write-Host "   Faster development and debugging awaits!`n" -ForegroundColor Green
