-- Add clerk_user_id column to users table
-- This migration adds support for Clerk authentication

ALTER TABLE users
ADD COLUMN IF NOT EXISTS clerk_user_id VARCHAR UNIQUE;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_clerk_user_id ON users(clerk_user_id);

-- Comment the column
COMMENT ON COLUMN users.clerk_user_id IS 'Clerk authentication user ID';
