# Check prerequisites for running BoxCostPro on Windows
Write-Host "== BoxCostPro Prerequisite Checker =="

# Check Node
try {
    $nodeVersion = (node --version) -replace "\r|\n",""
    Write-Host "Node detected: $nodeVersion"
} catch {
    Write-Host "Node.js not found. Install LTS from https://nodejs.org/ " -ForegroundColor Red
    exit 1
}

# Check npm
try {
    $npmVersion = (npm --version) -replace "\r|\n",""
    Write-Host "npm detected: $npmVersion"
} catch {
    Write-Host "npm not found. Ensure Node installer added npm to PATH." -ForegroundColor Red
    exit 1
}

Write-Host "Recommended Node: 18.x or 20.x (LTS)."

Write-Host "`nIf you don't have Node/npm, download and install Node.js LTS: https://nodejs.org/"
Write-Host "Alternatively install via winget: `n  winget install OpenJS.NodeJS.LTS"

Write-Host "`nRecommended next commands (run from project root):"
Write-Host "  npm install"
Write-Host "  npm run check"
Write-Host "  npm run dev"

Write-Host "`nIf you prefer pnpm or yarn, install them globally and then run:`n  pnpm install`n  pnpm dev"

Write-Host "`nEnvironment notes:"
Write-Host "- You will need database and Supabase config env vars for full functionality (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, DATABASE_URL, etc.)."
Write-Host "- For local DB use PostgreSQL or Neon. See project README or ask me to add a sample .env template."

Write-Host "\nDone. After installing, run the recommended commands to install deps and start the dev server." -ForegroundColor Green
