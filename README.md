# BoxCostPro — Local Setup

## Prerequisites
- Node.js (LTS 18.x or 20.x)
- PostgreSQL (or Neon)
- npm / pnpm / yarn

## Environment
Copy `.env.example` to `.env` and populate the variables. Key variables:
- `DATABASE_URL` — Postgres connection string
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — (optional) Supabase credentials for auth

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
- If you don't use Supabase, the app will fall back to session-based auth. For end-to-end local auth, set the Supabase env vars.
