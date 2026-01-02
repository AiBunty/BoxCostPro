# Security Configuration Guide

## Overview

This guide documents the security hardening features implemented in BoxCostPro Admin Panel, including environment variables, deployment steps, and usage instructions.

## Environment Variables

### Two-Factor Authentication (2FA)

```bash
# Enable/disable 2FA enforcement for admin users
ADMIN_REQUIRE_2FA=true
```

- **Default:** `true`
- **Purpose:** When enabled, all admin users must have 2FA enabled before accessing admin features
- **Behavior:** Users without 2FA will be redirected to `/admin/2fa-setup` page
- **Development:** Set to `false` during local development to disable enforcement

### IP Whitelisting

```bash
# Enable/disable IP whitelist enforcement
ADMIN_IP_WHITELIST_ENABLED=true

# Comma-separated list of static IP addresses
ADMIN_IP_WHITELIST=192.168.1.100,10.0.0.50,203.0.113.10
```

- **ADMIN_IP_WHITELIST_ENABLED Default:** `true`
- **Purpose:** Restricts admin panel access to whitelisted IP addresses
- **Behavior:** Unauthorized IPs receive 403 Forbidden with audit log entry
- **Static IPs:** Configure office, VPN, or trusted location IPs in `ADMIN_IP_WHITELIST`
- **Dynamic IPs:** Users can add their own IPs via `/admin/ip-management` page
- **Development:** Set `ADMIN_IP_WHITELIST_ENABLED=false` to disable during local testing

### Session Timeout

```bash
# Admin idle timeout in minutes
ADMIN_IDLE_TIMEOUT_MINUTES=15

# Regular user idle timeout in minutes
USER_IDLE_TIMEOUT_MINUTES=30
```

- **ADMIN_IDLE_TIMEOUT_MINUTES Default:** `15` minutes
- **USER_IDLE_TIMEOUT_MINUTES Default:** `30` minutes
- **Purpose:** Automatically logs out inactive users
- **Warning:** Users see a warning modal 2 minutes before timeout
- **Activity Tracking:** Monitors mouse, keyboard, scroll, touch events

## Features

### 1. Health Check Endpoints

**Public Health Check:**
```bash
GET /health
```

Returns:
```json
{
  "status": "ok|degraded|error",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "services": {
    "database": { "status": "ok", "message": "Connected" },
    "clerk": { "status": "ok", "message": "Configured" },
    "email": { "status": "ok", "message": "Configured" }
  }
}
```

**Admin Health Check:**
```bash
GET /api/admin/health
Authorization: Bearer <token>
```

Includes additional process metrics (PID, memory usage, uptime).

**Usage:**
- Configure load balancer health probes to use `/health` endpoint
- Monitor `/api/admin/health` for detailed system status
- Set up alerts for `status: "error"` responses

### 2. Two-Factor Authentication (2FA)

**Setup Flow:**
1. Admin navigates to `/admin/2fa-setup`
2. Click "Enable Two-Factor Authentication"
3. Redirected to Clerk user profile at `/user#security`
4. Install authenticator app (Google Authenticator, Authy, 1Password)
5. Scan QR code and enter 6-digit code
6. Save backup codes securely
7. Click "Sync Database Status" to update local database

**Sync Endpoint:**
```bash
PATCH /api/auth/user/2fa-status
Authorization: Bearer <token>
Content-Type: application/json

{
  "twoFactorEnabled": true,
  "twoFactorMethod": "totp"
}
```

**Admin Enforcement:**
- If `ADMIN_REQUIRE_2FA=true`, admins without 2FA see 403 error with redirect
- Bypass during development by setting `ADMIN_REQUIRE_2FA=false`
- Audit logs track 2FA_ENABLED and 2FA_DISABLED events

### 3. IP Whitelisting

**Management UI:**
- Navigate to `/admin/ip-management`
- View current IP address at top of page
- Add IP with optional description
- Delete unused IPs
- See last used timestamp for each IP

**API Endpoints:**

Get current IP:
```bash
GET /api/admin/my-ip
Authorization: Bearer <token>
```

List user's IPs:
```bash
GET /api/admin/ip-whitelist/my-ips
Authorization: Bearer <token>
```

Add IP:
```bash
POST /api/admin/ip-whitelist
Authorization: Bearer <token>
Content-Type: application/json

{
  "ipAddress": "192.168.1.100",
  "description": "Office WiFi"
}
```

Delete IP:
```bash
DELETE /api/admin/ip-whitelist/:id
Authorization: Bearer <token>
```

**IP Detection:**
- Checks `X-Forwarded-For` header (proxy/load balancer)
- Falls back to `X-Real-IP` header
- Finally uses `req.socket.remoteAddress`
- Strips IPv6 prefix (::ffff:) for IPv4 addresses

### 4. Session Monitoring

**Frontend Implementation:**
```tsx
import { SessionMonitorProvider } from "@/shared/auth/SessionMonitorProvider";

<SessionMonitorProvider idleTimeoutMinutes={15} warningMinutes={2}>
  <AdminRouter />
</SessionMonitorProvider>
```

**Tracked Activities:**
- Mouse movement
- Mouse clicks
- Keyboard input
- Scroll events
- Touch events

**User Experience:**
- Warning modal appears 2 minutes before timeout
- Countdown timer shows time remaining (MM:SS format)
- "Stay Logged In" button extends session
- Automatic Clerk logout on timeout
- Redirect to login page

### 5. Read-Only Support Role

**Role:** `SUPPORT_VIEWER`

**Permissions:**
- `list_tickets` - View ticket list
- `view_ticket_details` - View ticket details
- `view_assigned_tickets` - View assigned tickets
- `view_user_profile` - View user profiles
- `view_user_subscriptions` - View subscriptions
- `view_user_payments_readonly` - View payment history (read-only)
- `view_user_invoices_readonly` - View invoices (read-only)
- `view_own_metrics` - View personal metrics

**Restrictions:**
- Cannot create, edit, or delete tickets
- Cannot modify user data
- Cannot access financial management
- Cannot access settings or configuration

**Assignment:**
Update user's `adminRole` in database:
```sql
UPDATE users SET admin_role = 'SUPPORT_VIEWER' WHERE id = 'user_id';
```

## Database Migration

**File:** `migrations/security-hardening.sql`

**Run Migration:**
```bash
# Development
psql $DATABASE_URL -f migrations/security-hardening.sql

# Production (with backup)
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
psql $DATABASE_URL -f migrations/security-hardening.sql
```

**Migration Steps:**
1. Adds 2FA columns to `users` table
2. Creates `allowed_admin_ips` table
3. Adds session tracking columns
4. Creates audit log entries
5. Inserts default localhost IPs (127.0.0.1, ::1)
6. Creates session activity trigger
7. Creates `active_admin_sessions` view

**Post-Migration:**
- Verify tables created: `\d allowed_admin_ips`
- Check columns added: `\d users`
- Test health endpoint: `curl http://localhost:5000/health`

## Production Deployment Checklist

### Pre-Deployment

- [ ] **Environment Variables Set:**
  - [ ] `ADMIN_REQUIRE_2FA=true`
  - [ ] `ADMIN_IP_WHITELIST_ENABLED=true`
  - [ ] `ADMIN_IP_WHITELIST=<office_ips>`
  - [ ] `ADMIN_IDLE_TIMEOUT_MINUTES=15`

- [ ] **Database Migration:**
  - [ ] Backup database
  - [ ] Remove localhost IPs from migration SQL
  - [ ] Add real office/VPN IPs
  - [ ] Run migration
  - [ ] Verify tables and columns created

- [ ] **Clerk Configuration:**
  - [ ] Enable 2FA in Clerk Dashboard
  - [ ] Select TOTP and Backup Codes
  - [ ] Test enrollment flow

- [ ] **Load Balancer:**
  - [ ] Configure health check to use `/health` endpoint
  - [ ] Set health check interval (30 seconds)
  - [ ] Set healthy/unhealthy thresholds (2/3)

- [ ] **Firewall Rules:**
  - [ ] Allow `/health` endpoint from load balancer IPs
  - [ ] Document whitelisted IP ranges

- [ ] **Alert Existing Admins:**
  - [ ] Email notification about 2FA requirement
  - [ ] Instructions for IP whitelist setup
  - [ ] Grace period deadline

### Post-Deployment

- [ ] **Monitoring:**
  - [ ] Check `/health` endpoint returns 200 OK
  - [ ] Monitor `admin_audit_logs` for IP_ACCESS_DENIED events
  - [ ] Track 2FA enrollment rate
  - [ ] Watch for session timeout complaints

- [ ] **Verification:**
  - [ ] Test 2FA enforcement (try login without 2FA)
  - [ ] Test IP whitelist (try from unauthorized IP)
  - [ ] Test session timeout (idle for 13 minutes)
  - [ ] Test SUPPORT_VIEWER permissions (try edit/delete)

- [ ] **Rollback Plan:**
  - [ ] Keep database backup for 30 days
  - [ ] Document steps to disable features:
    - Set `ADMIN_REQUIRE_2FA=false`
    - Set `ADMIN_IP_WHITELIST_ENABLED=false`
  - [ ] Test rollback procedure in staging

## Troubleshooting

### "2FA Required" Error

**Problem:** Admin user blocked by 2FA requirement

**Solution:**
1. Navigate to `/admin/2fa-setup`
2. Follow enrollment instructions
3. Enable 2FA in Clerk user profile
4. Click "Sync Database Status"

**Emergency Bypass:**
```bash
# Temporarily disable 2FA enforcement
export ADMIN_REQUIRE_2FA=false
```

### "IP Not Whitelisted" Error

**Problem:** Admin blocked by IP whitelist

**Solution:**
1. Contact super admin to whitelist your IP
2. Super admin adds IP via `/admin/ip-management`
3. Or super admin adds to `ADMIN_IP_WHITELIST` env variable

**Emergency Bypass:**
```bash
# Temporarily disable IP whitelist
export ADMIN_IP_WHITELIST_ENABLED=false
```

**Find Your IP:**
```bash
curl https://api.ipify.org
```

### Session Timeout Too Aggressive

**Problem:** Admins getting logged out during active work

**Solution:**
```bash
# Increase idle timeout to 30 minutes
export ADMIN_IDLE_TIMEOUT_MINUTES=30
```

**Workaround:** Click "Stay Logged In" on warning modal

### Health Check Failing

**Problem:** Load balancer shows instance unhealthy

**Solution:**
1. Check health endpoint manually: `curl http://localhost:5000/health`
2. Review logs for service errors:
   - Database connection issues
   - Clerk credential problems
   - Email configuration missing
3. Fix underlying service issue
4. Verify health check returns `status: "ok"`

## Best Practices

### 2FA
- Use TOTP-based authenticators (not SMS)
- Store backup codes securely (password manager)
- Test backup code recovery flow
- Re-enroll if device lost

### IP Whitelisting
- Use static IPs for office locations
- Whitelist VPN server IPs for remote work
- Add descriptive labels to identify each IP
- Remove old IPs monthly
- Document all whitelisted IPs

### Session Timeout
- Adjust timeout based on user feedback
- Longer timeouts for overnight on-call shifts
- Shorter timeouts for high-security environments
- Test warning modal UX

### Monitoring
- Set up alerts for health check failures
- Monitor IP_ACCESS_DENIED audit log entries
- Track 2FA enrollment rate over time
- Review session timeout metrics weekly

## Security Considerations

**Defense in Depth:**
- 2FA prevents credential theft
- IP whitelisting prevents geographic attacks
- Session timeout limits window of opportunity
- Audit logs provide forensic evidence

**Usability vs Security:**
- 15-minute timeout balances security and convenience
- 2FA enforcement optional during development
- IP whitelist allows multiple trusted locations
- Warning modal prevents unexpected logouts

**Compliance:**
- 2FA meets PCI DSS requirement 8.3
- IP whitelisting supports network segmentation
- Audit logs provide GDPR Article 30 records
- Session timeout enforces access control

## Support

For questions or issues with security features:
1. Review this documentation
2. Check audit logs: `/admin/audit-logs`
3. Contact super admin for access issues
4. File support ticket with security details redacted
