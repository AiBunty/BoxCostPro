-- Scope GST uniqueness to tenant (allow same GST across tenants)
ALTER TABLE company_profiles DROP CONSTRAINT IF EXISTS company_profiles_gst_no_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_company_profiles_tenant_gst
  ON company_profiles(tenant_id, gst_no)
  WHERE gst_no IS NOT NULL;
