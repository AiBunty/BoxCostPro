/**
 * Migration: Create Seller Profile Table
 *
 * Purpose: Store YOUR company's details (invoice seller/issuer)
 * Usage: One-time admin setup, appears on all subscription invoices
 * Requirement: Must be configured before invoices can be generated
 *
 * Run with: psql $DATABASE_URL -f server/migrations/create-seller-profile.sql
 */

CREATE TABLE IF NOT EXISTS seller_profile (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- Company Identity
  company_name TEXT NOT NULL,
  gstin TEXT NOT NULL,
  pan_no TEXT NOT NULL,
  state_code VARCHAR(2) NOT NULL,
  state_name TEXT NOT NULL,

  -- Contact Information
  address TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  website TEXT,

  -- Branding (Optional)
  logo_url TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Ensure only one seller profile exists (enforced at application level)
CREATE UNIQUE INDEX IF NOT EXISTS idx_seller_profile_single_row
  ON seller_profile((TRUE));

-- Comments
COMMENT ON TABLE seller_profile IS 'Stores seller (your company) details for invoice generation. Only one row allowed.';
COMMENT ON COLUMN seller_profile.gstin IS 'Your company GSTIN - must match GST registration exactly';
COMMENT ON COLUMN seller_profile.pan_no IS 'Auto-derived from GSTIN (positions 3-12)';
COMMENT ON COLUMN seller_profile.state_code IS 'Auto-derived from GSTIN (positions 1-2) - determines CGST+SGST vs IGST';
