<#
.SYNOPSIS
  Neon connectivity and app verification for BoxCostPro (Windows PowerShell).

.DESCRIPTION
  - Verifies DATABASE_URL connectivity (Neon) with SSL
  - Checks presence of key tables and seed data
  - Optionally verifies API endpoints with Neon Auth JWT
  - Optionally verifies About page rendering

.PARAMETERS
  -DatabaseUrl  Neon Postgres URL. Defaults to $env:DATABASE_URL
  -ApiBaseUrl   Backend base URL. Default http://localhost:5000
  -FrontendUrl  Frontend base URL. Default http://localhost:5173
  -AuthToken    Bearer token (Neon Auth JWT) for protected endpoints
#>
param(
  [string]$DatabaseUrl = $env:DATABASE_URL,
  [string]$ApiBaseUrl = "http://localhost:5000",
  [string]$FrontendUrl = "http://localhost:5173",
  [string]$AuthToken
)

function Test-Command { param([string]$Name) return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue) }

Write-Host "== Neon Verification ==" -ForegroundColor Cyan
if (-not $DatabaseUrl) { Write-Error "DATABASE_URL is not set. Provide -DatabaseUrl or set env var."; exit 1 }

if (-not (Test-Command psql)) { Write-Warning "psql not found. Install PostgreSQL client or run checks manually." } else {
  Write-Host "Database: version & user" -ForegroundColor Green
  psql $DatabaseUrl -c "SELECT current_database(), current_user, version();"

  Write-Host "Tables (sample)" -ForegroundColor Green
  psql $DatabaseUrl -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1 LIMIT 20;"

  Write-Host "Seed data checks" -ForegroundColor Green
  psql $DatabaseUrl -c "SELECT COUNT(*) AS shades FROM paper_shades;"
  psql $DatabaseUrl -c "SELECT flute_type, COUNT(*) FROM flute_settings GROUP BY flute_type ORDER BY flute_type;"
  psql $DatabaseUrl -c "SELECT COUNT(*) AS rules FROM paper_pricing_rules;"
}

Write-Host "API checks" -ForegroundColor Cyan
try {
  $headers = @{ }
  if ($AuthToken) { $headers.Add("Authorization", "Bearer $AuthToken") }

  $userResp = Invoke-WebRequest -Uri "$ApiBaseUrl/api/auth/user" -Headers $headers -Method GET -ErrorAction Stop
  Write-Host "/api/auth/user status: $($userResp.StatusCode)" -ForegroundColor Green
} catch { Write-Warning "User endpoint check failed: $($_.Exception.Message)" }

try {
  $onbResp = Invoke-WebRequest -Uri "$ApiBaseUrl/api/onboarding/status" -Headers $headers -Method GET -ErrorAction Stop
  Write-Host "/api/onboarding/status status: $($onbResp.StatusCode)" -ForegroundColor Green
} catch { Write-Warning "Onboarding status check failed: $($_.Exception.Message)" }

Write-Host "Frontend checks" -ForegroundColor Cyan
try {
  $aboutResp = Invoke-WebRequest -Uri "$FrontendUrl/about.html" -Method GET -ErrorAction Stop
  $hasDcoreText = $aboutResp.Content -match "DCore Systems LLP"
  $hasLogoRef = $aboutResp.Content -match "/dcore-logo\.png"
  Write-Host "About page present: $($aboutResp.StatusCode) | DCore text: $hasDcoreText | Logo ref: $hasLogoRef" -ForegroundColor Green
} catch { Write-Warning "About page check failed: $($_.Exception.Message)" }

Write-Host "Done." -ForegroundColor Green
