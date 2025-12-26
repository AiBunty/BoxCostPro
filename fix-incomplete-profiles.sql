-- Fix Incomplete Company Profiles - Emergency Migration
-- Run this to fix users stuck at settings page

-- Problem: company_profiles created with only companyName, missing email/phone
-- Solution: Populate email/phone from users table

-- Step 1: Update existing company profiles with missing email/phone
UPDATE company_profiles cp
SET
  email = COALESCE(cp.email, u.email),
  phone = COALESCE(cp.phone, u.mobile_no),
  owner_name = COALESCE(cp.owner_name, u.full_name),
  updated_at = NOW()
FROM users u
WHERE cp.user_id = u.id
  AND (cp.email IS NULL OR cp.email = '' OR cp.phone IS NULL OR cp.phone = '');

-- Step 2: Verify the fix
SELECT
  cp.id,
  cp.company_name,
  cp.email,
  cp.phone,
  cp.owner_name,
  u.email AS user_email,
  u.mobile_no AS user_phone,
  u.full_name AS user_name
FROM company_profiles cp
JOIN users u ON cp.user_id = u.id
WHERE cp.is_default = true
ORDER BY cp.created_at DESC;

-- Step 3: Check for any profiles still missing email
SELECT
  cp.id,
  cp.company_name,
  cp.email,
  cp.phone,
  u.email AS user_email
FROM company_profiles cp
JOIN users u ON cp.user_id = u.id
WHERE cp.is_default = true
  AND (cp.email IS NULL OR cp.email = '');

-- Expected result: No rows (all profiles should have email now)
