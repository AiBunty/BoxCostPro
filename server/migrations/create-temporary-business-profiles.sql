/**
 * Migration: Create Temporary Business Profiles Table
 *
 * Purpose: Store business details collected during signup BEFORE payment success
 * Expiry: Auto-cleanup after 24 hours (handled by application cron)
 *
 * Run with: psql $DATABASE_URL -f server/migrations/create-temporary-business-profiles.sql
 */

CREATE TABLE IF NOT EXISTS temporary_business_profiles (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- Business Information
  authorized_person_name TEXT NOT NULL,
  business_name TEXT NOT NULL,
  business_email TEXT NOT NULL UNIQUE,
  mobile_number TEXT NOT NULL,

  -- GST & Tax (Optional for international customers in future)
  gstin TEXT,
  pan_no TEXT,
  state_code VARCHAR(2),
  state_name TEXT,
  full_business_address TEXT NOT NULL,
  website TEXT,

  -- Session tracking
  session_token VARCHAR UNIQUE NOT NULL,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '24 hours',

  -- Validation flags
  gstin_validated BOOLEAN DEFAULT FALSE,
  email_verified BOOLEAN DEFAULT FALSE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_temp_profiles_session
  ON temporary_business_profiles(session_token);

CREATE INDEX IF NOT EXISTS idx_temp_profiles_email
  ON temporary_business_profiles(business_email);

CREATE INDEX IF NOT EXISTS idx_temp_profiles_expires
  ON temporary_business_profiles(expires_at);

-- Comments for documentation
COMMENT ON TABLE temporary_business_profiles IS 'Stores business profile data during signup flow before payment completion. Auto-expires after 24 hours.';
COMMENT ON COLUMN temporary_business_profiles.session_token IS 'Unique session identifier for tracking multi-step signup flow';
COMMENT ON COLUMN temporary_business_profiles.gstin_validated IS 'True if GSTIN passed regex + MOD-36 checksum validation';
COMMENT ON COLUMN temporary_business_profiles.expires_at IS 'Expiry timestamp for automatic cleanup of abandoned signups';
