# Onboarding & Email System Implementation Status

## ✅ COMPLETED

### 1. Critical Bug Fix
- **File**: `client/src/App.tsx` (line 162-172)
- **Issue Fixed**: Route guard was checking non-existent field `onboardingStatus?.paidActive`
- **Solution**: Now correctly checks `verificationStatus === 'approved'`
- **Impact**: Onboarding gate now properly blocks unverified users from dashboard, calculator, quotes, reports

### 2. Database Schema - Email System
- **File**: `shared/schema.ts` (lines 1320-1374)
- **Added Tables**:
  - `adminEmailSettings` - System-wide SMTP configuration with encryption
  - `emailLogs` - Audit trail for all system emails
- **Features**:
  - SMTP provider presets (Gmail, Zoho, Outlook, Yahoo, SES, Custom)
  - Encrypted password storage
  - Test status tracking
  - Email type categorization
  - Comprehensive indexing

### 3. Admin Email Service
- **File**: `server/services/adminEmailService.ts`
- **Features**:
  - SMTP provider presets with auto-filled host/port/encryption
  - Password encryption/decryption using AES-256-CBC
  - Test email configuration before saving
  - Send system emails using active configuration
  - Fire-and-forget async email sending
  - Automatic email logging
- **Presets Included**:
  - Gmail (smtp.gmail.com:587/TLS)
  - Zoho (smtp.zoho.com:587/TLS)
  - Outlook/Microsoft 365 (smtp.office365.com:587/TLS)
  - Yahoo (smtp.mail.yahoo.com:587/TLS)
  - Amazon SES (email-smtp.us-east-1.amazonaws.com:587/TLS)
  - Custom SMTP (manual configuration)

### 4. Email Templates
- **File**: `server/services/emailTemplates/verificationEmails.ts`
- **Templates Created**:
  1. **Admin - New User Signup**: Notifies admin when new business signs up
  2. **Admin - Verification Submitted**: Urgent notification with SLA reminder
  3. **User - Onboarding Reminder**: Progress tracker with CTA to complete setup
  4. **User - Verification Approved**: Celebration email with dashboard access
  5. **User - Verification Rejected**: Rejection reason with resubmit CTA
- **Features**:
  - Both HTML and plain text versions
  - Professional responsive design
  - Progress bars, colored alerts, CTAs
  - Setup instructions and help links

---

## 🚧 IN PROGRESS / TODO

### 5. Storage Layer Methods
**File**: `server/storage.ts`

Need to add:
```typescript
// Email settings CRUD
async getActiveAdminEmailSettings(): Promise<AdminEmailSettings | undefined>
async createAdminEmailSettings(settings: InsertAdminEmailSettings): Promise<AdminEmailSettings>
async updateAdminEmailSettings(id: string, updates: Partial<InsertAdminEmailSettings>): Promise<AdminEmailSettings>
async deactivateOtherEmailSettings(exceptId: string): Promise<void>
async testEmailSettings(id: string, status: 'success' | 'failed'): Promise<void>

// Email logging
async createEmailLog(log: InsertEmailLog): Promise<EmailLog>
async getEmailLogs(filters?: {
  toEmail?: string;
  status?: string;
  emailType?: string;
  limit?: number;
}): Promise<EmailLog[]>

// Onboarding status queries
async getIncompleteOnboardingUsers(olderThan: Date): Promise<User[]>
async countSLABreachedVerifications(): Promise<number>
```

### 6. Admin Email Settings API
**File**: `server/routes.ts` or `server/routes/adminEmailRoutes.ts` (NEW)

Need endpoints:
```typescript
// GET /api/admin/email-settings - Get current configuration
// POST /api/admin/email-settings - Create/update configuration
// POST /api/admin/email-settings/test - Test SMTP configuration
// GET /api/admin/email-logs - View email send history
```

### 7. Email Triggers in Routes
**File**: `server/routes.ts`

Need to integrate email sends into existing endpoints:

**A. On User Signup** (after creating companyProfile):
```typescript
import { sendSystemEmailAsync } from './services/adminEmailService';
import { getAdminNewUserEmailHTML, getAdminNewUserEmailText } from './services/emailTemplates/verificationEmails';

// Send admin notification
await sendSystemEmailAsync(storage, {
  to: process.env.ADMIN_EMAIL || 'admin@boxcostpro.com',
  subject: 'New Business Signup – Verification Pending',
  html: getAdminNewUserEmailHTML({
    businessName: companyProfile.companyName,
    ownerName: user.firstName + ' ' + user.lastName,
    email: user.email,
    mobile: user.mobileNo || '',
    signupDate: new Date().toLocaleDateString(),
    verificationUrl: `${process.env.FRONTEND_URL}/admin/verifications`,
  }),
  emailType: 'admin_notification',
  relatedEntityType: 'user',
  relatedEntityId: user.id,
});
```

**B. On Verification Submission** (POST `/api/onboarding/submit-for-verification`):
```typescript
import { getAdminVerificationSubmittedEmailHTML } from './services/emailTemplates/verificationEmails';

// Notify admin
await sendSystemEmailAsync(storage, {
  to: process.env.ADMIN_EMAIL,
  subject: `Business Ready for Verification: ${user.firstName}`,
  html: getAdminVerificationSubmittedEmailHTML({
    businessName: companyProfile.companyName,
    ownerName: user.firstName + ' ' + user.lastName,
    email: user.email,
    submittedAt: new Date().toLocaleString(),
    verificationUrl: `${process.env.FRONTEND_URL}/admin/verifications`,
  }),
  emailType: 'verification_submitted',
  relatedEntityType: 'user',
  relatedEntityId: user.id,
});
```

**C. On Admin Approval** (POST `/api/admin/users/{userId}/approve`):
```typescript
import { getUserVerificationApprovedEmailHTML } from './services/emailTemplates/verificationEmails';

await sendSystemEmailAsync(storage, {
  to: targetUser.email,
  subject: 'Your Account is Verified 🎉',
  html: getUserVerificationApprovedEmailHTML({
    firstName: targetUser.firstName,
    dashboardUrl: `${process.env.FRONTEND_URL}/dashboard`,
  }),
  emailType: 'verification_approved',
  relatedEntityType: 'user',
  relatedEntityId: targetUser.id,
});
```

**D. On Admin Rejection** (POST `/api/admin/users/{userId}/reject`):
```typescript
import { getUserVerificationRejectedEmailHTML } from './services/emailTemplates/verificationEmails';

await sendSystemEmailAsync(storage, {
  to: targetUser.email,
  subject: 'Verification Needs Changes',
  html: getUserVerificationRejectedEmailHTML({
    firstName: targetUser.firstName,
    rejectionReason: req.body.reason,
    setupUrl: `${process.env.FRONTEND_URL}/onboarding`,
  }),
  emailType: 'verification_rejected',
  relatedEntityType: 'user',
  relatedEntityId: targetUser.id,
});
```

### 8. Onboarding Reminder Cron Job
**File**: `server/services/onboardingReminderJob.ts` (NEW)

```typescript
import { storage } from '../storage';
import { sendSystemEmailAsync } from './adminEmailService';
import { getUserOnboardingReminderEmailHTML } from './emailTemplates/verificationEmails';

export async function sendOnboardingReminders() {
  // Find users who created account > 24h ago but haven't submitted
  const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const incompleteUsers = await storage.getIncompleteOnboardingUsers(cutoffDate);

  for (const user of incompleteUsers) {
    const onboardingStatus = await storage.getOnboardingStatus(user.id);
    const stepsCompleted = [
      onboardingStatus.businessProfileDone,
      onboardingStatus.paperSetupDone,
      onboardingStatus.fluteSetupDone,
      onboardingStatus.taxSetupDone,
      onboardingStatus.termsSetupDone,
    ].filter(Boolean).length;

    await sendSystemEmailAsync(storage, {
      to: user.email,
      subject: 'Complete Your Setup to Activate Your Account',
      html: getUserOnboardingReminderEmailHTML({
        firstName: user.firstName,
        stepsCompleted,
        stepsRemaining: 5 - stepsCompleted,
        setupUrl: `${process.env.FRONTEND_URL}/onboarding`,
      }),
      emailType: 'onboarding_reminder',
      relatedEntityType: 'user',
      relatedEntityId: user.id,
    });
  }
}

// Run every 6 hours
setInterval(sendOnboardingReminders, 6 * 60 * 60 * 1000);
```

Start in `server/app.ts`:
```typescript
import { sendOnboardingReminders } from './services/onboardingReminderJob';
// Start after server is ready
sendOnboardingReminders();
```

### 9. SLA Timer in Admin UI
**File**: `client/src/pages/admin-users.tsx`

Add SLA calculation:
```typescript
function calculateSLA(submittedAt: string) {
  const submitted = new Date(submittedAt);
  const now = new Date();
  const hoursElapsed = (now.getTime() - submitted.getTime()) / (1000 * 60 * 60);
  const SLA_TARGET_HOURS = 24; // From env

  return {
    hoursElapsed: Math.floor(hoursElapsed),
    breached: hoursElapsed > SLA_TARGET_HOURS,
    timeRemaining: Math.max(0, SLA_TARGET_HOURS - hoursElapsed),
    color: hoursElapsed > SLA_TARGET_HOURS ? 'red' : (hoursElapsed > 12 ? 'orange' : 'green'),
  };
}
```

Update pending verifications table to show SLA chip:
```tsx
<Chip
  size="small"
  label={sla.breached ? 'SLA BREACHED' : `${sla.timeRemaining}h remaining`}
  color={sla.breached ? 'error' : (sla.hoursElapsed > 12 ? 'warning' : 'success')}
/>
```

### 10. Admin Email Settings UI
**File**: `client/src/pages/admin-email-settings.tsx` (NEW)

Features needed:
- Dropdown to select provider (Gmail, Zoho, Outlook, Yahoo, SES, Custom)
- Auto-fill SMTP host, port, encryption based on preset
- Manual fields for From Name, From Email, Username, Password
- "Test Configuration" button (sends test email)
- Only allow save after successful test
- Show current active configuration
- Disable other configs when activating new one

### 11. Settings Navigation Cleanup
**Files**:
- `client/src/pages/settings.tsx` - Rename "Master Settings" → "Email Settings"
- `client/src/pages/calculator.tsx` - Remove ALL settings links/buttons
- `client/src/pages/masters.tsx` - Verify no "Business Defaults" duplicate

### 12. SQL Migrations
**File**: `server/migrations/008_admin_email_system.sql` (NEW)

```sql
-- Admin email settings table
CREATE TABLE IF NOT EXISTS admin_email_settings (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR NOT NULL,
  from_name TEXT NOT NULL,
  from_email TEXT NOT NULL,
  smtp_host TEXT NOT NULL,
  smtp_port INTEGER NOT NULL,
  encryption VARCHAR NOT NULL,
  smtp_username TEXT NOT NULL,
  smtp_password_encrypted TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  last_tested_at TIMESTAMP,
  test_status VARCHAR,
  created_by VARCHAR REFERENCES staff(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_admin_email_settings_active ON admin_email_settings(is_active);

-- Email logs table
CREATE TABLE IF NOT EXISTS email_logs (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email TEXT NOT NULL,
  from_email TEXT,
  subject TEXT NOT NULL,
  body TEXT,
  status VARCHAR NOT NULL,
  error_message TEXT,
  email_type VARCHAR,
  related_entity_type VARCHAR,
  related_entity_id VARCHAR,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_email_logs_to ON email_logs(to_email);
CREATE INDEX idx_email_logs_status ON email_logs(status);
CREATE INDEX idx_email_logs_type ON email_logs(email_type);
CREATE INDEX idx_email_logs_created ON email_logs(created_at);

-- Ensure only one active email config
CREATE UNIQUE INDEX idx_admin_email_settings_single_active
ON admin_email_settings(is_active)
WHERE is_active = TRUE;
```

---

## 📋 TESTING CHECKLIST

### Route Guard Testing
- [ ] Unapproved user redirected from `/dashboard` to `/onboarding`
- [ ] Unapproved user redirected from `/calculator` to `/onboarding`
- [ ] Unapproved user redirected from `/quotes` to `/onboarding`
- [ ] Unapproved user can access `/onboarding` and `/account`
- [ ] Admin users bypass all guards
- [ ] Approved users can access all routes

### Email System Testing
- [ ] Admin can configure SMTP with preset (Gmail selected → host/port auto-filled)
- [ ] Test email sends successfully
- [ ] Test email failure prevents save
- [ ] Only one email config can be active
- [ ] Admin receives email on new user signup
- [ ] Admin receives email on verification submission
- [ ] User receives approval email with dashboard link
- [ ] User receives rejection email with reason
- [ ] Onboarding reminder sent 24h after signup
- [ ] All emails logged in `email_logs` table

### SLA Testing
- [ ] SLA timer displays in admin queue
- [ ] SLA breach indicator turns red after 24h
- [ ] Admin stats show SLA breach count

---

## 🔧 ENVIRONMENT VARIABLES REQUIRED

Add to `.env`:
```bash
# Admin email for notifications
ADMIN_EMAIL=admin@boxcostpro.com

# Frontend URL for email links
FRONTEND_URL=https://boxcostpro.com

# Email encryption key (32 characters)
EMAIL_ENCRYPTION_KEY=your-32-character-encryption-key-here

# SLA configuration (hours)
VERIFICATION_SLA_HOURS=24
```

---

## 📝 NEXT STEPS (Priority Order)

1. ✅ **DONE**: Fix route guard bug
2. ✅ **DONE**: Add email schema to database
3. ✅ **DONE**: Create email service with SMTP presets
4. ✅ **DONE**: Create email templates
5. **TODO**: Add storage layer methods for email settings
6. **TODO**: Create admin email settings API endpoints
7. **TODO**: Add email triggers to existing verification routes
8. **TODO**: Create onboarding reminder cron job
9. **TODO**: Add SLA timer to admin UI
10. **TODO**: Create admin email settings UI page
11. **TODO**: Clean up settings navigation
12. **TODO**: Run SQL migrations
13. **TODO**: End-to-end testing

---

## 🎯 SUCCESS CRITERIA

- ✅ Route guard blocks unapproved users from main features
- ⏳ Admin can configure system-wide SMTP email
- ⏳ Email presets auto-fill configuration
- ⏳ Test email must succeed before saving
- ⏳ Admin receives notifications on signup and verification
- ⏳ Users receive approval/rejection emails
- ⏳ Onboarding reminders sent automatically
- ⏳ SLA timer visible in admin queue
- ⏳ All emails logged and auditable
- ⏳ Settings navigation cleaned up (no duplicates, no calculator shortcuts)
