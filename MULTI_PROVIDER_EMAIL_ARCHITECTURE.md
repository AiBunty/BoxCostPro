# Multi-Provider Email System Architecture

**Version:** 1.0  
**Date:** December 30, 2025  
**Status:** Production-Ready Design

---

## Executive Summary

This document describes a production-grade **Multi-Provider Email Communication System** for an Indian SaaS platform. The system supports simultaneous configuration of multiple email providers (SMTP, API, Webhook) with **task-based routing**, **automatic failover**, and **compliance** with consent requirements.

---

## 1. System Architecture

### 1.1 Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                     APPLICATION LAYER                        │
│  (Quote Emails, Invoices, OTP, Notifications, Marketing)   │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│              EMAIL ROUTING ENGINE                            │
│  • Task-based routing                                        │
│  • Provider selection by priority                            │
│  • Consent checking (GDPR compliant)                         │
│  • Rate limit enforcement                                    │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│         FAILOVER & RETRY LOGIC                               │
│  • Retry same provider (configurable attempts)               │
│  • Automatic fallback to next provider                       │
│  • Never loop infinitely                                     │
│  • Transparent to end users                                  │
└────────────────┬────────────────────────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
        ▼                 ▼
┌──────────────┐  ┌──────────────────┐
│   PROVIDER   │  │  PROVIDER CHAIN  │
│   ADAPTER    │  │  [Primary → F1   │
│   FACTORY    │  │   → F2 → F3]     │
└───────┬──────┘  └──────────────────┘
        │
        ├─────────────────────────┬──────────────────────┬──────────────────┐
        │                         │                      │                  │
        ▼                         ▼                      ▼                  ▼
┌──────────────┐        ┌──────────────┐     ┌──────────────┐   ┌─────────────┐
│Gmail SMTP    │        │Amazon SES    │     │Pabbly        │   │Generic SMTP │
│Adapter       │        │API Adapter   │     │Webhook       │   │(Zoho, etc.) │
└──────────────┘        └──────────────┘     └──────────────┘   └─────────────┘
        │                         │                      │                  │
        └─────────────────────────┴──────────────────────┴──────────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────────┐
                    │  EMAIL SEND LOGS            │
                    │  • Provider used            │
                    │  • Task type                │
                    │  • Success/Failure          │
                    │  • Failover tracking        │
                    └─────────────────────────────┘
```

### 1.2 Data Flow

1. **Application** initiates email send with `taskType` (e.g., `AUTH_EMAILS`)
2. **Routing Engine** checks user consent for task type
3. **Routing Engine** retrieves routing rules for task type
4. **Routing Engine** builds provider chain (primary + fallbacks)
5. **Failover Logic** attempts send with each provider:
   - Retry same provider N times
   - If all retries fail, move to next provider
   - Log each attempt with provider tracking
6. **Provider Adapter** translates request to provider-specific format (SMTP/API/Webhook)
7. **Email Logs** record success/failure with failover metadata

---

## 2. Supported Providers

### 2.1 Provider Matrix

| Provider | Type | Connection | Indian Market | Priority Use Case |
|----------|------|------------|---------------|-------------------|
| **Gmail / Google Workspace** | SMTP | smtp.gmail.com:587 | High | Auth, Transactional |
| **Microsoft 365 / Outlook** | SMTP | smtp.office365.com:587 | High | Enterprise Email |
| **Zoho Mail** | SMTP | smtp.zoho.com:587 | Very High | Indian SMBs |
| **Amazon SES** | API | AWS SDK | Medium | Bulk, Marketing |
| **Yahoo Business Mail** | SMTP | smtp.mail.yahoo.com:587 | Medium | Legacy Systems |
| **Rediffmail Pro** | SMTP | smtp.rediffmail.com:587 | High | Indian Market |
| **Netcore Pepipost** | API | REST API | Very High | Indian Transactional |
| **Brevo (Sendinblue)** | API | REST API | Medium | Marketing Campaigns |
| **Mailgun** | API | REST API | Medium | Developer-friendly |
| **SendGrid** | API | REST API | Medium | Bulk Email |
| **Postmark** | API | REST API | Low | Transactional Focus |
| **SparkPost** | API | REST API | Low | Analytics Focus |
| **Elastic Email** | API | REST API | Medium | Cost-effective Bulk |
| **Mailjet** | API | REST API | Low | Marketing + Trans. |
| **SMTP2GO** | SMTP | mail.smtp2go.com:587 | Low | Backup SMTP |
| **Proton Mail (Business)** | SMTP | smtp.protonmail.ch:587 | Low | Privacy Focus |
| **Pabbly Email Webhook** | Webhook | Custom URL | Medium | Integration Platform |
| **Custom SMTP** | SMTP | User-defined | High | cPanel/Hosting |

### 2.2 Provider Detection

**Automatic Detection:**
- Email domain analysis (`@gmail.com` → Gmail)
- SMTP host pattern matching (`smtp.zoho.com` → Zoho)
- Fallback to `custom_smtp` if unknown

**Manual Override:**
- Admin can explicitly select provider type
- Useful for Google Workspace custom domains

---

## 3. Task-Based Routing

### 3.1 Email Task Types

```typescript
enum EmailTaskType {
  SYSTEM_EMAILS        = 'System health, alerts, monitoring',
  AUTH_EMAILS          = 'OTP, login, password reset, 2FA',
  TRANSACTIONAL_EMAILS = 'Invoices, receipts, confirmations',
  ONBOARDING_EMAILS    = 'Welcome, verification, setup guides',
  NOTIFICATION_EMAILS  = 'User notifications, reminders',
  MARKETING_EMAILS     = 'Campaigns, newsletters, announcements',
  SUPPORT_EMAILS       = 'Tickets, replies, escalations',
  BILLING_EMAILS       = 'Subscription, payment, renewals',
  REPORT_EMAILS        = 'Analytics, summaries, reports'
}
```

### 3.2 Routing Rules (Example Configuration)

| Task Type | Primary Provider | Fallback Chain | Retry Logic |
|-----------|------------------|----------------|-------------|
| AUTH_EMAILS | Gmail (High Reliability) | Zoho → SES | 2 retries, 5s delay |
| TRANSACTIONAL_EMAILS | Amazon SES (Bulk Optimized) | Gmail → Zoho | 1 retry, 3s delay |
| MARKETING_EMAILS | Brevo (Marketing Features) | Netcore → SES | 1 retry, 10s delay |
| SYSTEM_EMAILS | Pabbly Webhook (Always Available) | Gmail → Custom SMTP | 3 retries, 2s delay |
| NOTIFICATION_EMAILS | Gmail | Zoho → Outlook | 1 retry, 5s delay |

### 3.3 Routing Algorithm

```
function routeEmail(taskType, message):
  1. Check user consent for taskType
     - If denied, return CONSENT_REQUIRED error
  
  2. Load routing rules for taskType
     - If force_provider_id set, use ONLY that provider
     - Else, build chain: [primary, ...fallbacks]
  
  3. For each provider in chain:
       a. Check provider is active
       b. Check provider not in circuit-breaker state (consecutiveFailures < 10)
       c. Check rate limits (hourly, daily)
       
       d. For retry in [1..retryAttempts]:
            - Attempt send via provider adapter
            - Log attempt to email_send_logs
            - Update provider health metrics
            - If success, return immediately
            - Else, wait retryDelaySeconds and retry
       
       e. If all retries failed, mark failover and try next provider
  
  4. If all providers failed, return ALL_PROVIDERS_FAILED error
```

---

## 4. Failover Logic

### 4.1 Failover Sequence

```
Attempt 1: PRIMARY (Gmail)
  ├─ Retry 1: Failed (SMTP timeout)
  ├─ Wait 5s
  └─ Retry 2: Failed (Connection refused)
  
Failover to FALLBACK_1 (Zoho)
  ├─ Retry 1: Failed (Rate limit exceeded)
  
Failover to FALLBACK_2 (Amazon SES)
  ├─ Retry 1: Success ✓
  
Result: {
  success: true,
  providerId: "ses-123",
  failoverOccurred: true,
  failoverFromProviderId: "gmail-456",
  totalAttempts: 4
}
```

### 4.2 Failover Guarantees

✅ **No Infinite Loops:** Max attempts enforced (default: 3 total)  
✅ **Transparent to Users:** Failover happens automatically  
✅ **Logged for Debugging:** All attempts tracked in `email_send_logs`  
✅ **Provider Health Monitoring:** Auto-disable after 10 consecutive failures  
✅ **Rate Limit Respect:** Skip provider if hourly/daily limit reached  

---

## 5. Database Schema

### 5.1 Core Tables

**`email_providers`** - Provider configurations
- Stores SMTP/API/Webhook credentials (encrypted)
- Priority ordering (`priority_order` column)
- Health metrics (`consecutiveFailures`, `totalSent`, `totalFailed`)
- Rate limit tracking (`currentHourlyCount`, `currentDailyCount`)

**`email_task_routing`** - Task type → Provider mapping
- Maps each task type to primary + fallback providers
- Retry configuration (`retryAttempts`, `retryDelaySeconds`)
- Force provider override (`forceProviderId`)

**`email_send_logs`** - Comprehensive send logs
- Tracks every send attempt with provider info
- Failover metadata (`failoverOccurred`, `failoverFromProviderId`)
- User tracking (`user_id`) for analytics

**`user_email_preferences`** - Consent management (GDPR)
- Per-user, per-task-type consent flags
- `MARKETING_EMAILS` requires explicit opt-in
- `AUTH_EMAILS` and `TRANSACTIONAL_EMAILS` cannot be disabled

**`email_provider_health`** - Health metrics aggregation
- Periodic snapshots of provider performance
- Auto-disable triggers based on success rate

### 5.2 Backward Compatibility

**View: `admin_email_settings`** - Maps new schema to old single-provider API
- Selects primary SMTP provider from `email_providers`
- Allows existing code to work without modification

---

## 6. Safety & Compliance

### 6.1 Security

✅ **Encryption at Rest:** All credentials encrypted with AES-256-GCM  
✅ **No Secret Logging:** Passwords/API keys never logged (only presence/length)  
✅ **Fail-Fast Validation:** Encryption key validated at server startup  
✅ **Health Endpoints:** Provider health checks never expose credentials  

### 6.2 Compliance (GDPR, India DPDP Act)

✅ **Explicit Consent:** `MARKETING_EMAILS` require user opt-in  
✅ **Transactional Exemption:** `AUTH_EMAILS` and `TRANSACTIONAL_EMAILS` always allowed  
✅ **Audit Trail:** All emails logged with timestamp, provider, task type  
✅ **User Control:** Users can disable non-essential email types  

---

## 7. Admin Panel Features

### 7.1 Provider Management

**Settings → Communication → Email Providers**

Admin can:
- ➕ **Add new provider** (SMTP, API, or Webhook)
- ✏️ **Edit provider** credentials, limits, priority
- 🧪 **Test provider** connection without sending email
- 🔄 **Reorder providers** by drag-and-drop priority
- ⏸️ **Disable provider** instantly (turns off `is_active`)
- 📊 **View health metrics** (success rate, last error, consecutive failures)

### 7.2 Task Routing Configuration

**Settings → Communication → Email Routing**

Admin can:
- 🎯 **Assign primary provider** per task type
- 🔀 **Configure fallback chain** (ordered)
- ⚙️ **Set retry policy** (attempts, delay)
- 🚫 **Disable task routing** entirely
- 🔒 **Force specific provider** (override routing)

### 7.3 Monitoring Dashboard

**Analytics → Email Delivery**

Admin sees:
- 📈 **Provider performance** (sent, failed, success rate)
- 🔄 **Failover events** (frequency, reasons)
- 📋 **Email logs** (searchable, filterable)
- ⚠️ **Health alerts** (providers in degraded state)
- 📊 **Task type breakdown** (which types use which providers)

---

## 8. User Panel Rules

### 8.1 User Capabilities

✅ **Manage consent preferences** (opt-in/opt-out for non-essential emails)  
✅ **Set email frequency** (immediate, daily digest, weekly digest, none)  
❌ **Cannot see SMTP/API details** (hidden from users)  
❌ **Cannot configure providers** (admin-only)  
❌ **Cannot choose provider** (routing is automatic)  

### 8.2 Consent UI Example

```
Email Preferences

☑ System Emails (required)
☑ Authentication Emails (required)
☑ Transactional Emails (required)
☑ Onboarding Emails
☑ Notification Emails
☐ Marketing Emails ← User must explicitly opt-in
☑ Support Emails
☑ Billing Emails
☑ Report Emails

Email Frequency: [Immediate ▼]
```

---

## 9. API Contracts

### 9.1 Admin API Endpoints

**Provider Management:**
```
POST   /api/admin/email-providers           - Create provider
GET    /api/admin/email-providers           - List all providers
GET    /api/admin/email-providers/:id       - Get provider details
PATCH  /api/admin/email-providers/:id       - Update provider
DELETE /api/admin/email-providers/:id       - Delete provider
POST   /api/admin/email-providers/:id/test  - Test provider
PATCH  /api/admin/email-providers/:id/priority - Reorder priority
```

**Task Routing:**
```
POST   /api/admin/email-routing              - Create routing rule
GET    /api/admin/email-routing              - List all routing rules
GET    /api/admin/email-routing/:taskType    - Get routing for task
PATCH  /api/admin/email-routing/:taskType    - Update routing
```

**Monitoring:**
```
GET    /api/admin/email-logs                 - Get email send logs (paginated)
GET    /api/admin/email-providers/:id/health - Get provider health metrics
GET    /api/admin/email-analytics            - Get aggregated analytics
```

### 9.2 Application API (Internal)

```typescript
// Send email with automatic routing
const result = await emailRoutingEngine.sendWithRouting(
  'TRANSACTIONAL_EMAILS',
  {
    to: 'customer@example.com',
    subject: 'Your Invoice',
    html: '<html>...',
  },
  {
    userId: 'user-123',
    emailId: 'invoice-456',
    metadata: { invoiceId: 'INV-2025-001' }
  }
);

// Send email with specific provider (bypass routing)
const result = await emailRoutingEngine.sendWithProvider(
  provider,
  message,
  attemptNumber
);
```

---

## 10. Provider Adapter Implementations

### 10.1 Gmail SMTP Adapter

```typescript
class GmailAdapter extends EmailProviderAdapter {
  - Uses nodemailer with smtp.gmail.com:587
  - Requires App Password (not regular password)
  - Supports: HTML, attachments, CC/BCC
  - Max recipients: 100 per email
  - Max attachment: 25MB
}
```

### 10.2 Amazon SES API Adapter

```typescript
class SESAdapter extends EmailProviderAdapter {
  - Uses AWS SDK v3 (@aws-sdk/client-sesv2)
  - Requires: Access Key ID + Secret Access Key
  - Supports: HTML, text, attachments (via raw email)
  - Max recipients: 50 per email
  - Max attachment: 10MB
  - Region-specific endpoints
}
```

### 10.3 Pabbly Webhook Adapter

```typescript
class PabblyWebhookAdapter extends EmailProviderAdapter {
  - POST JSON to custom webhook URL
  - No authentication (webhook URL is secret)
  - Supports: HTML, text, metadata
  - Does NOT support: Attachments
  - Useful for: Integration with Pabbly Connect workflows
}
```

### 10.4 Generic SMTP Adapter

```typescript
class GenericSMTPAdapter extends EmailProviderAdapter {
  - Works with ANY SMTP provider
  - Uses nodemailer
  - Configurable: host, port, encryption (TLS/SSL)
  - Supports: All standard email features
  - Used for: Zoho, Outlook, Yahoo, Rediffmail, cPanel, etc.
}
```

---

## 11. Implementation Roadmap

### Phase 1: Foundation (Week 1)
- ✅ Database schema migration
- ✅ Provider abstraction layer
- ✅ Provider adapters (Gmail, SES, Webhook, Generic SMTP)
- ✅ Routing engine with failover

### Phase 2: Admin Panel (Week 2)
- ⏳ Provider management UI
- ⏳ Task routing configuration UI
- ⏳ Provider testing interface
- ⏳ Health monitoring dashboard

### Phase 3: Integration (Week 3)
- ⏳ Update existing email code to use routing engine
- ⏳ Migrate admin_email_settings to new schema
- ⏳ Add consent checking to all email sends
- ⏳ Implement rate limit tracking

### Phase 4: Monitoring & Optimization (Week 4)
- ⏳ Provider health aggregation job (cron)
- ⏳ Auto-disable unhealthy providers
- ⏳ Email delivery analytics dashboard
- ⏳ Alerting for failover events

---

## 12. Backward Compatibility Strategy

### 12.1 Existing Code Support

**Old API:**
```typescript
const settings = await storage.getActiveAdminEmailSettings();
// Returns single provider (backward compatible)
```

**New API (Recommended):**
```typescript
const result = await emailRoutingEngine.sendWithRouting(
  'TRANSACTIONAL_EMAILS',
  message,
  { userId: '...' }
);
```

### 12.2 Migration Path

1. **Deploy new schema** alongside existing `admin_email_settings` table
2. **Create view** `admin_email_settings` that maps to primary provider
3. **Gradually update code** to use `emailRoutingEngine.sendWithRouting()`
4. **Mark old functions as deprecated** with console warnings
5. **Remove old code** after 6 months

---

## 13. Testing Strategy

### 13.1 Unit Tests
- Provider adapters (mock SMTP/API responses)
- Routing engine logic (task → provider mapping)
- Failover logic (retry + fallback)
- Consent checking

### 13.2 Integration Tests
- End-to-end email send with real providers (sandbox mode)
- Failover simulation (disable primary, verify fallback)
- Rate limit enforcement
- Health metric updates

### 13.3 Load Tests
- 1000 emails/minute with failover
- Rate limit boundary conditions
- Provider health degradation simulation

---

## 14. Production Deployment Checklist

- [ ] Run database migrations
- [ ] Configure at least 2 providers (primary + fallback)
- [ ] Test each provider connection
- [ ] Set up task routing rules for all task types
- [ ] Enable health monitoring cron job
- [ ] Configure rate limits per provider
- [ ] Set up alerting for failover events
- [ ] Update application code to use routing engine
- [ ] Document provider credentials in secret manager
- [ ] Train admin team on provider management UI

---

## 15. Support & Maintenance

### 15.1 Adding New Provider

1. Determine provider type (SMTP/API/Webhook)
2. If API/Webhook: Implement new adapter class in `providerAdapters.ts`
3. Add provider preset in `ProviderDetector.getProviderPreset()`
4. Test adapter with real credentials
5. Document in provider matrix (Section 2.1)

### 15.2 Troubleshooting Failover Issues

1. Check `email_send_logs` for failover events
2. Review provider health metrics (`consecutiveFailures`)
3. Verify routing configuration (`email_task_routing`)
4. Test each provider individually
5. Check rate limits (`currentHourlyCount`, `currentDailyCount`)

---

## Conclusion

This multi-provider email system provides **production-grade reliability**, **automatic failover**, and **compliance** with consent laws. It supports **18+ providers** with **task-based routing** and is designed for the **Indian SaaS market** with providers popular in India (Zoho, Rediffmail, Netcore).

The architecture is **scalable**, **maintainable**, and **backward compatible** with existing single-provider implementations.
