# Local Database Setup (Windows)

Thoroughly test the app locally with a PostgreSQL instance before hosting to Replit.

## Prerequisites
- Windows PowerShell
- Node.js 18+ and npm
- One of:
  - Docker Desktop (recommended), or
  - PostgreSQL installed locally (psql client)

## Option A: Docker-based Postgres (recommended)
```powershell
# From project root
powershell -ExecutionPolicy Bypass -File scripts/local-db-setup.ps1 -UseDocker -SeedDefaults

# DATABASE_URL is set in this session; run the app
npm run dev
```

Or use the npm convenience scripts:
```powershell
npm run local:db       # Docker + seed defaults
npm run dev

# Faster boot without seeding
npm run local:db:noseed
npm run dev
```

## Option B: Existing Local Postgres
1. Create database and user (if needed):
```powershell
# Adjust credentials to your setup
$env:DATABASE_URL = "postgres://postgres:postgres@localhost:5432/boxcostpro"
psql $env:DATABASE_URL -c "SELECT version();"
```
2. Push schema via Drizzle:
```powershell
npm run db:push
```
3. Seed defaults (optional):
```powershell
psql $env:DATABASE_URL -f scripts/restore-default-masters.sql
```
4. Start the app:
```powershell
npm run dev
```

## Verify
```powershell
psql $env:DATABASE_URL -c "SELECT COUNT(*) FROM tenants;"          # should be 0 initially
psql $env:DATABASE_URL -c "SELECT COUNT(*) FROM paper_shades;"      # should be > 0 after seeding
psql $env:DATABASE_URL -c "SELECT flute_type, COUNT(*) FROM flute_settings GROUP BY flute_type;"
```

### One-shot Neon/App Verification
```powershell
# Uses DATABASE_URL, hits APIs, and checks About page
npm run verify:neon

# With Neon Auth token for protected endpoints
powershell -ExecutionPolicy Bypass -File scripts/neon-verify.ps1 -AuthToken "<YOUR_JWT>"
```

## Troubleshooting
- "DATABASE_URL not set" in logs: set it in your PowerShell session before running `npm run dev`.
- Port conflict (5432): stop other Postgres services or change `-Port` in `local-db-setup.ps1`.
- Drizzle push errors: ensure `drizzle.config.ts` points to `shared/schema.ts` and env is set.

## Next Steps
- Sign up or sign in locally to create a tenant automatically and test onboarding.
- Open Masters → Master Settings to verify shades and flute defaults.
