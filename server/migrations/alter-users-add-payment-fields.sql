/**
 * Migration: Add Payment Tracking Fields to Users Table
 *
 * Purpose: Link users to temporary profiles and track payment completion
 *
 * Run with: psql $DATABASE_URL -f server/migrations/alter-users-add-payment-fields.sql
 */

-- Add payment completion flag
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS payment_completed BOOLEAN DEFAULT FALSE;

-- Add reference to temporary profile (for audit trail)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS temporary_profile_id VARCHAR;

-- Add foreign key constraint if temporary_business_profiles table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'temporary_business_profiles') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE constraint_name = 'fk_users_temp_profile') THEN
      ALTER TABLE users
        ADD CONSTRAINT fk_users_temp_profile
        FOREIGN KEY (temporary_profile_id)
        REFERENCES temporary_business_profiles(id)
        ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- Index for payment status queries
CREATE INDEX IF NOT EXISTS idx_users_payment_completed
  ON users(payment_completed);

-- Comments
COMMENT ON COLUMN users.payment_completed IS 'True if user completed payment during signup. Used by combinedAuth to block unpaid users.';
COMMENT ON COLUMN users.temporary_profile_id IS 'Reference to temporary_business_profiles record used during signup (audit trail)';
