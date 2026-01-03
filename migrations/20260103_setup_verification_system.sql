-- Setup & Verification system rollout
-- Adds setup/verification columns to users and introduces user_setup table.

BEGIN;

-- 1) Add setup/verification columns to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_setup_complete boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS setup_progress integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verification_status varchar DEFAULT 'NOT_SUBMITTED',
  ADD COLUMN IF NOT EXISTS approved_at timestamp,
  ADD COLUMN IF NOT EXISTS approved_by varchar REFERENCES users(id);

-- 2) Create user_setup table (per-tenant checklist)
CREATE TABLE IF NOT EXISTS user_setup (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id),
  tenant_id varchar REFERENCES tenants(id),
  business_profile boolean DEFAULT false,
  paper_pricing boolean DEFAULT false,
  flute_settings boolean DEFAULT false,
  tax_defaults boolean DEFAULT false,
  quote_terms boolean DEFAULT false,
  completed_at timestamp,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_setup_user ON user_setup(user_id);
CREATE INDEX IF NOT EXISTS idx_user_setup_tenant ON user_setup(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_setup_user_tenant ON user_setup(user_id, tenant_id);

-- 3) Backfill user_setup from legacy onboarding_status
INSERT INTO user_setup (
  id,
  user_id,
  tenant_id,
  business_profile,
  paper_pricing,
  flute_settings,
  tax_defaults,
  quote_terms,
  completed_at,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  os.user_id,
  os.tenant_id,
  COALESCE(os.business_profile_done, false),
  COALESCE(os.paper_setup_done, false),
  COALESCE(os.flute_setup_done, false),
  COALESCE(os.tax_setup_done, false),
  COALESCE(os.terms_setup_done, false),
  CASE
    WHEN COALESCE(os.business_profile_done, false)
      AND COALESCE(os.paper_setup_done, false)
      AND COALESCE(os.flute_setup_done, false)
      AND COALESCE(os.tax_setup_done, false)
      AND COALESCE(os.terms_setup_done, false)
    THEN now()
    ELSE NULL
  END,
  now(),
  now()
FROM onboarding_status os
WHERE os.user_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 4) Backfill users setup/verification fields from onboarding_status
UPDATE users u
SET
  setup_progress = progress_data.progress,
  is_setup_complete = progress_data.progress = 100,
  verification_status = progress_data.verification_status,
  approved_at = progress_data.approved_at,
  approved_by = progress_data.approved_by
FROM (
  SELECT
    os.user_id,
    (
      (CASE WHEN os.business_profile_done THEN 1 ELSE 0 END) +
      (CASE WHEN os.paper_setup_done THEN 1 ELSE 0 END) +
      (CASE WHEN os.flute_setup_done THEN 1 ELSE 0 END) +
      (CASE WHEN os.tax_setup_done THEN 1 ELSE 0 END) +
      (CASE WHEN os.terms_setup_done THEN 1 ELSE 0 END)
    ) * 20 AS progress,
    CASE
      WHEN os.verification_status = 'approved' THEN 'APPROVED'
      WHEN os.verification_status = 'pending' AND os.submitted_for_verification = true THEN 'PENDING'
      WHEN os.verification_status = 'rejected' THEN 'REJECTED'
      ELSE 'NOT_SUBMITTED'
    END AS verification_status,
    os.approved_at,
    os.approved_by
  FROM onboarding_status os
) AS progress_data
WHERE u.id = progress_data.user_id;

COMMIT;
