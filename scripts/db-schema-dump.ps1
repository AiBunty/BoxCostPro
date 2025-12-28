# Schema-only dump helper for Replit DB (PowerShell)
# Usage: powershell -ExecutionPolicy Bypass -File scripts/db-schema-dump.ps1

Write-Host "Starting schema export..." -ForegroundColor Cyan

if (-not $env:DATABASE_URL -or $env:DATABASE_URL.Trim().Length -eq 0) {
  Write-Host "DATABASE_URL is not set. Set it in Secrets or session and rerun." -ForegroundColor Yellow
  exit 1
}

$OutputDir = "attached_assets"
$SchemaPath = Join-Path $OutputDir "schema.sql"
$TablesPath = Join-Path $OutputDir "schema_tables.txt"
$ColumnsPath = Join-Path $OutputDir "schema_columns.txt"

if (-not (Test-Path $OutputDir)) { New-Item -ItemType Directory -Path $OutputDir | Out-Null }

# Try pg_dump first
$pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
if ($pgDump) {
  Write-Host "Using pg_dump to write $SchemaPath" -ForegroundColor Gray
  & pg_dump --schema-only --no-owner --no-privileges "$env:DATABASE_URL" | Out-File -FilePath $SchemaPath -Encoding utf8
  Write-Host "Schema dump saved to $SchemaPath" -ForegroundColor Green
} else {
  Write-Host "pg_dump not found; falling back to psql queries" -ForegroundColor Yellow
  & psql $env:DATABASE_URL -c "\\dt" | Out-File -FilePath $TablesPath -Encoding utf8
  & psql $env:DATABASE_URL -c "SELECT table_name, column_name, data_type FROM information_schema.columns ORDER BY table_name, ordinal_position;" | Out-File -FilePath $ColumnsPath -Encoding utf8
  Write-Host "Tables saved to $TablesPath" -ForegroundColor Green
  Write-Host "Columns/types saved to $ColumnsPath" -ForegroundColor Green
}

Write-Host "Schema export complete." -ForegroundColor Cyan