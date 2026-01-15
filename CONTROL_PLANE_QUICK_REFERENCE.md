# Platform Control Plane - Quick Reference

## Endpoints at a Glance

### User API (Read-Only)
```bash
# Get all entitlements for user
GET /api/user/entitlements
  Query: forceFresh=true, includeDetails=true
  Response: { decision, cache{ttlSeconds, expiresAt} }

# Check single feature
GET /api/user/entitlements/feature/advancedReporting
  Response: { enabled, reason }

# Check single quota
GET /api/user/entitlements/quota/apiCallsPerMonth
  Response: { limit, used, remaining, exceeded }
```

### Admin APIs (CRUD)

#### Overrides Management
```bash
# Create override
POST /api/admin/overrides
  Body: { userId, featureKey|quotaKey, booleanValue|integerValue|jsonValue,
          startsAt, expiresAt, reason }
  Response: { override, eventId }
  Event: OVERRIDE_GRANTED

# Revoke override
DELETE /api/admin/overrides/:overrideId
  Response: { message, override }
  Event: OVERRIDE_REVOKED

# List overrides
GET /api/admin/overrides?limit=20&offset=0&userId=u_123&status=active
  Response: { overrides[], pagination }

# User's overrides
GET /api/admin/overrides/user/:userId
  Response: { overrides[], activeCount }

# Get one
GET /api/admin/overrides/:overrideId
  Response: { override, auditTrail }
```

#### Webhook Management
```bash
# Create subscription
POST /api/admin/webhooks
  Body: { url, eventFilter{eventTypes[], eventCategories[], userIds[]},
          maxRetries, retryDelaySeconds, testPayload }
  Response: { webhook, secret }

# Update
PUT /api/admin/webhooks/:id
  Body: { url?, eventFilter?, maxRetries?, retryDelaySeconds?, isActive? }

# Delete (deactivate)
DELETE /api/admin/webhooks/:id

# List
GET /api/admin/webhooks?limit=20&offset=0&isActive=true

# Get with deliveries
GET /api/admin/webhooks/:id
  Response: { webhook, recentDeliveries[], statistics }

# Test
POST /api/admin/webhooks/:id/test
  Response: { message, eventId }

# Dead letter queue
GET /api/admin/webhooks/dlq/list?limit=50&offset=0
  Response: { deliveries[], pagination }

# Retry DLQ item
POST /api/admin/webhooks/dlq/retry/:deliveryId
  Response: { message }
```

#### Integrations Hub
```bash
# List all
GET /api/admin/integrations?category=EMAIL
  Response: { integrations[], categories[] }

# Get details
GET /api/admin/integrations/email_smtp
  Response: { integration, credentials[] }

# Configure
POST /api/admin/integrations/email_smtp/connect
  Body: { credentials{host, port, username, password, ...}, testConnection }
  Response: { message, integration }

# Test health
POST /api/admin/integrations/email_smtp/test
  Response: { status: HEALTHY|UNHEALTHY, message }

# Disconnect
POST /api/admin/integrations/email_smtp/disconnect
  Response: { message }
```

---

## Middleware Usage

### Protect Routes
```typescript
import { requireFeature, requireQuota } from '../middleware/requireEntitlement';

// Require feature
app.get('/api/reports/advanced', 
  requireFeature('advancedReporting'),
  (req, res) => { /* ... */ }
);

// Require quota
app.post('/api/exports',
  requireQuota('exportsPerMonth', { required: 5 }),
  (req, res) => { /* ... */ }
);

// Multiple requirements
app.post('/api/batch-process',
  requireEntitlements([
    { feature: 'batchProcessing' },
    { quota: 'batchJobsPerDay', required: 10 }
  ]),
  (req, res) => { /* ... */ }
);

// Soft check (attach to request, don't block)
app.get('/api/data',
  attachEntitlements(),
  (req, res) => {
    console.log(req.entitlementCache); // Available but not enforced
  }
);

// Warn on quota threshold
app.post('/api/email-send',
  warnQuota('emailsPerDay', 0.8), // Warn at 80%
  (req, res) => { /* ... */ }
);
```

---

## Error Responses

### 403 Forbidden (Feature Disabled)
```json
{
  "code": "FEATURE_DISABLED",
  "message": "Advanced reporting is not available for your plan",
  "resolution": "Contact support or upgrade your plan"
}
```

### 429 Too Many Requests (Quota Exceeded)
```json
{
  "code": "QUOTA_EXCEEDED",
  "message": "You have exceeded your monthly API call limit (100,000)",
  "resolution": "Upgrade your plan or contact support"
}
```

### 400 Bad Request (Validation)
```json
{
  "errors": [
    { "path": ["expiresAt"], "message": "Must be in future" },
    { "path": ["reason"], "message": "Minimum 10 characters" }
  ]
}
```

---

## Entitlement Decision Format

```json
{
  "decision": {
    "features": {
      "advancedReporting": {
        "enabled": true,
        "reason": "Included in Enterprise plan"
      },
      "teamCollaboration": {
        "enabled": false,
        "reason": "Not available for Team plan"
      }
    },
    "quotas": {
      "apiCallsPerMonth": {
        "limit": 100000,
        "used": 45230,
        "remaining": 54770,
        "exceeded": false,
        "resetAt": "2024-02-01T00:00:00Z"
      },
      "usersPerAccount": {
        "limit": 5,
        "used": 5,
        "remaining": 0,
        "exceeded": false
      }
    }
  },
  "cache": {
    "computedAt": "2024-01-20T10:30:00Z",
    "expiresAt": "2024-01-21T10:30:00Z",
    "ttlSeconds": 86400,
    "isCached": true
  }
}
```

---

## Event Types Emitted

| Event Type | Category | When | Payload |
|------------|----------|------|---------|
| OVERRIDE_GRANTED | ENTITLEMENT | Admin creates override | {overrideId, reason, expiresAt} |
| OVERRIDE_REVOKED | ENTITLEMENT | Admin revokes override | {overrideId, reason} |
| OVERRIDE_EXPIRED | ENTITLEMENT | Consistency job expires | {overrideId, reason, expiresAt} |
| CACHE_INVALIDATED | SYSTEM | Cache expires | {userId, accessCount} |
| WEBHOOK_TEST | SYSTEM | Admin tests webhook | {webhookId, message} |

---

## Consistency Job Results

Logged to `consistency_check_logs` table:

```json
{
  "checkType": "NIGHTLY_FULL_CHECK",
  "status": "WARNINGS",
  "recordsChecked": 2500,
  "issuesFound": 47,
  "issuesResolved": 47,
  "startedAt": "2024-01-21T02:00:00Z",
  "completedAt": "2024-01-21T02:03:45Z",
  "durationMs": 225000,
  "checks": [
    {
      "checkType": "EXPIRED_OVERRIDES",
      "recordsChecked": 1250,
      "issuesFound": 12
    },
    // ... more checks
  ]
}
```

---

## Integration Test Commands

```bash
# Test SMTP
curl -X POST http://localhost:5000/api/admin/integrations/email_smtp/test \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Test Slack
curl -X POST http://localhost:5000/api/admin/integrations/slack_webhook/test \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Get integration details
curl http://localhost:5000/api/admin/integrations/redis_cache \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Create webhook
curl -X POST http://localhost:5000/api/admin/webhooks \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-system.com/webhooks",
    "eventFilter": {"eventTypes": ["OVERRIDE_GRANTED"]},
    "maxRetries": 5,
    "testPayload": true
  }'
```

---

## Webhook Payload Example

```json
{
  "event": {
    "eventId": "evt_abc123",
    "eventType": "OVERRIDE_GRANTED",
    "eventCategory": "ENTITLEMENT",
    "userId": "user_456",
    "timestamp": "2024-01-20T14:30:00Z",
    "data": {
      "overrideId": "ov_xyz",
      "featureKey": "advancedReporting",
      "reason": "Enterprise customer trial"
    },
    "correlationId": "corr_789"
  },
  "deliveryId": "del_aaa",
  "attemptNumber": 1,
  "signature": "sha256=abc123def456..."
}
```

**Verify signature:**
```typescript
import crypto from 'crypto';

const signature = crypto
  .createHmac('sha256', webhookSecret)
  .update(JSON.stringify(event))
  .digest('hex');

// Compare with X-Webhook-Signature header
```

---

## Troubleshooting

### Cache not updating after override change
- Override change emits event immediately
- Use `forceFresh=true` to bypass cache
- TTL default is 24h, expires when override expiry is near

### Webhook delivery failing
- Check `/api/admin/webhooks/dlq/list` for dead lettered items
- Verify URL is publicly accessible
- Use `POST /api/admin/webhooks/:id/test` to diagnose
- Check max retries (default 5) and delay (default 60s)

### Consistency job taking too long
- Check database connection pool
- Consider running during off-peak hours (change CONSISTENCY_JOB_TIME)
- Monitor `consistency_check_logs` for duration trends

### Integration test returns UNHEALTHY
- Check stored credentials are correct (POST connect first)
- Verify firewall/network access to integration endpoint
- Review lastHealthMessage in GET /api/admin/integrations/:id
- Reconfigure integration with correct credentials

---

## Performance Tips

1. **Cache Strategy**
   - Most users benefit from 24h TTL
   - High-traffic users may benefit from shorter TTL
   - Override expiry near → shorter TTL

2. **Webhook Tuning**
   - Event filter by category for common events
   - Increase maxRetries for critical webhooks
   - Decrease for non-critical (or manual retry via DLQ)

3. **Consistency Job**
   - Schedule for off-peak hours (default 02:00 AM)
   - Monitor duration in consistency_check_logs
   - Adjust CONSISTENCY_JOB_TIME as needed

4. **Integrations**
   - Test connections before production use
   - Store credentials securely (auto-encrypted)
   - Monitor health status in dashboard

---

## Security Notes

✅ All passwords/keys encrypted in transit (HTTPS)  
✅ Webhook signatures verified with HMAC-SHA256  
✅ Integration credentials never exposed in API responses  
✅ Admin operations require admin role + audit logged  
✅ Super admin required for sensitive operations  
✅ Events immutable (append-only, never modified)  
✅ All changes include actor + timestamp + correlation ID  

---

## Related Documentation

- [CONTROL_PLANE_IMPLEMENTATION.md](CONTROL_PLANE_IMPLEMENTATION.md) - Full architecture guide
- [ADMIN_PANEL_ARCHITECTURE.md](ADMIN_PANEL_ARCHITECTURE.md) - Admin auth system
- [ARCHITECTURE.md](ARCHITECTURE.md) - System design
- Code comments in implementation files
