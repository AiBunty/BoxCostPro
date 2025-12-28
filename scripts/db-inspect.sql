-- Quick DB Inspect Helper
-- Usage (Replit Shell):
--   psql $DATABASE_URL -f scripts/db-inspect.sql

-- Column types for key tables
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('users','company_profiles','quotes')
  AND column_name IN ('id','created_at','updated_at','email','phone')
ORDER BY table_name, column_name;

-- Specific check for quotes.created_at
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'quotes' AND column_name = 'created_at';

-- Row counts
SELECT 'users' AS table, COUNT(*) AS count FROM users
UNION ALL
SELECT 'company_profiles' AS table, COUNT(*) AS count FROM company_profiles
UNION ALL
SELECT 'quotes' AS table, COUNT(*) AS count FROM quotes;

-- Broken profiles (should be 0)
SELECT COUNT(*) AS missing_email
FROM company_profiles
WHERE email IS NULL OR email = '';

-- Sample profiles
SELECT company_name, email, phone
FROM company_profiles
ORDER BY updated_at DESC NULLS LAST
LIMIT 5;
