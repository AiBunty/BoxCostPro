# Rollback to Neon PostgreSQL Database
# This script restores the .env backup to switch back to Neon

Write-Host "🔙 Rolling Back to Neon PostgreSQL Database" -ForegroundColor Cyan
Write-Host "============================================`n" -ForegroundColor Cyan

$envFile = Join-Path $PSScriptRoot "..\..\..\.env"
$backupFile = Join-Path $PSScriptRoot "..\..\..\.env.neon.backup"

# Check if backup exists
if (-not (Test-Path $backupFile)) {
    Write-Host "❌ Backup file not found: $backupFile" -ForegroundColor Red
    Write-Host "`n   No backup available to restore." -ForegroundColor Yellow
    Write-Host "   You'll need to manually update DATABASE_URL in .env" -ForegroundColor Yellow
    exit 1
}

Write-Host "📦 Backup file found" -ForegroundColor Green
Write-Host "   Location: $backupFile`n" -ForegroundColor White

# Show current DATABASE_URL
if (Test-Path $envFile) {
    $currentEnv = Get-Content $envFile -Raw
    if ($currentEnv -match 'DATABASE_URL=(.*)') {
        $currentUrl = $matches[1].Trim()
        Write-Host "Current DATABASE_URL:" -ForegroundColor Yellow
        Write-Host "   $($currentUrl -replace ':([^:@]+)@', ':***@')" -ForegroundColor White
    }
}

# Show backup DATABASE_URL
$backupEnv = Get-Content $backupFile -Raw
if ($backupEnv -match 'DATABASE_URL=(.*)') {
    $backupUrl = $matches[1].Trim()
    Write-Host "`nBackup DATABASE_URL:" -ForegroundColor Yellow
    Write-Host "   $($backupUrl -replace ':([^:@]+)@', ':***@')" -ForegroundColor White
}

# Confirm rollback
Write-Host "`n⚠️  Are you sure you want to rollback to Neon?" -ForegroundColor Yellow
$response = Read-Host "This will restore the backup .env file (yes/no)"

if ($response -ne "yes") {
    Write-Host "`n❌ Rollback cancelled" -ForegroundColor Red
    exit 0
}

# Restore backup
Write-Host "`n🔄 Restoring .env from backup..." -ForegroundColor Yellow

Copy-Item $backupFile $envFile -Force

Write-Host "✓ .env restored successfully" -ForegroundColor Green

# Verify restoration
$restoredEnv = Get-Content $envFile -Raw
if ($restoredEnv -match 'DATABASE_URL=(.*)') {
    $restoredUrl = $matches[1].Trim()
    Write-Host "`nRestored DATABASE_URL:" -ForegroundColor Green
    Write-Host "   $($restoredUrl -replace ':([^:@]+)@', ':***@')" -ForegroundColor White
}

# Test Neon connection (if possible)
Write-Host "`n🔌 Testing Neon connection..." -ForegroundColor Yellow
Write-Host "   Note: This test may not work if psql doesn't support Neon's serverless driver" -ForegroundColor Gray

# Extract connection details from URL
if ($restoredUrl -match 'postgresql://([^:]+):([^@]+)@([^/]+)/(.+)') {
    $username = $matches[1]
    $password = $matches[2]
    $hostPort = $matches[3]
    $database = $matches[4]

    # For Neon, we'll skip the psql test and just verify the URL format
    if ($hostPort -like "*neon.tech*" -or $hostPort -like "*neon.postgres*") {
        Write-Host "✓ Neon connection URL format is valid" -ForegroundColor Green
    } else {
        Write-Host "⚠️  URL doesn't appear to be a Neon database" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠️  Unable to parse DATABASE_URL" -ForegroundColor Yellow
}

# Check if dev server is running
Write-Host "`n🔍 Checking for running dev server..." -ForegroundColor Yellow

$nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -like "*vite*" -or $_.CommandLine -like "*dev*"
}

if ($nodeProcesses) {
    Write-Host "⚠️  Dev server is running" -ForegroundColor Yellow
    Write-Host "`n   Please restart the dev server to apply changes:" -ForegroundColor Yellow
    Write-Host "   1. Stop current server (Ctrl+C in the terminal)" -ForegroundColor White
    Write-Host "   2. Run: npm run dev" -ForegroundColor White
} else {
    Write-Host "✓ No dev server running" -ForegroundColor Green
    Write-Host "`n   Start the dev server:" -ForegroundColor Yellow
    Write-Host "   npm run dev" -ForegroundColor White
}

Write-Host "`n✅ Successfully rolled back to Neon!" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green
Write-Host "`n📝 Summary:" -ForegroundColor White
Write-Host "   Database: Neon PostgreSQL" -ForegroundColor White
Write-Host "   Backup preserved: .env.neon.backup" -ForegroundColor White
Write-Host "`n📌 To switch back to local:" -ForegroundColor Yellow
Write-Host "   powershell -ExecutionPolicy Bypass -File scripts/migration/switch-to-local-db.ps1`n" -ForegroundColor White
