# Provision Local PostgreSQL Database for BoxCostPro
# This script sets up a local PostgreSQL database and applies the schema

Write-Host "🚀 Provisioning Local PostgreSQL Database" -ForegroundColor Cyan
Write-Host "==========================================`n" -ForegroundColor Cyan

$DB_NAME = "boxcostpro_local"
$DB_USER = "postgres"
$DB_PASSWORD = "postgres"
$DB_HOST = "localhost"
$DB_PORT = "5432"

# Check if PostgreSQL is running
Write-Host "🔍 Checking PostgreSQL status..." -ForegroundColor Yellow

try {
    $pgStatus = psql -U $DB_USER -h $DB_HOST -p $DB_PORT -c "SELECT version();" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ PostgreSQL is not running or not accessible" -ForegroundColor Red
        Write-Host "`nPlease ensure PostgreSQL is installed and running:" -ForegroundColor Yellow
        Write-Host "  Option 1: Local PostgreSQL installation" -ForegroundColor White
        Write-Host "  Option 2: Docker - Run: docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:15" -ForegroundColor White
        exit 1
    }
    Write-Host "✓ PostgreSQL is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Error checking PostgreSQL: $_" -ForegroundColor Red
    exit 1
}

# Check if database already exists
Write-Host "`n🔍 Checking if database exists..." -ForegroundColor Yellow

$dbExists = psql -U $DB_USER -h $DB_HOST -p $DB_PORT -lqt 2>$null | Select-String -Pattern $DB_NAME

if ($dbExists) {
    Write-Host "⚠️  Database '$DB_NAME' already exists" -ForegroundColor Yellow
    $response = Read-Host "Do you want to DROP and recreate it? This will DELETE all existing data! (yes/no)"

    if ($response -eq "yes") {
        Write-Host "`n🗑️  Dropping existing database..." -ForegroundColor Yellow

        # Terminate existing connections
        psql -U $DB_USER -h $DB_HOST -p $DB_PORT -c "SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity WHERE pg_stat_activity.datname = '$DB_NAME' AND pid <> pg_backend_pid();" postgres 2>$null

        # Drop database
        psql -U $DB_USER -h $DB_HOST -p $DB_PORT -c "DROP DATABASE IF EXISTS $DB_NAME;" postgres

        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ Database dropped successfully" -ForegroundColor Green
        } else {
            Write-Host "❌ Failed to drop database" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "`n⚠️  Using existing database. Schema will be updated." -ForegroundColor Yellow
    }
} else {
    Write-Host "✓ Database does not exist, will create new one" -ForegroundColor Green
}

# Create database if it doesn't exist
if (-not $dbExists -or $response -eq "yes") {
    Write-Host "`n📦 Creating database '$DB_NAME'..." -ForegroundColor Yellow

    psql -U $DB_USER -h $DB_HOST -p $DB_PORT -c "CREATE DATABASE $DB_NAME;" postgres

    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Database created successfully" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to create database" -ForegroundColor Red
        exit 1
    }
}

# Update .env.local or create temporary env file for schema push
Write-Host "`n⚙️  Preparing local DATABASE_URL..." -ForegroundColor Yellow

$LOCAL_DB_URL = "postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

# Backup current DATABASE_URL
$envFile = Join-Path $PSScriptRoot "..\..\..\.env"
$envBackup = Join-Path $PSScriptRoot "..\..\..\.env.provision.backup"

if (Test-Path $envFile) {
    Copy-Item $envFile $envBackup -Force
    Write-Host "✓ Backed up .env to .env.provision.backup" -ForegroundColor Green
}

# Temporarily update DATABASE_URL for schema push
$envContent = Get-Content $envFile -Raw
$envContent = $envContent -replace 'DATABASE_URL=.*', "DATABASE_URL=$LOCAL_DB_URL"
Set-Content $envFile -Value $envContent

Write-Host "✓ Temporarily updated DATABASE_URL to local" -ForegroundColor Green

# Apply schema using drizzle
Write-Host "`n📋 Applying database schema..." -ForegroundColor Yellow
Write-Host "   Running: npm run db:push`n" -ForegroundColor White

Push-Location (Join-Path $PSScriptRoot "..\..\..")

try {
    npm run db:push

    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✓ Schema applied successfully" -ForegroundColor Green
    } else {
        Write-Host "`n❌ Schema push failed" -ForegroundColor Red

        # Restore original .env
        if (Test-Path $envBackup) {
            Copy-Item $envBackup $envFile -Force
            Remove-Item $envBackup -Force
            Write-Host "✓ Restored original .env" -ForegroundColor Green
        }

        Pop-Location
        exit 1
    }
} catch {
    Write-Host "`n❌ Error during schema push: $_" -ForegroundColor Red

    # Restore original .env
    if (Test-Path $envBackup) {
        Copy-Item $envBackup $envFile -Force
        Remove-Item $envBackup -Force
    }

    Pop-Location
    exit 1
}

Pop-Location

# Restore original .env
if (Test-Path $envBackup) {
    Copy-Item $envBackup $envFile -Force
    Remove-Item $envBackup -Force
    Write-Host "✓ Restored original .env" -ForegroundColor Green
}

# Verify schema
Write-Host "`n🔍 Verifying schema..." -ForegroundColor Yellow

$tableCount = psql -U $DB_USER -h $DB_HOST -p $DB_PORT -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';"

if ($tableCount -gt 0) {
    Write-Host "✓ Found $($tableCount.Trim()) tables in schema" -ForegroundColor Green
} else {
    Write-Host "⚠️  No tables found in schema" -ForegroundColor Yellow
}

# Optimize settings for bulk import
Write-Host "`n⚙️  Optimizing database for bulk import..." -ForegroundColor Yellow

psql -U $DB_USER -h $DB_HOST -p $DB_PORT -d $DB_NAME -c "ALTER DATABASE $DB_NAME SET synchronous_commit = off;" 2>$null
psql -U $DB_USER -h $DB_HOST -p $DB_PORT -d $DB_NAME -c "ALTER DATABASE $DB_NAME SET wal_level = minimal;" 2>$null
psql -U $DB_USER -h $DB_HOST -p $DB_PORT -d $DB_NAME -c "ALTER DATABASE $DB_NAME SET max_wal_senders = 0;" 2>$null

Write-Host "✓ Database optimized for import" -ForegroundColor Green

Write-Host "`n✅ Local database provisioned successfully!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host "   Database: $DB_NAME" -ForegroundColor White
Write-Host "   Host: $DB_HOST" -ForegroundColor White
Write-Host "   Port: $DB_PORT" -ForegroundColor White
Write-Host "   Tables: $($tableCount.Trim())" -ForegroundColor White
Write-Host "`n   Connection URL:" -ForegroundColor White
Write-Host "   $LOCAL_DB_URL" -ForegroundColor Cyan
Write-Host "`n📌 Next step: Run the import script to load data" -ForegroundColor Yellow
Write-Host "   npx tsx scripts/migration/import-local-data.ts`n" -ForegroundColor White
