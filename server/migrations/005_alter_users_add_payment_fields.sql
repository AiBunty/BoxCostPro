-- Migration: Alter users table to add payment tracking fields
-- Purpose: Track payment completion status and link to temporary profile

ALTER TABLE users
ADD COLUMN IF NOT EXISTS payment_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS temporary_profile_id VARCHAR REFERENCES temporary_business_profiles(id);

-- Index for quick payment status queries
CREATE INDEX IF NOT EXISTS idx_users_payment_completed ON users(payment_completed);
CREATE INDEX IF NOT EXISTS idx_users_temporary_profile ON users(temporary_profile_id);
