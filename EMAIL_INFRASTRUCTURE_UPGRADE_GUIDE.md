# Production Email Infrastructure Upgrade - Implementation Guide

## Overview

This upgrade adds three critical features to the BoxCostPro email system:
1. **SMTP Test Button** - Non-destructive SMTP connection testing
2. **Email Health Dashboard** - Real-time provider health monitoring
3. **Enhanced Provider Support** - Production-grade SMTP options for scale

## Features Implemented

### 1. SMTP Test Button

**Location**: Email Configuration Tab → SMTP Form

**How it works**:
- New "Test SMTP Connection" button appears below the password field
- Tests connection WITHOUT saving credentials
- Validates SMTP host, port, security settings, and authentication
- Returns specific error messages for troubleshooting
- No data is persisted if test fails

**Backend Endpoint**: `POST /api/admin/test-smtp`

**Request Body**:
```json
{
  "host": "smtp.gmail.com",
  "port": 587,
  "secure": false,
  "auth": {
    "user": "your-email@gmail.com",
    "pass": "your-app-password"
  }
}
```

**Response**:
```json
{
  "success": true,
  "message": "SMTP configuration is valid and connection successful",
  "timestamp": "2024-01-10T15:30:00.000Z"
}
```

**Error Handling**:
- Invalid host: "getaddrinfo ENOTFOUND..."
- Invalid credentials: "Invalid login: 535 5.7.8 Username and password not accepted"
- Invalid port: "connect ECONNREFUSED..."
- Timeout: "SMTP connection timeout"

### 2. Email Health Dashboard

**Location**: Email Configuration Tab → Health Monitoring (New)

**Features**:
- Real-time provider status (healthy, degraded, down)
- Success rate tracking (target: 95%+)
- Email delivery metrics:
  - Total sent
  - Total failed
  - Average delivery time (milliseconds)
  - Last check timestamp

**Backend Endpoint**: `GET /api/admin/email-health`

**Response**:
```json
{
  "timestamp": "2024-01-10T15:30:00.000Z",
  "providers": [
    {
      "provider": "gmail",
      "status": "healthy",
      "lastChecked": "2024-01-10T15:29:00.000Z",
      "successCount": 1245,
      "failureCount": 3,
      "successRate": 99.76,
      "avgDeliveryTimeMs": 2150
    }
  ],
  "recentLogs": [...]
}
```

**Refresh Behavior**:
- Auto-refreshes every 5 minutes
- Displays last update timestamp
- Shows last 7 days of metrics

### 3. Enhanced Provider Support

**Available Providers**:
1. **Gmail** (SMTP)
   - Host: smtp.gmail.com
   - Port: 587
   - Secure: false
   - Setup: Requires App Password (16 chars, not regular password)

2. **SendGrid** (Future - SMTP Integration Ready)
   - Host: smtp.sendgrid.net
   - Port: 587
   - Secure: false
   - Auth: Username "apikey" + API key

3. **Amazon SES** (Future - SMTP Integration Ready)
   - Host: email-smtp.[region].amazonaws.com
   - Port: 587
   - Secure: false
   - Auth: SMTP username + password from AWS

4. **Custom SMTP**
   - Fully configurable host, port, auth
   - Supports both TLS and SSL

## Database Schema

The system uses existing tables enhanced for health monitoring:

### `email_provider_health` Table
```sql
CREATE TABLE email_provider_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'unknown',
  last_checked TIMESTAMP DEFAULT NOW(),
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  avg_delivery_time VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### `email_send_logs` Table (Used for Health Metrics)
```sql
CREATE TABLE email_send_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(255),
  status VARCHAR(50),
  sent_at TIMESTAMP,
  created_at TIMESTAMP,
  -- other columns...
);
```

## Frontend Components

### EmailConfigurationTab.tsx
Enhanced with:
- SMTP test mutation (`smtpTestMutation`)
- Test button that validates before saving
- Improved error messaging
- Provider preset enhancements

### EmailHealthDashboard.tsx (New)
```typescript
interface ProviderHealth {
  provider: string;
  status: 'healthy' | 'degraded' | 'down';
  lastChecked: string;
  successCount: number;
  failureCount: number;
  successRate: number;
  avgDeliveryTimeMs: number;
}
```

Features:
- Status color coding (green/yellow/red)
- Success rate percentage
- Delivery metrics
- System-wide health summary
- Responsive grid layout

### master-settings.tsx
Updated to include EmailHealthDashboard below EmailConfigurationTab

## Setup Instructions

### For Gmail SMTP

1. **Enable 2-Step Verification**:
   - Go to [Google Account Security](https://myaccount.google.com/security)
   - Enable 2-Step Verification if not already enabled

2. **Generate App Password**:
   - In Google Account → Security → 2-Step Verification section
   - Click "App Passwords"
   - Select "Mail" and "Other (Custom name)"
   - Copy the 16-character password (spaces are OK)

3. **Configure in BoxCostPro**:
   - Select "Gmail" provider
   - Enter email address
   - Enter the 16-character App Password
   - Click "Test SMTP Connection"
   - Click "Test & Save Configuration"

### For SendGrid SMTP (When Integrated)

1. **Get SMTP Credentials**:
   - Go to SendGrid Dashboard → Settings → API Keys
   - Create new API key (or use existing)
   - Username is always "apikey"
   - Password is the API key

2. **Configure in BoxCostPro**:
   - Select "SendGrid" provider
   - Enter your email address
   - Paste API key as password
   - Click "Test SMTP Connection"
   - Click "Test & Save Configuration"

### For Amazon SES SMTP (When Integrated)

1. **Get SMTP Credentials**:
   - Go to AWS SES Console
   - Navigate to Account Dashboard → SMTP Settings
   - Download SMTP credentials (csv file contains username & password)

2. **Configure in BoxCostPro**:
   - Select "Amazon SES" provider
   - Enter your verified email address
   - Paste SMTP username and password
   - Click "Test SMTP Connection"
   - Click "Test & Save Configuration"

## Error Handling & Troubleshooting

### Common SMTP Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `ENOTFOUND` | Invalid SMTP host | Verify SMTP server address |
| `Invalid login` | Wrong credentials | Check username/password or app password |
| `ECONNREFUSED` | Port unreachable | Verify port number (usually 587 or 465) |
| `ETIMEDOUT` | Connection timeout | Check firewall/network access |
| `SSL error` | TLS/SSL mismatch | Toggle "Secure" setting |

### Health Dashboard Interpretation

- **Success Rate < 90%**: Critical - investigate provider issues
- **Success Rate 90-95%**: Warning - monitor closely
- **Success Rate > 95%**: Healthy - system operating normally

## Testing

### Manual Testing

1. **Test SMTP Connection**:
   ```bash
   curl -X POST http://localhost:3000/api/admin/test-smtp \
     -H "Content-Type: application/json" \
     -d '{
       "host": "smtp.gmail.com",
       "port": 587,
       "secure": false,
       "auth": {
         "user": "test@gmail.com",
         "pass": "xxxx xxxx xxxx xxxx"
       }
     }'
   ```

2. **Check Email Health**:
   ```bash
   curl http://localhost:3000/api/admin/email-health \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

3. **Send Test Email**:
   - Use existing test-email endpoint
   - Verify through health dashboard

### Automated Testing

```typescript
// Test SMTP validation
test('SMTP Test Connection Success', async () => {
  const response = await fetch('/api/admin/test-smtp', {
    method: 'POST',
    body: JSON.stringify({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: { user: 'test@gmail.com', pass: 'apppassword' }
    })
  });
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.success).toBe(true);
});

// Test invalid SMTP configuration
test('SMTP Test Connection Failure', async () => {
  const response = await fetch('/api/admin/test-smtp', {
    method: 'POST',
    body: JSON.stringify({
      host: 'invalid.host.com',
      port: 587
    })
  });
  expect(response.status).toBe(400);
  const data = await response.json();
  expect(data.success).toBe(false);
});

// Test health dashboard
test('Email Health Dashboard', async () => {
  const response = await fetch('/api/admin/email-health');
  const data = await response.json();
  expect(data.providers).toBeDefined();
  expect(data.timestamp).toBeDefined();
});
```

## API Reference

### Test SMTP Connection
```
POST /api/admin/test-smtp
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "host": string,
  "port": number,
  "secure": boolean,
  "auth": {
    "user": string,
    "pass": string
  }
}

Response:
{
  "success": boolean,
  "message": string,
  "timestamp": ISO8601,
  "details"?: string (on error)
}
```

### Get Email Health
```
GET /api/admin/email-health
Authorization: Bearer <admin_token>

Response:
{
  "timestamp": ISO8601,
  "providers": ProviderHealth[],
  "recentLogs": any[]
}
```

## Performance Considerations

1. **SMTP Test Timeout**: 10 seconds (configurable)
2. **Health Dashboard Refresh**: 5 minutes
3. **Log Retention**: 7 days for health metrics
4. **Database Indexes**: Create on `email_provider_health(provider, last_checked)`

## Security Considerations

1. **SMTP Passwords**:
   - Never logged to console
   - Stored encrypted in database
   - Not returned in API responses
   - Require admin authentication

2. **Health Endpoint**:
   - Requires `combinedAuth` + `requireAdminAuth`
   - No sensitive data in response (passwords stripped)
   - Safe to display in dashboard

3. **Test Endpoint**:
   - Passwords NOT saved
   - One-time connection test only
   - Admin-only access
   - No side effects if test fails

## Monitoring & Alerts (Future Enhancement)

Recommended additions:
1. Email alerts when success rate drops below 90%
2. Slack/Teams webhook integration for health updates
3. Automatic provider failover on degradation
4. Daily health report emails

## Migration Path for Existing Installations

If upgrading from previous version:

1. **No database migration needed** - uses existing tables
2. **Check current email settings** - may need re-verification
3. **Test SMTP configuration** - use new test button first
4. **Monitor health dashboard** - check for any issues
5. **Update documentation** - inform users of new features

## Support & Troubleshooting

### Debug Mode
Enable detailed logging:
```typescript
// In routes.ts
console.log('[Email] SMTP Test Details:', { host, port, secure });
```

### Common Issues

**Issue**: SMTP test fails but email sends work
- **Cause**: Credentials not properly formatted
- **Solution**: Copy-paste without extra spaces/characters

**Issue**: Health dashboard shows degraded status
- **Cause**: Recent failures in logs
- **Solution**: Check provider status, review recent errors

**Issue**: Test button disabled
- **Cause**: Password field is empty
- **Solution**: Enter password before testing

## File Changes Summary

### New Files
- `client/src/components/EmailHealthDashboard.tsx`

### Modified Files
- `client/src/components/EmailConfigurationTab.tsx` - Added SMTP test mutation and button
- `client/src/components/master-settings.tsx` - Added EmailHealthDashboard import and display
- `server/routes.ts` - Added `/api/admin/test-smtp` and `/api/admin/email-health` endpoints

### No Schema Changes Required
All existing database tables are utilized

## Deployment Checklist

- [ ] Code review completed
- [ ] No breaking changes to existing API
- [ ] Test SMTP endpoint tested with multiple providers
- [ ] Health dashboard queries optimized
- [ ] Error messages reviewed for clarity
- [ ] Admin auth middleware verified
- [ ] UI responsive on mobile
- [ ] Timezone handling verified (timestamps)
- [ ] Database queries use proper pooling
- [ ] Documentation updated
- [ ] Team trained on new features

## Next Steps

1. **Deploy to staging** - Test with real Gmail/SendGrid accounts
2. **Monitor performance** - Check health endpoint response times
3. **Gather feedback** - Get user input on UI/UX
4. **Plan integrations** - SendGrid, Amazon SES, Mailgun
5. **Add alerts** - Email/Slack notifications for health degradation
