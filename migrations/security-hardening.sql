-- Security Hardening Migration: 2FA, IP Whitelist, Session Management
-- Date: December 31, 2025
-- Description: Adds 2FA support, IP whitelisting, and enhanced session management

-- Step 1: Add 2FA columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_method VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_verified_at TIMESTAMP;

-- Add index for 2FA lookups
CREATE INDEX IF NOT EXISTS idx_users_2fa_enabled ON users(two_factor_enabled) WHERE two_factor_enabled = TRUE;

-- Step 2: Create IP whitelist table
CREATE TABLE IF NOT EXISTS allowed_admin_ips (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
  ip_address VARCHAR(45) NOT NULL, -- Supports IPv4 and IPv6
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR REFERENCES users(id),
  last_used_at TIMESTAMP
);

-- Add indexes for IP whitelist
CREATE INDEX IF NOT EXISTS idx_allowed_ips_user ON allowed_admin_ips(user_id);
CREATE INDEX IF NOT EXISTS idx_allowed_ips_address ON allowed_admin_ips(ip_address);
CREATE INDEX IF NOT EXISTS idx_allowed_ips_active ON allowed_admin_ips(is_active) WHERE is_active = TRUE;

-- Step 3: Add session tracking columns
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP DEFAULT NOW();
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS max_idle_minutes INTEGER DEFAULT 30;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_id VARCHAR REFERENCES users(id);

-- Add index for session cleanup
CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON sessions(last_activity);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- Step 4: Enhance audit logging for security events
ALTER TABLE admin_audit_logs ADD COLUMN IF NOT EXISTS security_event_type VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_admin_audit_security ON admin_audit_logs(security_event_type) WHERE security_event_type IS NOT NULL;

-- Step 5: Create audit log entries for initial setup
INSERT INTO admin_audit_logs (staff_id, action, target_type, changes, metadata)
SELECT 
  id as staff_id,
  'SECURITY_HARDENING_MIGRATION' as action,
  'system' as target_type,
  jsonb_build_object(
    'migration', 'security_hardening_v1',
    'features', ARRAY['2fa', 'ip_whitelist', 'session_tracking']
  ) as changes,
  jsonb_build_object(
    'timestamp', NOW(),
    'version', '1.0.0'
  ) as metadata
FROM users 
WHERE role IN ('super_admin', 'owner')
LIMIT 1;

-- Step 6: Add default IP whitelist entries (localhost and common development IPs)
-- NOTE: These should be removed in production and replaced with actual allowed IPs
INSERT INTO allowed_admin_ips (ip_address, description, is_active, created_at)
VALUES 
  ('127.0.0.1', 'Localhost IPv4 (development only)', TRUE, NOW()),
  ('::1', 'Localhost IPv6 (development only)', TRUE, NOW())
ON CONFLICT DO NOTHING;

-- Step 7: Create function to auto-update last_activity on session access
CREATE OR REPLACE FUNCTION update_session_activity()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_activity = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for session activity tracking
DROP TRIGGER IF EXISTS trigger_update_session_activity ON sessions;
CREATE TRIGGER trigger_update_session_activity
  BEFORE UPDATE ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_session_activity();

-- Step 8: Create view for active admin sessions
CREATE OR REPLACE VIEW active_admin_sessions AS
SELECT 
  s.sid,
  s.user_id,
  u.email,
  u.role,
  s.last_activity,
  s.max_idle_minutes,
  EXTRACT(EPOCH FROM (NOW() - s.last_activity)) / 60 AS idle_minutes,
  CASE 
    WHEN EXTRACT(EPOCH FROM (NOW() - s.last_activity)) / 60 > s.max_idle_minutes 
    THEN TRUE 
    ELSE FALSE 
  END AS is_expired
FROM sessions s
JOIN users u ON s.user_id = u.id
WHERE u.role IN ('admin', 'super_admin', 'support_manager', 'owner');

-- Step 9: Grant appropriate permissions
GRANT SELECT ON active_admin_sessions TO PUBLIC;

-- Migration complete
SELECT 
  'Security Hardening Migration Complete' AS status,
  NOW() AS completed_at,
  COUNT(*) FILTER (WHERE two_factor_enabled = TRUE) AS users_with_2fa,
  COUNT(*) FILTER (WHERE two_factor_enabled = FALSE AND role IN ('admin', 'super_admin')) AS admins_needing_2fa
FROM users;

-- Display IP whitelist status
SELECT 
  'IP Whitelist Status' AS info,
  COUNT(*) AS total_ips,
  COUNT(*) FILTER (WHERE is_active = TRUE) AS active_ips,
  COUNT(DISTINCT user_id) AS users_with_ips
FROM allowed_admin_ips;

-- Recommendations for production:
-- 1. Remove localhost IPs from allowed_admin_ips
-- 2. Set ADMIN_REQUIRE_2FA=true in environment variables
-- 3. Set ADMIN_IP_WHITELIST_ENABLED=true in environment variables
-- 4. Add actual office/VPN IPs to allowed_admin_ips table
-- 5. Configure Clerk 2FA settings in Clerk Dashboard
-- 6. Test session timeout with ADMIN_IDLE_TIMEOUT_MINUTES env variable
