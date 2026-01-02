-- Migration: Create seller_profile table
-- Purpose: Store YOUR company's details for invoice generation
-- Important: Only ONE seller profile should exist (enforced at application level)

CREATE TABLE IF NOT EXISTS seller_profile (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),

  company_name TEXT NOT NULL,
  gstin TEXT NOT NULL,
  pan_no TEXT NOT NULL,
  state_code VARCHAR(2) NOT NULL,
  state_name TEXT NOT NULL,
  address TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  website TEXT,

  logo_url TEXT, -- Path to company logo for invoices

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Note: Only one row should exist in this table
-- Application logic will enforce UPDATE instead of INSERT for subsequent changes
