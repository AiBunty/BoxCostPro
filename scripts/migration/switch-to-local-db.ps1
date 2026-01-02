# Switch Application to Use Local PostgreSQL Database
# This script updates .env to use local database and restarts the dev server

Write-Host "🔄 Switching to Local PostgreSQL Database" -ForegroundColor Cyan
Write-Host "==========================================`n" -ForegroundColor Cyan

$envFile = Join-Path $PSScriptRoot "..\..\..\.env"
$backupFile = Join-Path $PSScriptRoot "..\..\..\.env.neon.backup"

# Check if .env exists
if (-not (Test-Path $envFile)) {
    Write-Host "❌ .env file not found: $envFile" -ForegroundColor Red
    exit 1
}

# Backup current .env
Write-Host "📦 Backing up current .env..." -ForegroundColor Yellow

if (Test-Path $backupFile) {
    Write-Host "⚠️  Backup already exists: $backupFile" -ForegroundColor Yellow
    $response = Read-Host "Overwrite existing backup? (yes/no)"

    if ($response -ne "yes") {
        Write-Host "❌ Aborted. Existing backup not overwritten." -ForegroundColor Red
        exit 1
    }
}

Copy-Item $envFile $backupFile -Force
Write-Host "✓ Backed up to: .env.neon.backup" -ForegroundColor Green

# Read current .env
$envContent = Get-Content $envFile -Raw

# Extract current DATABASE_URL
if ($envContent -match 'DATABASE_URL=(.*)') {
    $currentUrl = $matches[1].Trim()
    Write-Host "`nCurrent DATABASE_URL:" -ForegroundColor Yellow
    Write-Host "   $($currentUrl -replace ':([^:@]+)@', ':***@')" -ForegroundColor White
}

# Define new local DATABASE_URL
$localDbUrl = "postgresql://postgres:postgres@localhost:5432/boxcostpro_local"

Write-Host "`nNew DATABASE_URL:" -ForegroundColor Yellow
Write-Host "   $localDbUrl" -ForegroundColor White

# Update .env with local DATABASE_URL
Write-Host "`n⚙️  Updating .env file..." -ForegroundColor Yellow

$envContent = $envContent -replace 'DATABASE_URL=.*', "DATABASE_URL=$localDbUrl"
Set-Content $envFile -Value $envContent

Write-Host "✓ .env updated successfully" -ForegroundColor Green

# Test connection to local database
Write-Host "`n🔌 Testing local database connection..." -ForegroundColor Yellow

try {
    $testResult = psql -U postgres -h localhost -p 5432 -d boxcostpro_local -c "SELECT COUNT(*) FROM users;" 2>&1

    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Successfully connected to local database" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to connect to local database" -ForegroundColor Red
        Write-Host "   Error: $testResult" -ForegroundColor Red

        # Restore backup
        Write-Host "`n🔄 Restoring original .env..." -ForegroundColor Yellow
        Copy-Item $backupFile $envFile -Force
        Write-Host "✓ Original .env restored" -ForegroundColor Green

        exit 1
    }
} catch {
    Write-Host "❌ Error testing connection: $_" -ForegroundColor Red

    # Restore backup
    Write-Host "`n🔄 Restoring original .env..." -ForegroundColor Yellow
    Copy-Item $backupFile $envFile -Force
    Write-Host "✓ Original .env restored" -ForegroundColor Green

    exit 1
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

Write-Host "`n✅ Successfully switched to local database!" -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Green
Write-Host "`n📝 Summary:" -ForegroundColor White
Write-Host "   Database: boxcostpro_local" -ForegroundColor White
Write-Host "   Host: localhost:5432" -ForegroundColor White
Write-Host "   Backup: .env.neon.backup" -ForegroundColor White
Write-Host "`n📌 To rollback to Neon:" -ForegroundColor Yellow
Write-Host "   powershell -ExecutionPolicy Bypass -File scripts/migration/rollback-to-neon.ps1`n" -ForegroundColor White
