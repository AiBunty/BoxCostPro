<#
.SYNOPSIS
  Provision a local PostgreSQL database for BoxCostPro on Windows and push schema.

.DESCRIPTION
  - Option A: Use Docker (recommended) to run Postgres 15
  - Option B: Use an existing local Postgres instance
  - Sets DATABASE_URL in current session and runs drizzle schema push
  - Optionally seeds defaults (shades, flute settings, pricing rules)

.NOTES
  Run in PowerShell: powershell -ExecutionPolicy Bypass -File scripts/local-db-setup.ps1
#>

param(
  [string]$DbName = "boxcostpro",
  [string]$DbUser = "postgres",
  [string]$DbPassword = "postgres",
  [int]$Port = 5432,
  [switch]$UseDocker,
  [switch]$SeedDefaults
)

function Test-Command {
  param([string]$Name)
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  return $null -ne $cmd
}

Write-Host "== BoxCostPro Local DB Setup ==" -ForegroundColor Cyan

if ($UseDocker -or (Test-Command -Name docker)) {
  Write-Host "Docker detected. Using Docker-based Postgres." -ForegroundColor Green
  $containerName = "boxcostpro-postgres"
  $exists = docker ps -a --format "{{.Names}}" | Where-Object { $_ -eq $containerName }
  if (-not $exists) {
    Write-Host "Starting postgres:15 container..." -ForegroundColor Cyan
    docker run --name $containerName -e POSTGRES_PASSWORD=$DbPassword -e POSTGRES_USER=$DbUser -e POSTGRES_DB=$DbName -p $Port`:5432 -d postgres:15
    Start-Sleep -Seconds 3
  } else {
    Write-Host "Container exists. Ensuring it's running..." -ForegroundColor Yellow
    docker start $containerName | Out-Null
  }
  $env:DATABASE_URL = "postgres://$DbUser:$DbPassword@localhost:$Port/$DbName"
}
else {
  Write-Host "Docker not found. Using existing/local Postgres instance." -ForegroundColor Yellow
  if (-not $env:DATABASE_URL) {
    $env:DATABASE_URL = "postgres://$DbUser:$DbPassword@localhost:$Port/$DbName"
    Write-Host "DATABASE_URL not set; using default: $env:DATABASE_URL" -ForegroundColor Yellow
  }
}

Write-Host "Testing connection with psql..." -ForegroundColor Cyan
if (-not (Test-Command -Name psql)) {
  Write-Warning "psql not found. Install PostgreSQL client or use Docker container's psql." 
} else {
  psql $env:DATABASE_URL -c "SELECT version();" | Out-Null
}

Write-Host "Pushing Drizzle schema..." -ForegroundColor Cyan
# Drizzle requires DATABASE_URL; this runs inside project root
npm run db:push

if ($SeedDefaults) {
  Write-Host "Seeding default masters (shades, flute settings, pricing rules, BF entries)..." -ForegroundColor Cyan
  if (Test-Command -Name psql) {
    psql $env:DATABASE_URL -f scripts/restore-default-masters.sql
  } else {
    Write-Warning "psql not available; please run: psql $env:DATABASE_URL -f scripts/restore-default-masters.sql"
  }
}

Write-Host "Done. DATABASE_URL set in this session." -ForegroundColor Green
Write-Host "Start app with: npm run dev" -ForegroundColor Green
