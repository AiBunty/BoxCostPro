# Replit DB migration helper (PowerShell)
# Usage: run in Replit shell that supports PowerShell, or locally with Replit DB URL
#   .\scripts\replit-migrate.ps1

Write-Host "Starting Drizzle migration for Replit DB..." -ForegroundColor Cyan

if (-not $env:DATABASE_URL -or $env:DATABASE_URL.Trim().Length -eq 0) {
  Write-Host "DATABASE_URL is not set. Set it in Secrets or session and rerun." -ForegroundColor Yellow
  exit 1
}

Write-Host "Using DATABASE_URL: $($env:DATABASE_URL)" -ForegroundColor Gray

Push-Location (Join-Path $PSScriptRoot "..")
try {
  npm.cmd run db:push
  if ($LASTEXITCODE -ne 0) {
    Write-Host "drizzle-kit push failed." -ForegroundColor Red
    exit $LASTEXITCODE
  }
  Write-Host "Migration applied successfully." -ForegroundColor Green
}
finally {
  Pop-Location
}
