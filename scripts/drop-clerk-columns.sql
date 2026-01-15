-- Drop Clerk-related columns from users table
-- Run this AFTER removing Clerk data with remove-clerk-data.js
-- This is optional and can be done later if you want to completely remove Clerk columns

BEGIN;

-- First, ensure all Clerk user IDs are NULL
UPDATE users 
SET clerk_user_id = NULL 
WHERE clerk_user_id IS NOT NULL;

-- Update deprecated auth provider
UPDATE users 
SET auth_provider = 'native' 
WHERE auth_provider = 'clerk';

-- Drop the unique constraint on clerk_user_id (if it exists)
-- Note: This may fail if the constraint doesn't exist, which is fine
DO $$ 
BEGIN
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_clerk_user_id_unique;
EXCEPTION
    WHEN undefined_object THEN
        NULL;
END $$;

-- Drop the clerk_user_id column
-- WARNING: This is permanent! Make sure you've backed up your database
-- Uncomment the line below only when you're absolutely sure
-- ALTER TABLE users DROP COLUMN IF EXISTS clerk_user_id;

-- Also drop other deprecated columns if desired
-- Uncomment these only when you're ready to permanently remove them:
-- ALTER TABLE users DROP COLUMN IF EXISTS supabase_user_id;
-- ALTER TABLE users DROP COLUMN IF EXISTS neon_auth_user_id;
-- ALTER TABLE users DROP COLUMN IF EXISTS password_hash;
-- ALTER TABLE users DROP COLUMN IF EXISTS password_reset_required;
-- ALTER TABLE users DROP COLUMN IF EXISTS failed_login_attempts;
-- ALTER TABLE users DROP COLUMN IF EXISTS locked_until;
-- ALTER TABLE users DROP COLUMN IF EXISTS two_factor_enabled;
-- ALTER TABLE users DROP COLUMN IF EXISTS two_factor_method;

COMMIT;

-- Verify cleanup
SELECT COUNT(*) as users_with_clerk_id 
FROM users 
WHERE clerk_user_id IS NOT NULL;

SELECT COUNT(*) as users_with_clerk_auth 
FROM users 
WHERE auth_provider = 'clerk';

SELECT auth_provider, COUNT(*) as count 
FROM users 
GROUP BY auth_provider;
