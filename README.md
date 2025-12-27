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
