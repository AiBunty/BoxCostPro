## **Deploy to Replit**
 - **Push to GitHub:** Initialize and push this workspace to your GitHub repo (`main` branch recommended).
 - **Import in Replit:** Use "Import from GitHub" to create a Replit project from your repo.
 - **Set Secrets:** In Replit, add required environment variables in the Secrets panel:
	 - `DATABASE_URL` → e.g., `postgresql://postgres:password@helium/heliumdb?sslmode=disable`
	 - `JWT_SECRET`, `SESSION_SECRET`
	 - `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` (if using Google OAuth)
 - **Install & Run:** In the Replit shell:
	 - `npm install`
	 - `npm run dev`
 - **Migrate DB schema:** Apply the same Drizzle migration used locally:
	 - Quick option: `npm run db:push`
	 - Or use the helpers:
		 - PowerShell: see [scripts/replit-migrate.ps1](scripts/replit-migrate.ps1)
		 - Bash: see [scripts/replit-migrate.sh](scripts/replit-migrate.sh)

### **Scripts Reference**
- Schema dump:
	- Bash: `npm run db:schema` → saves schema to [attached_assets/schema.sql](attached_assets/schema.sql) (or tables/columns text if `pg_dump` missing)
	- PowerShell: `npm run db:schema:ps`
- DB inspect:
	- `psql $DATABASE_URL -f scripts/db-inspect.sql` → column types, counts, missing emails
- Safe migration:
	- `npm run replit:migrate` → runs Drizzle push (review prompts carefully to avoid data loss)
	- See “Issue 6: Drizzle Push — Safe Mode” in [REPLIT_DEPLOYMENT_GUIDE.md](REPLIT_DEPLOYMENT_GUIDE.md)

### **Workflow to keep DB in sync**
 - Make schema changes locally, then:
	 - Locally: set `DATABASE_URL` and run `npm run db:push`
	 - Push code to GitHub
	 - In Replit: Pull/import latest, ensure `DATABASE_URL` is set, then run `npm run db:push`

### **Troubleshooting**
 - If you see TLS errors on Replit Postgres, switch to `?sslmode=require`.
 - If the server complains about unset env vars, add them in Replit Secrets and restart.
 - Replit provides its own `PORT`; the server reads `process.env.PORT` in [server/app.ts](server/app.ts).

# BoxCostPro — Local Setup

## Prerequisites
- Node.js (LTS 18.x or 20.x)
- PostgreSQL (or Neon)
- npm / pnpm / yarn

## Environment
Copy `.env.example` to `.env` and populate the variables. Key variables:
- `DATABASE_URL` — Postgres connection string
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — (optional, legacy) Supabase credentials for auth. The app now supports direct Google OAuth and session-based auth without Supabase.
- `GOOGLE_OAUTH_REDIRECT_URL` — set to your deployed redirect URL, e.g. `https://www.paperboxerp.com/auth/google/callback` for production.

## Install
```powershell
npm install
```

## Run tests
```powershell
npm test
```

## Start dev server
```powershell
npm run dev
```

Notes:
- The app expects certain DB tables (see `shared/schema.ts`). Use `drizzle-kit` to push migrations or run schema setup.
- Supabase is optional. If `VITE_SUPABASE_*` / `SUPABASE_*` env vars are not set the app will use direct Google OAuth and server session endpoints instead of Supabase.
	- For production Google OAuth, set `APP_URL` and `GOOGLE_OAUTH_REDIRECT_URL` to your site (example: `https://www.paperboxerp.com` and `https://www.paperboxerp.com/auth/google/callback`).
