-- ========================================================================
-- ENTITLEMENT & PLATFORM EVENT TABLES
-- ========================================================================
-- Creates tables for subscription overrides, platform events, and caching

-- Subscription Overrides (admin-controlled temporary entitlement changes)
CREATE TABLE IF NOT EXISTS subscription_overrides (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id VARCHAR NOT NULL,
  subscription_id VARCHAR,
  
  override_type VARCHAR(32) NOT NULL CHECK (override_type IN ('FEATURE_UNLOCK', 'QUOTA_INCREASE', 'TRIAL_EXTENSION', 'EMERGENCY_ACCESS')),
  feature_key VARCHAR(64),
  
  boolean_value BOOLEAN,
  integer_value INTEGER,
  json_value JSONB,
  
  starts_at TIMESTAMP NOT NULL DEFAULT now(),
  expires_at TIMESTAMP NOT NULL,
  
  reason TEXT NOT NULL,
  admin_id VARCHAR NOT NULL,
  approval_ticket_id VARCHAR,
  
  is_active BOOLEAN DEFAULT true,
  deactivated_at TIMESTAMP,
  deactivated_by VARCHAR,
  deactivation_reason TEXT,
  
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  CONSTRAINT expiry_required CHECK (expires_at > starts_at),
  CONSTRAINT override_value_required CHECK (
    boolean_value IS NOT NULL OR 
    integer_value IS NOT NULL OR 
    json_value IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_sub_overrides_user ON subscription_overrides(user_id);
CREATE INDEX IF NOT EXISTS idx_sub_overrides_active ON subscription_overrides(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_sub_overrides_feature ON subscription_overrides(feature_key);

-- Platform Events (immutable event log)
CREATE TABLE IF NOT EXISTS platform_events (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  
  event_type VARCHAR(64) NOT NULL,
  event_category VARCHAR(32) NOT NULL,
  
  user_id VARCHAR,
  tenant_id VARCHAR,
  subscription_id VARCHAR,
  
  actor_type VARCHAR(16) NOT NULL CHECK (actor_type IN ('ADMIN', 'USER', 'SYSTEM', 'CRON')),
  actor_id VARCHAR,
  
  event_data JSONB NOT NULL DEFAULT '{}',
  previous_state JSONB,
  new_state JSONB,
  
  correlation_id VARCHAR,
  ip_address VARCHAR(64),
  user_agent TEXT,
  
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMP,
  processing_error TEXT,
  
  occurred_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_events_type ON platform_events(event_type);
CREATE INDEX IF NOT EXISTS idx_platform_events_category ON platform_events(event_category);
CREATE INDEX IF NOT EXISTS idx_platform_events_user ON platform_events(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_events_tenant ON platform_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_platform_events_actor ON platform_events(actor_type, actor_id);
CREATE INDEX IF NOT EXISTS idx_platform_events_occurred ON platform_events(occurred_at);
CREATE INDEX IF NOT EXISTS idx_platform_events_unprocessed ON platform_events(processed, occurred_at);
CREATE INDEX IF NOT EXISTS idx_platform_events_correlation ON platform_events(correlation_id);

-- Entitlement Cache (denormalized for fast lookups)
CREATE TABLE IF NOT EXISTS entitlement_cache (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id VARCHAR NOT NULL UNIQUE,
  tenant_id VARCHAR,
  
  features JSONB NOT NULL DEFAULT '{}',
  quotas JSONB NOT NULL DEFAULT '{}',
  usage JSONB NOT NULL DEFAULT '{}',
  
  subscription_status VARCHAR(32) NOT NULL,
  plan_id VARCHAR,
  active_overrides_count INTEGER DEFAULT 0,
  
  computed_at TIMESTAMP NOT NULL DEFAULT now(),
  expires_at TIMESTAMP NOT NULL,
  computation_version INTEGER DEFAULT 1,
  
  last_accessed_at TIMESTAMP,
  access_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_entitlement_cache_user ON entitlement_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_entitlement_cache_expires ON entitlement_cache(expires_at);

-- Consistency Check Logs (nightly validation jobs)
CREATE TABLE IF NOT EXISTS consistency_check_logs (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  
  check_type VARCHAR(64) NOT NULL,
  check_category VARCHAR(32) NOT NULL,
  
  status VARCHAR(16) NOT NULL,
  records_checked INTEGER DEFAULT 0,
  issues_found INTEGER DEFAULT 0,
  issues_resolved INTEGER DEFAULT 0,
  
  check_results JSONB DEFAULT '{}',
  errors JSONB,
  
  started_at TIMESTAMP NOT NULL DEFAULT now(),
  completed_at TIMESTAMP,
  duration_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_consistency_checks_type ON consistency_check_logs(check_type);
CREATE INDEX IF NOT EXISTS idx_consistency_checks_started ON consistency_check_logs(started_at);

-- Grant appropriate permissions (if using role-based access)
-- GRANT SELECT ON subscription_overrides TO app_user;
-- GRANT ALL ON subscription_overrides TO app_admin;
-- GRANT INSERT ON platform_events TO app_admin;
-- GRANT SELECT ON entitlement_cache TO app_user;

COMMENT ON TABLE subscription_overrides IS 'Admin-controlled temporary entitlement overrides with mandatory expiry';
COMMENT ON TABLE platform_events IS 'Immutable event log for all platform state changes';
COMMENT ON TABLE entitlement_cache IS 'Denormalized cache for fast entitlement lookups';
COMMENT ON TABLE consistency_check_logs IS 'Logs from nightly data consistency validation jobs';
