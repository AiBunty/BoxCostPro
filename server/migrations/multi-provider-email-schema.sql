-- ============================================================
-- MULTI-PROVIDER EMAIL SYSTEM - DATABASE SCHEMA
-- ============================================================
-- Architecture: Task-based routing with provider failover
-- Version: 1.0
-- Date: 2025-12-30
-- ============================================================

-- ============================================================
-- 1. EMAIL PROVIDERS TABLE
-- ============================================================
-- Stores multiple email provider configurations
-- Each provider can be SMTP, API, or Webhook based

CREATE TABLE IF NOT EXISTS email_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Provider identification
  provider_type VARCHAR(50) NOT NULL, -- 'gmail', 'ses', 'zoho', 'brevo', 'pabbly_webhook', 'custom_smtp', etc.
  provider_name VARCHAR(100) NOT NULL, -- User-friendly name: "Gmail Primary", "SES Transactional", etc.
  
  -- Sender details
  from_name VARCHAR(255) NOT NULL,
  from_email VARCHAR(255) NOT NULL,
  reply_to_email VARCHAR(255), -- Optional reply-to
  
  -- Connection details (SMTP or API)
  connection_type VARCHAR(20) NOT NULL DEFAULT 'smtp', -- 'smtp', 'api', 'webhook'
  
  -- SMTP configuration (if connection_type = 'smtp')
  smtp_host VARCHAR(255),
  smtp_port INTEGER,
  smtp_username VARCHAR(255),
  smtp_password_encrypted TEXT, -- AES-256-GCM encrypted
  smtp_encryption VARCHAR(10), -- 'TLS', 'SSL', 'NONE'
  
  -- API configuration (if connection_type = 'api' or 'webhook')
  api_endpoint VARCHAR(500),
  api_key_encrypted TEXT, -- AES-256-GCM encrypted
  api_secret_encrypted TEXT, -- For providers requiring secret
  api_region VARCHAR(50), -- For AWS SES, etc.
  
  -- Configuration JSON (provider-specific settings)
  config_json JSONB DEFAULT '{}',
  
  -- Provider status
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false, -- Set after successful test
  priority_order INTEGER NOT NULL DEFAULT 100, -- Lower = higher priority
  
  -- Provider role
  role VARCHAR(20) DEFAULT 'secondary', -- 'primary', 'secondary', 'fallback'
  
  -- Rate limiting
  max_emails_per_hour INTEGER,
  max_emails_per_day INTEGER,
  current_hourly_count INTEGER DEFAULT 0,
  current_daily_count INTEGER DEFAULT 0,
  rate_limit_reset_at TIMESTAMP,
  
  -- Health monitoring
  last_used_at TIMESTAMP,
  last_test_at TIMESTAMP,
  last_error_at TIMESTAMP,
  last_error_message TEXT,
  consecutive_failures INTEGER DEFAULT 0,
  total_sent INTEGER DEFAULT 0,
  total_failed INTEGER DEFAULT 0,
  
  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(255),
  updated_by VARCHAR(255),
  
  -- Constraints
  CONSTRAINT valid_connection_type CHECK (connection_type IN ('smtp', 'api', 'webhook')),
  CONSTRAINT valid_role CHECK (role IN ('primary', 'secondary', 'fallback')),
  CONSTRAINT valid_priority CHECK (priority_order >= 0 AND priority_order <= 1000)
);

-- Indexes
CREATE INDEX idx_email_providers_active ON email_providers(is_active, priority_order);
CREATE INDEX idx_email_providers_type ON email_providers(provider_type);
CREATE INDEX idx_email_providers_role ON email_providers(role);

-- ============================================================
-- 2. EMAIL TASK TYPES (ENUM)
-- ============================================================
-- Defines all possible email task types in the system

CREATE TYPE email_task_type AS ENUM (
  'SYSTEM_EMAILS',        -- Health checks, alerts, system notifications
  'AUTH_EMAILS',          -- OTP, login, password reset, 2FA
  'TRANSACTIONAL_EMAILS', -- Invoices, receipts, order confirmations
  'ONBOARDING_EMAILS',    -- Welcome emails, verification, setup guides
  'NOTIFICATION_EMAILS',  -- User notifications, updates, reminders
  'MARKETING_EMAILS',     -- Campaigns, newsletters, announcements
  'SUPPORT_EMAILS',       -- Support tickets, replies, escalations
  'BILLING_EMAILS',       -- Subscription, payment, renewal reminders
  'REPORT_EMAILS'         -- Automated reports, analytics, summaries
);

-- ============================================================
-- 3. EMAIL TASK ROUTING TABLE
-- ============================================================
-- Maps task types to providers with fallback chain

CREATE TABLE IF NOT EXISTS email_task_routing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Task identification
  task_type email_task_type NOT NULL UNIQUE,
  task_description TEXT,
  
  -- Routing configuration
  primary_provider_id UUID REFERENCES email_providers(id) ON DELETE SET NULL,
  
  -- Fallback chain (ordered array of provider IDs)
  fallback_provider_ids UUID[] DEFAULT '{}',
  
  -- Routing rules
  retry_attempts INTEGER DEFAULT 1, -- Retry same provider N times before failover
  retry_delay_seconds INTEGER DEFAULT 5, -- Wait between retries
  
  -- Override settings
  max_send_attempts INTEGER DEFAULT 3, -- Total attempts across all providers
  force_provider_id UUID REFERENCES email_providers(id), -- If set, ignore routing and use this
  
  -- Status
  is_enabled BOOLEAN DEFAULT true,
  
  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(255)
);

-- Seed default routing (will be populated by migration)
-- INSERT INTO email_task_routing (task_type, task_description) VALUES
-- ('SYSTEM_EMAILS', 'System health checks and alerts'),
-- ('AUTH_EMAILS', 'Authentication and security emails'),
-- ('TRANSACTIONAL_EMAILS', 'Transaction confirmations and receipts'),
-- etc.

-- ============================================================
-- 4. EMAIL SEND LOGS (ENHANCED)
-- ============================================================
-- Comprehensive logging of all email attempts with provider tracking

CREATE TABLE IF NOT EXISTS email_send_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Email identification
  email_id VARCHAR(255), -- Optional: Application-level email tracking ID
  message_id VARCHAR(255), -- Provider's message ID
  
  -- Provider tracking
  provider_id UUID REFERENCES email_providers(id) ON DELETE SET NULL,
  provider_type VARCHAR(50),
  provider_name VARCHAR(100),
  
  -- Task tracking
  task_type email_task_type,
  
  -- Email details
  from_email VARCHAR(255) NOT NULL,
  to_email VARCHAR(255) NOT NULL,
  cc_emails TEXT[], -- Array of CC recipients
  bcc_emails TEXT[], -- Array of BCC recipients
  subject VARCHAR(500),
  
  -- Send status
  status VARCHAR(20) NOT NULL, -- 'pending', 'sent', 'failed', 'bounced', 'deferred'
  
  -- Attempt tracking
  attempt_number INTEGER DEFAULT 1,
  total_attempts INTEGER DEFAULT 1,
  
  -- Timing
  queued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,
  
  -- Error tracking
  error_code VARCHAR(50),
  error_message TEXT,
  error_details JSONB,
  
  -- Failover tracking
  failover_occurred BOOLEAN DEFAULT false,
  failover_from_provider_id UUID REFERENCES email_providers(id),
  failover_reason TEXT,
  
  -- User tracking
  user_id VARCHAR(255),
  
  -- Metadata
  metadata JSONB DEFAULT '{}', -- Custom data: campaign_id, invoice_id, etc.
  
  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('pending', 'sent', 'failed', 'bounced', 'deferred', 'delivered'))
);

-- Indexes for performance
CREATE INDEX idx_email_send_logs_provider ON email_send_logs(provider_id, status);
CREATE INDEX idx_email_send_logs_task_type ON email_send_logs(task_type, status);
CREATE INDEX idx_email_send_logs_status ON email_send_logs(status, created_at DESC);
CREATE INDEX idx_email_send_logs_user ON email_send_logs(user_id, created_at DESC);
CREATE INDEX idx_email_send_logs_to_email ON email_send_logs(to_email, created_at DESC);
CREATE INDEX idx_email_send_logs_failover ON email_send_logs(failover_occurred) WHERE failover_occurred = true;

-- ============================================================
-- 5. EMAIL PROVIDER HEALTH TABLE
-- ============================================================
-- Tracks provider health metrics for auto-disable and monitoring

CREATE TABLE IF NOT EXISTS email_provider_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID REFERENCES email_providers(id) ON DELETE CASCADE,
  
  -- Time window
  check_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  window_start TIMESTAMP NOT NULL,
  window_end TIMESTAMP NOT NULL,
  
  -- Metrics
  emails_attempted INTEGER DEFAULT 0,
  emails_sent INTEGER DEFAULT 0,
  emails_failed INTEGER DEFAULT 0,
  
  -- Calculated health
  success_rate DECIMAL(5,2), -- Percentage
  avg_response_time_ms INTEGER,
  
  -- Health status
  health_status VARCHAR(20) DEFAULT 'healthy', -- 'healthy', 'degraded', 'unhealthy', 'disabled'
  
  -- Auto-disable logic
  should_disable BOOLEAN DEFAULT false,
  disable_reason TEXT,
  
  CONSTRAINT valid_health_status CHECK (health_status IN ('healthy', 'degraded', 'unhealthy', 'disabled'))
);

CREATE INDEX idx_provider_health_provider ON email_provider_health(provider_id, check_timestamp DESC);

-- ============================================================
-- 6. USER EMAIL PREFERENCES (CONSENT MANAGEMENT)
-- ============================================================
-- Manages user consent for different email types (GDPR compliant)

CREATE TABLE IF NOT EXISTS user_email_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  
  -- Consent per task type
  allow_system_emails BOOLEAN DEFAULT true,
  allow_auth_emails BOOLEAN DEFAULT true, -- Cannot be disabled
  allow_transactional_emails BOOLEAN DEFAULT true, -- Cannot be disabled
  allow_onboarding_emails BOOLEAN DEFAULT true,
  allow_notification_emails BOOLEAN DEFAULT true,
  allow_marketing_emails BOOLEAN DEFAULT false, -- Opt-in required
  allow_support_emails BOOLEAN DEFAULT true,
  allow_billing_emails BOOLEAN DEFAULT true,
  allow_report_emails BOOLEAN DEFAULT true,
  
  -- Global settings
  email_frequency VARCHAR(20) DEFAULT 'immediate', -- 'immediate', 'daily_digest', 'weekly_digest', 'none'
  
  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(user_id)
);

-- ============================================================
-- 7. BACKWARD COMPATIBILITY VIEW
-- ============================================================
-- Maintains compatibility with existing admin_email_settings queries

CREATE OR REPLACE VIEW admin_email_settings AS
SELECT 
  id,
  provider_type AS "smtpProvider",
  from_name AS "fromName",
  from_email AS "fromEmail",
  smtp_host AS "smtpHost",
  smtp_port AS "smtpPort",
  smtp_username AS "smtpUsername",
  smtp_password_encrypted AS "smtpPasswordEncrypted",
  smtp_encryption AS encryption,
  is_active AS "isActive",
  last_test_at AS "lastTestedAt",
  CASE WHEN is_verified THEN 'success' ELSE 'pending' END AS "testStatus",
  created_by AS "createdBy",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
FROM email_providers
WHERE role = 'primary' AND connection_type = 'smtp'
ORDER BY priority_order ASC
LIMIT 1;

-- ============================================================
-- 8. UTILITY FUNCTIONS
-- ============================================================

-- Get next provider in failover chain
CREATE OR REPLACE FUNCTION get_next_failover_provider(
  p_task_type email_task_type,
  p_failed_provider_id UUID
) RETURNS UUID AS $$
DECLARE
  v_routing email_task_routing;
  v_next_provider_id UUID;
BEGIN
  -- Get routing configuration
  SELECT * INTO v_routing
  FROM email_task_routing
  WHERE task_type = p_task_type AND is_enabled = true;
  
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  
  -- Find next active provider in fallback chain
  SELECT id INTO v_next_provider_id
  FROM email_providers
  WHERE id = ANY(v_routing.fallback_provider_ids)
    AND is_active = true
    AND id != p_failed_provider_id
    AND consecutive_failures < 5
  ORDER BY array_position(v_routing.fallback_provider_ids, id)
  LIMIT 1;
  
  RETURN v_next_provider_id;
END;
$$ LANGUAGE plpgsql;

-- Update provider health metrics
CREATE OR REPLACE FUNCTION update_provider_health(
  p_provider_id UUID,
  p_success BOOLEAN
) RETURNS VOID AS $$
BEGIN
  UPDATE email_providers
  SET 
    last_used_at = CURRENT_TIMESTAMP,
    total_sent = total_sent + CASE WHEN p_success THEN 1 ELSE 0 END,
    total_failed = total_failed + CASE WHEN NOT p_success THEN 1 ELSE 0 END,
    consecutive_failures = CASE WHEN p_success THEN 0 ELSE consecutive_failures + 1 END,
    last_error_at = CASE WHEN NOT p_success THEN CURRENT_TIMESTAMP ELSE last_error_at END
  WHERE id = p_provider_id;
  
  -- Auto-disable if too many consecutive failures
  UPDATE email_providers
  SET is_active = false
  WHERE id = p_provider_id AND consecutive_failures >= 10;
END;
$$ LANGUAGE plpgsql;
