-- Migration: Add Feature Flag System and User Email Provider Support
-- Date: December 31, 2025
-- Description: Adds plan-based feature limits, usage tracking, user-owned email providers

BEGIN;

-- 1. Update subscription_plans table with structured features and tier
ALTER TABLE subscription_plans 
  ADD COLUMN IF NOT EXISTS plan_tier VARCHAR(20) DEFAULT 'basic',
  ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Update default features to structured JSON
UPDATE subscription_plans 
SET features = '{"maxEmailProviders":1,"maxQuotes":50,"maxPartyProfiles":20,"apiAccess":false,"whatsappIntegration":false,"prioritySupport":false,"customBranding":false}'::jsonb
WHERE features = '[]'::jsonb OR features IS NULL;

-- 2. Create user_feature_usage table
CREATE TABLE IF NOT EXISTS user_feature_usage (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  email_providers_count INTEGER DEFAULT 0,
  custom_templates_count INTEGER DEFAULT 0,
  quotes_this_month INTEGER DEFAULT 0,
  party_profiles_count INTEGER DEFAULT 0,
  api_calls_this_month INTEGER DEFAULT 0,
  last_reset_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_feature_usage_user ON user_feature_usage(user_id);

-- 3. Create user_feature_overrides table
CREATE TABLE IF NOT EXISTS user_feature_overrides (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  max_email_providers INTEGER,
  max_quotes INTEGER,
  max_party_profiles INTEGER,
  api_access BOOLEAN,
  whatsapp_integration BOOLEAN,
  notes TEXT,
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_feature_overrides_user ON user_feature_overrides(user_id);

-- 4. Add userId column to email_providers (nullable - admin vs user-owned)
ALTER TABLE email_providers 
  ADD COLUMN IF NOT EXISTS user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_email_providers_user ON email_providers(user_id);

-- 5. Insert default subscription plans if not exists
INSERT INTO subscription_plans (name, description, price_monthly, price_yearly, features, plan_tier, display_order, is_active, trial_days)
SELECT 'Basic Plan', 'Perfect for small businesses getting started with box costing', 499.00, 4990.00, '{"maxEmailProviders":1,"maxQuotes":50,"maxPartyProfiles":20,"apiAccess":false,"whatsappIntegration":false,"prioritySupport":false,"customBranding":false}'::jsonb, 'basic', 1, true, 14
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE name = 'Basic Plan');

INSERT INTO subscription_plans (name, description, price_monthly, price_yearly, features, plan_tier, display_order, is_active, trial_days)
SELECT 'Professional Plan', 'For growing businesses with advanced needs', 1499.00, 14990.00, '{"maxEmailProviders":3,"maxQuotes":200,"maxPartyProfiles":100,"apiAccess":true,"whatsappIntegration":false,"prioritySupport":true,"customBranding":true}'::jsonb, 'professional', 2, true, 14
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE name = 'Professional Plan');

INSERT INTO subscription_plans (name, description, price_monthly, price_yearly, features, plan_tier, display_order, is_active, trial_days)
SELECT 'Enterprise Plan', 'Unlimited features for large-scale operations', 4999.00, 49990.00, '{"maxEmailProviders":999,"maxQuotes":9999,"maxPartyProfiles":9999,"apiAccess":true,"whatsappIntegration":true,"prioritySupport":true,"customBranding":true}'::jsonb, 'enterprise', 3, true, 30
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE name = 'Enterprise Plan');

-- 6. Initialize usage tracking for existing users
INSERT INTO user_feature_usage (user_id, email_providers_count, party_profiles_count)
SELECT 
  u.id,
  0,  -- Will be updated by trigger or cron
  (SELECT COUNT(*) FROM party_profiles p WHERE p.user_id = u.id)
FROM users u
WHERE NOT EXISTS (SELECT 1 FROM user_feature_usage WHERE user_id = u.id);

-- 7. Update existing email providers count in usage table
DO $$
DECLARE
  user_record RECORD;
  provider_count INTEGER;
BEGIN
  FOR user_record IN SELECT id FROM users LOOP
    SELECT COUNT(*) INTO provider_count
    FROM email_providers
    WHERE user_id = user_record.id;
    
    IF provider_count > 0 THEN
      UPDATE user_feature_usage
      SET email_providers_count = provider_count
      WHERE user_id = user_record.id;
    END IF;
  END LOOP;
END $$;

-- 8. Create function to auto-update usage counts
CREATE OR REPLACE FUNCTION update_email_provider_usage()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.user_id IS NOT NULL THEN
    INSERT INTO user_feature_usage (user_id, email_providers_count)
    VALUES (NEW.user_id, 1)
    ON CONFLICT (user_id) DO UPDATE
    SET email_providers_count = user_feature_usage.email_providers_count + 1,
        updated_at = NOW();
  ELSIF TG_OP = 'DELETE' AND OLD.user_id IS NOT NULL THEN
    UPDATE user_feature_usage
    SET email_providers_count = GREATEST(0, email_providers_count - 1),
        updated_at = NOW()
    WHERE user_id = OLD.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. Create trigger for email provider usage tracking
DROP TRIGGER IF EXISTS trg_email_provider_usage ON email_providers;
CREATE TRIGGER trg_email_provider_usage
AFTER INSERT OR DELETE ON email_providers
FOR EACH ROW EXECUTE FUNCTION update_email_provider_usage();

-- 10. Create function to auto-update party profile usage
CREATE OR REPLACE FUNCTION update_party_profile_usage()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.user_id IS NOT NULL THEN
    INSERT INTO user_feature_usage (user_id, party_profiles_count)
    VALUES (NEW.user_id, 1)
    ON CONFLICT (user_id) DO UPDATE
    SET party_profiles_count = user_feature_usage.party_profiles_count + 1,
        updated_at = NOW();
  ELSIF TG_OP = 'DELETE' AND OLD.user_id IS NOT NULL THEN
    UPDATE user_feature_usage
    SET party_profiles_count = GREATEST(0, party_profiles_count - 1),
        updated_at = NOW()
    WHERE user_id = OLD.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 11. Create trigger for party profile usage tracking
DROP TRIGGER IF EXISTS trg_party_profile_usage ON party_profiles;
CREATE TRIGGER trg_party_profile_usage
AFTER INSERT OR DELETE ON party_profiles
FOR EACH ROW EXECUTE FUNCTION update_party_profile_usage();

COMMIT;

-- Verification queries
SELECT 'Migration completed successfully!' as status;
SELECT COUNT(*) as new_plans_count FROM subscription_plans WHERE plan_tier IS NOT NULL;
SELECT COUNT(*) as usage_tracking_count FROM user_feature_usage;
SELECT COUNT(*) as user_providers_count FROM email_providers WHERE user_id IS NOT NULL;
