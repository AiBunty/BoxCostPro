-- Migration: Create temporary_business_profiles table
-- Purpose: Store business details BEFORE payment success during signup flow
-- Auto-cleanup: Cron job deletes expired profiles (>24 hours old)

CREATE TABLE IF NOT EXISTS temporary_business_profiles (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Business Information
  authorized_person_name TEXT NOT NULL,
  business_name TEXT NOT NULL,
  business_email TEXT NOT NULL UNIQUE,
  mobile_number TEXT NOT NULL,

  -- GST & Tax
  gstin TEXT, -- Required for Indian users
  pan_no TEXT, -- Auto-derived from GSTIN
  state_code VARCHAR(2), -- Auto-derived from GSTIN
  state_name TEXT, -- Auto-derived from GSTIN
  full_business_address TEXT NOT NULL,
  website TEXT,

  -- Session tracking
  session_token VARCHAR UNIQUE NOT NULL, -- Track signup flow

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '24 hours',

  -- Validation flags
  gstin_validated BOOLEAN DEFAULT FALSE,
  email_verified BOOLEAN DEFAULT FALSE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_temp_profiles_session ON temporary_business_profiles(session_token);
CREATE INDEX IF NOT EXISTS idx_temp_profiles_email ON temporary_business_profiles(business_email);
CREATE INDEX IF NOT EXISTS idx_temp_profiles_expires ON temporary_business_profiles(expires_at);
