-- ============================================================================
-- Migration 007: Admin Email Settings & Onboarding Fixes
-- ============================================================================
-- Purpose: Add admin email settings table and fix onboarding/ownership issues
-- Date: 2025-12-30
-- ============================================================================

-- ========================================
-- PART 1: Admin Email Settings Table
-- ========================================

-- Admin email settings - System-wide SMTP configuration for notifications
CREATE TABLE IF NOT EXISTS admin_email_settings (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR NOT NULL, -- 'gmail', 'zoho', 'outlook', 'yahoo', 'ses', 'custom'
  from_name TEXT NOT NULL,
  from_email TEXT NOT NULL,
  smtp_host TEXT NOT NULL,
  smtp_port INTEGER NOT NULL,
  encryption VARCHAR NOT NULL, -- 'TLS', 'SSL', 'NONE'
  smtp_username TEXT NOT NULL,
  smtp_password_encrypted TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  last_tested_at TIMESTAMP,
  test_status VARCHAR, -- 'success', 'failed'
  created_by VARCHAR REFERENCES staff(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for active email settings lookup
CREATE INDEX IF NOT EXISTS idx_admin_email_settings_active
ON admin_email_settings(is_active);

-- Ensure only one active email config at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_email_settings_single_active
ON admin_email_settings(is_active)
WHERE is_active = TRUE;

-- ========================================
-- PART 2: Email Logs Enhancement
-- ========================================

-- Add indexes to existing email_logs table for better query performance
CREATE INDEX IF NOT EXISTS idx_email_logs_to ON email_logs(to_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_type ON email_logs(email_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_created ON email_logs(created_at);

-- ========================================
-- PART 3: Onboarding Status Fixes
-- ========================================

-- Add verification_status column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'onboarding_status' AND column_name = 'verification_status'
  ) THEN
    ALTER TABLE onboarding_status
      ADD COLUMN verification_status VARCHAR DEFAULT 'pending';

    COMMENT ON COLUMN onboarding_status.verification_status IS 'Verification status: pending, approved, rejected';
  END IF;
END $$;

-- Fix NULL verification_status values
UPDATE onboarding_status
SET verification_status = 'pending'
WHERE verification_status IS NULL;

-- Add index for verification status lookups
CREATE INDEX IF NOT EXISTS idx_onboarding_status_verification
ON onboarding_status(verification_status);

CREATE INDEX IF NOT EXISTS idx_onboarding_status_submitted
ON onboarding_status(submitted_for_verification);

-- ========================================
-- PART 4: Ownership Fixes
-- ========================================

-- Check if tenants table exists and has owner_user_id column
DO $$
BEGIN
  -- Add owner_user_id if table exists but column doesn't
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenants') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'tenants' AND column_name = 'owner_user_id'
    ) THEN
      ALTER TABLE tenants
        ADD COLUMN owner_user_id VARCHAR REFERENCES users(id);

      COMMENT ON COLUMN tenants.owner_user_id IS 'User who owns/created this business';
    END IF;
  END IF;
END $$;

-- Fix tenants with NULL owner - set to first user in tenant
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenants') THEN
    UPDATE tenants t
    SET owner_user_id = (
      SELECT user_id
      FROM tenant_users tu
      WHERE tu.tenant_id = t.id
      ORDER BY joined_at ASC
      LIMIT 1
    )
    WHERE owner_user_id IS NULL;
  END IF;
END $$;

-- Add index for owner lookups
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenants') THEN
    CREATE INDEX IF NOT EXISTS idx_tenants_owner ON tenants(owner_user_id);
  END IF;
END $$;

-- ========================================
-- PART 5: Reset Incorrectly Verified Accounts
-- ========================================

-- Reset businesses that were marked as verified but have no actual activity
-- (This prevents test accounts from bypassing onboarding)
UPDATE onboarding_status os
SET
  verification_status = 'pending',
  submitted_for_verification = FALSE,
  approved_at = NULL,
  approved_by = NULL
WHERE
  verification_status = 'approved'
  AND NOT EXISTS (
    SELECT 1 FROM quotes q
    JOIN users u ON q.user_id = u.id
    WHERE u.id = os.user_id
    LIMIT 1
  )
  AND NOT EXISTS (
    SELECT 1 FROM company_profiles cp
    WHERE cp.user_id = os.user_id
    AND cp.created_at < NOW() - INTERVAL '7 days'
  );

-- ========================================
-- PART 6: Data Integrity Checks
-- ========================================

-- Ensure all users have an onboarding status record
INSERT INTO onboarding_status (
  user_id,
  business_profile_done,
  paper_setup_done,
  flute_setup_done,
  tax_setup_done,
  terms_setup_done,
  submitted_for_verification,
  verification_status,
  created_at
)
SELECT
  u.id,
  FALSE,
  FALSE,
  FALSE,
  FALSE,
  FALSE,
  FALSE,
  'pending',
  NOW()
FROM users u
WHERE NOT EXISTS (
  SELECT 1 FROM onboarding_status os WHERE os.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;

-- ========================================
-- PART 7: Add Comments for Documentation
-- ========================================

COMMENT ON TABLE admin_email_settings IS 'System-wide SMTP email configuration for admin notifications';
COMMENT ON COLUMN admin_email_settings.provider IS 'Email provider: gmail, zoho, outlook, yahoo, ses, custom';
COMMENT ON COLUMN admin_email_settings.smtp_password_encrypted IS 'AES-256-CBC encrypted SMTP password';
COMMENT ON COLUMN admin_email_settings.is_active IS 'Only one configuration can be active at a time';
COMMENT ON COLUMN admin_email_settings.test_status IS 'Last test result: success or failed';

-- ========================================
-- MIGRATION COMPLETE
-- ========================================

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 007 completed successfully';
  RAISE NOTICE '   - Created admin_email_settings table';
  RAISE NOTICE '   - Added email_logs indexes';
  RAISE NOTICE '   - Fixed onboarding verification_status';
  RAISE NOTICE '   - Fixed tenant ownership';
  RAISE NOTICE '   - Reset incorrectly verified accounts';
  RAISE NOTICE '   - Ensured data integrity';
END $$;
