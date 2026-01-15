-- Delete test user: venturapackagers@gmail.com
-- This will cascade delete related records due to foreign key constraints

-- Step 1: Get the user ID first
SELECT id, email FROM users WHERE email = 'venturapackagers@gmail.com';

-- Step 2: Delete the user (cascading deletes will handle related tables)
DELETE FROM users WHERE email = 'venturapackagers@gmail.com' RETURNING id, email;

-- Step 3: Verify deletion
SELECT COUNT(*) as remaining_user_count FROM users WHERE email = 'venturapackagers@gmail.com';
