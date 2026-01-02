# Email Setup Troubleshooting Guide

## Common Issues and Solutions

### Issue 1: "Network error" when testing email

**Symptoms**: Clicking "Test Configuration" shows "Network error"

**Causes**:
1. Backend server not running
2. API endpoint not accessible
3. CORS issues
4. Authentication problems

**Solutions**:

#### Step 1: Check if server is running
```bash
# Check if server is running on port 5000
curl http://localhost:5000/api/health
# or
netstat -ano | findstr :5000
```

#### Step 2: Check browser console
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for `[Email Test]` logs
4. Check Network tab for the `/api/admin/email-settings/test` request

#### Step 3: Verify you're logged in as admin
- Check that you have admin/super_admin role
- Try logging out and back in

#### Step 4: Check server logs
Look for:
- `[admin routes] POST /admin/email-settings/test error:`
- Any SMTP connection errors

---

### Issue 2: Gmail SMTP authentication fails

**Symptoms**: Error message about authentication failure

**Common Causes**:
1. **Using regular Gmail password instead of App Password**
2. 2-Step Verification not enabled
3. App Password not generated correctly
4. Wrong username/password

**Solution**:

#### Generate Gmail App Password (Step-by-Step)

1. **Enable 2-Step Verification**:
   - Go to https://myaccount.google.com/security
   - Find "2-Step Verification"
   - Click "Get Started" and follow prompts

2. **Generate App Password**:
   - Go to https://myaccount.google.com/apppasswords
   - Select "Mail" as the app
   - Select "Other (Custom name)" as the device
   - Enter "BoxCostPro" or any name
   - Click "Generate"
   - **Copy the 16-character password** (e.g., "abcd efgh ijkl mnop")

3. **In BoxCostPro Admin Settings**:
   - Provider: Gmail / Google Workspace
   - From Name: Your Company Name
   - From Email: your-email@gmail.com
   - SMTP Username: your-email@gmail.com
   - SMTP Password: Paste the 16-character App Password (remove spaces or keep them, both work)
   - Test Recipient: your-email@gmail.com (or any email)

4. **Click "Test Configuration"**
   - Should see "Test email sent successfully!"
   - Check your inbox for the test email

---

### Issue 3: Gmail 535 Authentication Error

**Error**: `GMAIL_AUTH_FAILED` or "535-5.7.8 Username and Password not accepted"

**Causes**:
- Using regular password instead of App Password
- App Password expired or revoked
- 2FA not enabled

**Solution**:
1. Delete old App Password in Google Account
2. Generate a NEW App Password
3. Use the new 16-character password
4. Make sure to enable 2-Step Verification first

---

### Issue 4: Connection timeout

**Error**: `SMTP_CONNECTION_TIMEOUT`

**Causes**:
- Firewall blocking outgoing port 587
- Antivirus blocking connection
- Network restrictions
- Wrong SMTP host/port

**Solutions**:
1. Check firewall settings
2. Temporarily disable antivirus to test
3. Try different network (e.g., mobile hotspot)
4. Verify SMTP settings are correct for Gmail:
   - Host: `smtp.gmail.com`
   - Port: `587`
   - Encryption: `TLS`

---

### Issue 5: "Missing required fields"

**Error**: `MISSING_REQUIRED_FIELDS`

**Solution**: Fill in ALL fields:
- From Name
- From Email
- SMTP Username
- SMTP Password
- Test Recipient

---

## Testing Steps

### Manual API Test (using curl)

```bash
# Test endpoint directly
curl -X POST http://localhost:5000/api/admin/email-settings/test \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "provider": "gmail",
    "fromName": "BoxCostPro",
    "fromEmail": "your-email@gmail.com",
    "smtpUsername": "your-email@gmail.com",
    "smtpPassword": "your-app-password",
    "testRecipient": "test@example.com"
  }'
```

### Check Server Logs

```bash
# If using npm run dev
# Look for these log messages:
[admin routes] POST /admin/email-settings/test
[SMTP Test] Testing configuration for provider: gmail
[SMTP Test] Connection successful
[SMTP Test] Test email sent successfully
```

---

## Environment Variables

Make sure these are set in `.env`:

```bash
# Required for email encryption
EMAIL_ENCRYPTION_KEY=your-32-character-key-here

# Admin email (optional, for notifications)
ADMIN_EMAIL=admin@boxcostpro.com

# Frontend URL (for email links)
FRONTEND_URL=http://localhost:5000
```

Generate encryption key:
```bash
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

---

## Quick Diagnosis Checklist

- [ ] Server is running (`npm run dev`)
- [ ] Logged in as admin user
- [ ] Browser console shows no errors
- [ ] All form fields filled
- [ ] Using Gmail App Password (not regular password)
- [ ] 2-Step Verification enabled on Google Account
- [ ] Test recipient email is valid
- [ ] Firewall/antivirus not blocking port 587
- [ ] `EMAIL_ENCRYPTION_KEY` set in `.env`

---

## Still Not Working?

1. **Check browser console** - Look for `[Email Test]` logs
2. **Check server console** - Look for `[admin routes]` and `[SMTP Test]` logs
3. **Try different email** - Test with a different Gmail account
4. **Try different provider** - Test with Zoho or another provider
5. **Check network** - Try on different network/VPN

---

## Success Indicators

When everything works correctly, you should see:

**Browser Console**:
```
[Email Test] Sending request with provider: gmail
[Email Test] Response status: 200
[Email Test] Response data: {success: true, message: "Test email sent successfully!"}
```

**Server Console**:
```
[admin routes] POST /admin/email-settings/test
[SMTP Test] Testing configuration for provider: gmail
[SMTP Test] Connection verified
[SMTP Test] Test email sent to: test@example.com
```

**UI**:
- Green success alert
- Message: "Test email sent successfully!"
- "Save Configuration" button becomes enabled

---

## Contact Support

If you've tried all troubleshooting steps and still have issues:
1. Share browser console logs
2. Share server console logs
3. Confirm all environment variables are set
4. Confirm you're using Gmail App Password (not regular password)
