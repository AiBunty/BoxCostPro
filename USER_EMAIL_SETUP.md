# User Email System - Setup Guide

## Overview

BoxCostPro now supports **per-user email configuration**, allowing each user to send quotes and notifications from their own email address instead of a generic system email.

### Supported Methods:
1. **Google OAuth** (Recommended) - Send emails via Gmail using Google's OAuth
2. **Custom SMTP** - Use any email provider (Gmail, Outlook, Yahoo, Zoho, etc.)

---

## ✅ System Status

All core components are already implemented:

- ✅ Database schema (`user_email_settings` table in `shared/schema.ts`)
- ✅ Backend API routes (`server/routes.ts` lines 3348-3660)
- ✅ Storage methods (`server/storage.ts` lines 1900-1923)
- ✅ Email configuration UI (`client/src/components/EmailConfigurationTab.tsx`)
- ✅ Email analytics UI (`client/src/components/EmailAnalyticsTab.tsx`)
- ✅ Settings page integration (Email tab)
- ✅ Google OAuth integration
- ✅ SMTP configuration with presets
- ✅ Email verification and testing
- ✅ Encryption for credentials (AES-256)

---

## 🚀 Quick Setup (3 Steps)

### Step 1: Configure Google OAuth (Optional - for Gmail users)

If you want users to send emails via their Gmail accounts:

1. **Get Google OAuth Credentials**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   - Create or select a project
   - Enable Gmail API
   - Create OAuth 2.0 Client ID (Web application)
   - Add authorized redirect URI: `http://localhost:5000/api/email-settings/google/callback`
   - Copy Client ID and Client Secret

2. **Add to `.env` file**:
   ```env
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   GOOGLE_OAUTH_REDIRECT_URL=http://localhost:5000/api/email-settings/google/callback
   ```

3. **Required OAuth Scopes**:
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/userinfo.email`

### Step 2: Test the System

1. **Start the application**:
   ```bash
   npm run dev
   ```

2. **Navigate to Settings**:
   - Login to BoxCostPro
   - Go to Settings → Email Configuration tab

3. **Configure Email**:

   **Option A: Google OAuth (if configured)**
   - Click "Connect Google Account"
   - Login with Gmail
   - Grant permissions
   - Test the connection

   **Option B: SMTP (any email provider)**
   - Select provider (Gmail, Outlook, Yahoo, etc.)
   - Enter email address
   - Enter SMTP password/app password
   - Click "Save & Verify"
   - Test the configuration

### Step 3: Send Test Email

- After configuration, click "Send Test Email"
- Check inbox for test message
- If successful, email system is ready!

---

## 📋 Email Providers Supported

The system includes presets for popular providers:

| Provider | SMTP Host | Port | SSL/TLS | App Password Required |
|----------|-----------|------|---------|----------------------|
| **Gmail** | smtp.gmail.com | 587 | STARTTLS | Yes ([Get here](https://myaccount.google.com/apppasswords)) |
| **Outlook/Office 365** | smtp-mail.outlook.com | 587 | STARTTLS | No |
| **Yahoo** | smtp.mail.yahoo.com | 587 | STARTTLS | Yes |
| **Zoho** | smtp.zoho.com | 587 | STARTTLS | No |
| **Titan Mail** | smtp.titan.email | 587 | STARTTLS | No |
| **Custom** | [Your SMTP] | [Your Port] | [Configure] | [Depends] |

### Getting Gmail App Password:

1. Go to: https://myaccount.google.com/apppasswords
2. Enable 2-Factor Authentication (required)
3. Create App Password for "Mail"
4. Copy 16-character password
5. Use in BoxCostPro SMTP configuration

---

## 🔐 Security Features

1. **Encryption at Rest**:
   - All SMTP passwords encrypted with AES-256-CBC
   - OAuth tokens encrypted before storage
   - Unique IV (Initialization Vector) per encryption

2. **Token Management**:
   - OAuth access tokens auto-refresh
   - Refresh tokens stored encrypted
   - Token expiration tracking

3. **Verification**:
   - Email configuration verified before activation
   - Test emails confirm working setup
   - Last verification timestamp tracked

4. **Access Control**:
   - Users can only access their own email settings
   - No cross-user data exposure
   - Authentication required on all routes

---

## 📊 Features Available

### Email Configuration:
- ✅ Google OAuth integration
- ✅ SMTP configuration for any provider
- ✅ Email verification
- ✅ Test email sending
- ✅ Configuration status display
- ✅ Last verified timestamp
- ✅ Easy disconnect/reconfigure

### Email Analytics:
- ✅ Delivery statistics
- ✅ Email logs with filters
- ✅ Bounce tracking
- ✅ Success/failure rates
- ✅ Date range filtering

### Sending Capabilities:
- ✅ Quote notifications to customers
- ✅ Follow-up reminders
- ✅ Custom messages
- ✅ PDF attachments (quotes)
- ✅ HTML email templates
- ✅ CC/BCC support

---

## 🎯 User Journey

### First-Time Setup:

1. **User logs in** → Goes to Settings
2. **Clicks Email Configuration tab**
3. **Chooses method**:
   - Google OAuth (one-click connect)
   - OR SMTP (manual configuration)
4. **System verifies** configuration
5. **User sends test email** to confirm
6. **Email system active** ✅

### Sending Quotes:

1. User creates quote in calculator
2. Clicks "Send via Email"
3. System uses **user's configured email**
4. Email sent from user's address
5. Customer receives quote from user's email
6. Replies go to user's inbox

---

## 🛠️ API Endpoints

All endpoints are already implemented in `server/routes.ts`:

### Email Settings:
- `GET /api/email-providers` - Get all provider presets
- `GET /api/email-settings` - Get current user's email settings
- `POST /api/email-settings/smtp` - Save SMTP configuration
- `POST /api/email-settings/verify` - Verify email configuration
- `DELETE /api/email-settings` - Remove email settings

### Google OAuth:
- `GET /api/email-settings/google/status` - Check if OAuth is configured
- `GET /api/email-settings/google/connect` - Initiate OAuth flow
- `GET /api/email-settings/google/callback` - OAuth callback handler
- `POST /api/email-settings/google/disconnect` - Disconnect Google account

### Email Analytics:
- `GET /api/email-analytics/stats` - Get delivery statistics
- `GET /api/email-analytics/logs` - Get email logs with filters
- `GET /api/email-analytics/bounces` - Get bounce data
- `GET /api/email-analytics/bounced-recipients` - Get hard-bounced emails

---

## 🐛 Troubleshooting

### Google OAuth Not Available:

**Problem**: "Connect Google Account" button not showing

**Solution**:
1. Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`
2. Check `GOOGLE_OAUTH_REDIRECT_URL` matches Google Console
3. Restart the server

### SMTP Authentication Failed:

**Problem**: Verification fails with "Authentication failed"

**Solution**:
1. **For Gmail**: Use App Password, not regular password
2. **For others**: Check username and password are correct
3. Verify SMTP host and port are correct
4. Check if 2FA is required

### Email Goes to Spam:

**Problem**: Test emails land in spam folder

**Solution**:
1. Mark as "Not Spam" in email client
2. For production: Configure SPF and DKIM records
3. Consider using dedicated email service (SendGrid, AWS SES)
4. Use verified domain email addresses

### Token Expired Error:

**Problem**: Google OAuth stops working after some time

**Solution**:
1. System should auto-refresh tokens
2. If not working, disconnect and reconnect Google account
3. Check refresh token is stored in database

---

## 📈 Production Deployment

### Before Going Live:

1. **Update Redirect URL**:
   ```env
   GOOGLE_OAUTH_REDIRECT_URL=https://your-domain.com/api/email-settings/google/callback
   ```

2. **Add to Google Console**:
   - Add production URL to authorized redirect URIs
   - Verify domain ownership

3. **Security**:
   - Use strong encryption key (set `ENCRYPTION_KEY` in production)
   - Enable HTTPS (required for OAuth)
   - Configure firewall rules

4. **Email Deliverability**:
   - Configure SPF records
   - Set up DKIM signing
   - Add DMARC policy
   - Consider dedicated email service for high volume

---

## 🎉 Benefits Over Global Email

| Feature | Global Email | User Email |
|---------|--------------|------------|
| **Sender Address** | noreply@boxcostpro.com | user@company.com |
| **Deliverability** | ⚠️ Medium | ✅ High |
| **Spam Score** | ⚠️ Higher | ✅ Lower |
| **Customer Trust** | ⚠️ Lower | ✅ Higher |
| **Reply Handling** | Lost/Manual | ✅ Direct to user |
| **Sending Limits** | Shared among all users | ✅ Per-user limits |
| **Personalization** | Generic | ✅ Personal branding |
| **Reputation** | Shared | ✅ User's own |

---

## 📚 Additional Resources

- **Google OAuth Setup**: https://developers.google.com/identity/protocols/oauth2
- **Gmail API Docs**: https://developers.google.com/gmail/api
- **Gmail App Passwords**: https://myaccount.google.com/apppasswords
- **Nodemailer Docs**: https://nodemailer.com/
- **Email Deliverability**: https://sendgrid.com/blog/email-deliverability-guide/

---

## 🔄 Migration from Global Email

If you were previously using a global email system:

1. Users can configure their email at any time
2. System falls back to global email if user hasn't configured
3. No data migration needed - it's opt-in
4. Encourage users to set up via Settings → Email Configuration

---

## ✨ Future Enhancements (Optional)

Consider implementing:

- [ ] Email scheduling (send later)
- [ ] Email templates customization
- [ ] Bulk email sending
- [ ] Email campaigns
- [ ] Advanced analytics (open rates, click rates)
- [ ] Email signatures
- [ ] Multiple sender addresses per user
- [ ] Team inbox functionality

---

**Status**: ✅ **Ready to Use**

All components are implemented and functional. Users can start configuring their email settings immediately via Settings → Email Configuration tab.

---

*Last Updated: 2025-12-26*
*System Version: v2.0 with Per-User Email Support*
