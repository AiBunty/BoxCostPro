# Onboarding Reminder Cron Job Setup

## Overview

The onboarding reminder system automatically sends emails to users who haven't completed their onboarding after 24 hours.

## How It Works

1. **Cron Job Endpoint**: `POST /api/cron/onboarding-reminders`
2. **Schedule**: Every 6 hours (recommended)
3. **Security**: Optional `CRON_SECRET` environment variable for authentication

## Features

- ✅ Finds users with incomplete onboarding (> 24 hours old)
- ✅ Calculates onboarding progress percentage
- ✅ Lists incomplete steps
- ✅ Sends professional HTML reminder emails
- ✅ Prevents duplicate emails (24-hour cooldown)
- ✅ Updates `lastReminderSentAt` timestamp
- ✅ Returns detailed job statistics

## Environment Variables

Add to `.env`:

```bash
# Cron job secret for authentication (optional but recommended)
CRON_SECRET=your-secure-random-secret-here

# Frontend URL for email links
FRONTEND_URL=https://boxcostpro.com
```

Generate secure secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Database Migration

Add `last_reminder_sent_at` column to `onboarding_status` table:

```sql
ALTER TABLE onboarding_status
ADD COLUMN last_reminder_sent_at TIMESTAMP;
```

## Setup Options

### Option 1: GitHub Actions (Recommended)

Create `.github/workflows/onboarding-reminders.yml`:

```yaml
name: Onboarding Reminder Cron

on:
  schedule:
    # Run every 6 hours (0, 6, 12, 18 UTC)
    - cron: '0 */6 * * *'
  workflow_dispatch: # Allow manual trigger

jobs:
  send-reminders:
    runs-on: ubuntu-latest
    steps:
      - name: Send Onboarding Reminders
        run: |
          curl -X POST https://your-domain.com/api/cron/onboarding-reminders \
            -H "Content-Type: application/json" \
            -H "x-cron-secret: ${{ secrets.CRON_SECRET }}" \
            -d '{"secret": "${{ secrets.CRON_SECRET }}"}'
```

**Add Secret in GitHub**:
1. Go to Repository → Settings → Secrets and variables → Actions
2. Add `CRON_SECRET` with the same value as in your `.env`

### Option 2: Vercel Cron (If deployed on Vercel)

Add to `vercel.json`:

```json
{
  "crons": [{
    "path": "/api/cron/onboarding-reminders",
    "schedule": "0 */6 * * *"
  }]
}
```

**Add CRON_SECRET to Vercel Environment Variables**:
1. Go to Vercel Dashboard → Project → Settings → Environment Variables
2. Add `CRON_SECRET` variable

### Option 3: External Cron Service

Use services like:
- **cron-job.org** (free, easy setup)
- **EasyCron** (free tier available)
- **Render Cron Jobs** (if deployed on Render)

**Setup**:
1. Create new cron job
2. URL: `https://your-domain.com/api/cron/onboarding-reminders`
3. Method: POST
4. Headers:
   ```
   Content-Type: application/json
   x-cron-secret: your-secret-here
   ```
5. Body:
   ```json
   {"secret": "your-secret-here"}
   ```
6. Schedule: Every 6 hours (`0 */6 * * *`)

### Option 4: Local Testing

Test the cron job manually:

```bash
# Without authentication
curl -X POST http://localhost:5000/api/cron/onboarding-reminders

# With authentication
curl -X POST http://localhost:5000/api/cron/onboarding-reminders \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: your-secret-here" \
  -d '{"secret": "your-secret-here"}'
```

## Response Format

**Success**:
```json
{
  "success": true,
  "message": "Onboarding reminder job completed",
  "found": 5,
  "sent": 5,
  "failed": 0
}
```

**Failure**:
```json
{
  "success": false,
  "error": "Failed to run onboarding reminder job"
}
```

## Email Template

The reminder email includes:
- Personalized greeting
- Progress bar showing X/5 steps completed
- List of incomplete steps
- Benefits of completing onboarding
- Call-to-action button linking to onboarding page

## Logic Details

### Who Gets Reminders?

Users who match ALL criteria:
- ✅ Account created more than 24 hours ago
- ✅ Onboarding not completed (`verificationStatus !== 'approved'`)
- ✅ Not yet submitted for verification
- ✅ No reminder sent in last 24 hours

### Cooldown Period

- After sending a reminder, `lastReminderSentAt` is updated
- User won't receive another reminder for 24 hours
- This prevents spam and respects user experience

## Files Created/Modified

**New Files**:
- `server/services/onboardingReminderService.ts` - Core reminder logic
- `ONBOARDING_REMINDER_CRON_SETUP.md` - This documentation

**Modified Files**:
- `server/routes.ts` - Added cron endpoint
- `server/storage.ts` - Added `updateOnboardingReminderSent()` method
- `shared/schema.ts` - Added `lastReminderSentAt` field
- `server/services/emailTemplates/verificationEmails.ts` - Reminder template (already exists)

## Monitoring

Check cron job execution:
1. **Server Logs**: Look for `[Cron]` and `[Onboarding Reminder]` prefixes
2. **Email Logs**: Check `email_logs` table in database
3. **Cron Service Dashboard**: Check job execution history in your cron provider

## Troubleshooting

**No emails being sent**:
- Check that admin email settings are configured
- Verify SMTP credentials are correct
- Check `email_logs` table for errors

**Cron job not running**:
- Verify cron schedule is correct
- Check `CRON_SECRET` matches in both places
- Review cron service logs/dashboard

**Duplicate emails**:
- Check `lastReminderSentAt` is being updated correctly
- Verify cooldown logic (24 hours)

## Best Practices

1. **Always use CRON_SECRET** for production deployments
2. **Monitor email delivery rates** - high failure rates indicate SMTP issues
3. **Review cron logs regularly** to ensure job is running
4. **Test locally first** before deploying cron job
5. **Keep cooldown period** at 24 hours to avoid spam

---

**Status**: ✅ Ready for deployment (requires database migration)
