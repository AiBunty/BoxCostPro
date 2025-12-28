-- One-shot fixer: dedupe duplicates, add unique constraints, backup quotes legacy, cast created_at
-- Usage (Replit Shell):
--   psql $DATABASE_URL -f scripts/db-dedupe-and-constraints.sql

BEGIN;

-- 1) Backup legacy columns from quotes before any drops (non-destructive)
CREATE TABLE IF NOT EXISTS quotes_legacy AS
SELECT id, payment_terms, delivery_days, transport_charge, transport_remark, items,
       terms_snapshot, paper_prices_snapshot, transport_snapshot, moq_enabled, moq_value,
       payment_type, advance_percent, credit_days, custom_delivery_text, quote_number, valid_until
FROM quotes;

-- 2) Cast quotes.created_at from text to timestamp (adjust USING if needed)
ALTER TABLE quotes
  ALTER COLUMN created_at TYPE timestamp without time zone
  USING created_at::timestamp;

-- 3) Dedupe helpers: keep the earliest created row per key
-- user_profiles: unique user_id
WITH ranked_user_profiles AS (
  SELECT id, user_id,
         ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC NULLS LAST, id ASC) AS rn
  FROM user_profiles
)
DELETE FROM user_profiles up
USING ranked_user_profiles r
WHERE up.id = r.id AND r.rn > 1;

-- business_defaults: unique tenant_id
WITH ranked_business_defaults AS (
  SELECT id, tenant_id,
         ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at ASC NULLS LAST, id ASC) AS rn
  FROM business_defaults
)
DELETE FROM business_defaults bd
USING ranked_business_defaults r
WHERE bd.id = r.id AND r.rn > 1;

-- users: unique supabase_user_id (ignore nulls)
WITH ranked_users AS (
  SELECT id, supabase_user_id,
         ROW_NUMBER() OVER (
           PARTITION BY supabase_user_id
           ORDER BY created_at ASC NULLS LAST, id ASC
         ) AS rn
  FROM users
  WHERE supabase_user_id IS NOT NULL
)
DELETE FROM users u
USING ranked_users r
WHERE u.id = r.id AND r.rn > 1;

-- paper_pricing_rules: unique tenant_id
WITH ranked_ppr AS (
  SELECT id, tenant_id,
         ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at ASC NULLS LAST, id ASC) AS rn
  FROM paper_pricing_rules
)
DELETE FROM paper_pricing_rules ppr
USING ranked_ppr r
WHERE ppr.id = r.id AND r.rn > 1;

-- paper_shades: unique shade_name (case-insensitive)
WITH ranked_shades AS (
  SELECT id, shade_name,
         ROW_NUMBER() OVER (
           PARTITION BY LOWER(shade_name)
           ORDER BY created_at ASC NULLS LAST, id ASC
         ) AS rn
  FROM paper_shades
)
DELETE FROM paper_shades ps
USING ranked_shades r
WHERE ps.id = r.id AND r.rn > 1;

-- 4) Add unique constraints if not existing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_user_id_unique') THEN
    ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_user_id_unique UNIQUE (user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'business_defaults_tenant_id_unique') THEN
    ALTER TABLE business_defaults ADD CONSTRAINT business_defaults_tenant_id_unique UNIQUE (tenant_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_supabase_user_id_unique') THEN
    ALTER TABLE users ADD CONSTRAINT users_supabase_user_id_unique UNIQUE (supabase_user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'paper_pricing_rules_tenant_id_unique') THEN
    ALTER TABLE paper_pricing_rules ADD CONSTRAINT paper_pricing_rules_tenant_id_unique UNIQUE (tenant_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'paper_shades_shade_name_unique') THEN
    ALTER TABLE paper_shades ADD CONSTRAINT paper_shades_shade_name_unique UNIQUE (shade_name);
  END IF;
END $$;

COMMIT;
