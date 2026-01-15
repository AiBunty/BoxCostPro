-- Create platform admins table (independent of users)
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin')),
  is_active BOOLEAN DEFAULT true,
  twofa_enabled BOOLEAN DEFAULT false,
  twofa_secret TEXT,
  created_at TIMESTAMP DEFAULT now(),
  last_login_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES admins(id),
  session_token VARCHAR(255) UNIQUE NOT NULL,
  ip_address VARCHAR(64),
  user_agent TEXT,
  impersonated_user_id VARCHAR(255),
  last_activity_at TIMESTAMP DEFAULT now(),
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin ON admin_sessions(admin_id);

CREATE TABLE IF NOT EXISTS admin_login_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admins(id),
  action VARCHAR(32) NOT NULL,
  ip_address VARCHAR(64),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_login_logs_admin ON admin_login_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_login_logs_action ON admin_login_audit_logs(action);

CREATE TABLE IF NOT EXISTS admin_allowed_ips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admins(id),
  ip_address VARCHAR(64) NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_ips_admin ON admin_allowed_ips(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_ips_cidr ON admin_allowed_ips(ip_address);

-- Seed admins from existing users that were marked as admin/super_admin (password_hash must be set manually later)
INSERT INTO admins (id, email, name, role, is_active, created_at, last_login_at, password_hash)
SELECT
  id,
  email,
  CONCAT_WS(' ', first_name, last_name),
  CASE WHEN role = 'super_admin' THEN 'super_admin' ELSE 'admin' END,
  true,
  created_at,
  last_login_at,
  '$2b$12$QvqBL6zr4gqXWFutQkL.DuJl6VFdSxZ6rpKvyGlvNH.x5VdlVcfL6'
FROM users
WHERE role IN ('super_admin', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Remove admin/super_admin rows from users to enforce separation
DELETE FROM users WHERE role IN ('super_admin', 'admin');

-- Enforce user roles to business-only roles
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
UPDATE users SET role = 'staff' WHERE role NOT IN ('owner', 'staff');
ALTER TABLE users
  ADD CONSTRAINT users_role_check CHECK (role IN ('owner', 'staff'));
