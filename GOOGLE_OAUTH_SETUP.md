# Google OAuth Setup Guide - PaperBox ERP Branding

## 🎯 Goal

Configure Google OAuth to show **"PaperBox ERP"** instead of "Supabase Auth" in the OAuth consent screen.

---

## 📋 Prerequisites

- Google Cloud Console access
- PaperBox ERP logo (PNG, 120x120px minimum)
- Domain ownership (for production)

---

## 🚀 Step-by-Step Setup

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. **Project Name**: `PaperBox ERP`
4. Click "Create"

### Step 2: Enable Google APIs

1. In the project dashboard, go to **APIs & Services** → **Library**
2. Search and enable these APIs:
   - **Google+ API** (for user profile)
   - **People API** (for user info)
   - **Gmail API** (if using email features)

### Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**

2. **User Type**:
   - Select **External** (for public access)
   - Click "Create"

3. **App Information**:
   ```
   App name: PaperBox ERP
   User support email: support@paperboxerp.com
   App logo: [Upload PaperBox ERP logo - 120x120px PNG]
   ```

4. **App Domain**:
   ```
   Application home page: https://paperboxerp.com
   Application privacy policy: https://paperboxerp.com/privacy
   Application terms of service: https://paperboxerp.com/terms
   ```

5. **Authorized Domains**:
   ```
   paperboxerp.com
   ```
   (For local testing, you don't need to add localhost)

6. **Developer Contact Information**:
   ```
   Email: dev@paperboxerp.com
   ```

7. Click "Save and Continue"

8. **Scopes**:
   - Click "Add or Remove Scopes"
   - Add these scopes:
     ```
     .../auth/userinfo.email
     .../auth/userinfo.profile
     openid
     ```
   - Click "Update" → "Save and Continue"

9. **Test Users** (for development):
   - Add test email addresses:
     ```
     your-email@gmail.com
     another-tester@gmail.com
     ```
   - Click "Save and Continue"

10. **Summary**:
    - Review and click "Back to Dashboard"

### Step 4: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**

2. Click "**+ Create Credentials**" → "**OAuth client ID**"

3. **Application type**: Web application

4. **Name**: `PaperBox ERP Web Client`

5. **Authorized JavaScript origins**:
   ```
   For Development:
   http://localhost:5000
   http://localhost:3000

   For Production:
   https://paperboxerp.com
   https://www.paperboxerp.com
   ```

6. **Authorized redirect URIs**:
   ```
   For Development:
   http://localhost:5000/auth/google/callback

   For Production:
   https://paperboxerp.com/auth/google/callback
   https://www.paperboxerp.com/auth/google/callback
   ```

7. Click "**Create**"

8. **Copy Credentials**:
   - **Client ID**: `1234567890-xxxxxxxxxxxxx.apps.googleusercontent.com`
   - **Client Secret**: `GOCSPX-xxxxxxxxxxxxxxx`
   - Save these for .env file

### Step 5: Update Environment Variables

Add to your `.env` file:

```env
# Google OAuth for Authentication (Direct - NO Supabase branding)
GOOGLE_OAUTH_CLIENT_ID=1234567890-xxxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxx
GOOGLE_OAUTH_REDIRECT_URL=http://localhost:5000/auth/google/callback
```

For production:
```env
GOOGLE_OAUTH_REDIRECT_URL=https://paperboxerp.com/auth/google/callback
```

### Step 6: Test OAuth Flow

1. **Start your application**:
   ```bash
   npm run dev
   ```

2. **Navigate to**: `http://localhost:5000/auth`

3. **Click "Continue with Google"**

4. **Expected Flow**:
   ```
   You click "Continue with Google"
     ↓
   Redirected to Google
     ↓
   OAuth Consent Screen appears showing:
     - PaperBox ERP logo
     - "PaperBox ERP wants to access your Google Account"
     - Your support email
     - Requested permissions
     ↓
   You click "Continue"
     ↓
   Redirected back to PaperBox ERP
     ↓
   Logged in successfully ✅
   ```

5. **Verify Branding**:
   - [ ] Logo appears (PaperBox ERP, not Supabase)
   - [ ] App name shows "PaperBox ERP"
   - [ ] Support email shows `support@paperboxerp.com`
   - [ ] No mention of "Supabase" anywhere

---

## 🎨 Branding Checklist

### OAuth Consent Screen Will Show:

✅ **PaperBox ERP logo** (your uploaded image)
✅ **App name**: "PaperBox ERP"
✅ **Description**: "Your Digital Sales Representative"
✅ **Support email**: support@paperboxerp.com
✅ **Privacy policy**: paperboxerp.com/privacy
✅ **Terms of service**: paperboxerp.com/terms

❌ **NO Supabase branding**
❌ **NO "Supabase Auth" text**
❌ **NO third-party logos**

---

## 🔒 Security Best Practices

### 1. Client Secret Security

**DO**:
- ✅ Store in `.env` file (never commit)
- ✅ Use environment variables in production
- ✅ Rotate secrets periodically (every 90 days)

**DON'T**:
- ❌ Hardcode in source code
- ❌ Commit to git
- ❌ Share via email/Slack

### 2. Redirect URI Validation

**Always**:
- ✅ Use HTTPS in production
- ✅ Exact match URIs (no wildcards)
- ✅ Limit to your domains only

**Never**:
- ❌ Use HTTP in production
- ❌ Allow untrusted domains
- ❌ Use wildcards in URIs

### 3. Scope Minimization

**Request only**:
- ✅ `userinfo.email` (email address)
- ✅ `userinfo.profile` (name, picture)
- ✅ `openid` (authentication)

**Don't request**:
- ❌ Gmail read/modify (unless needed)
- ❌ Drive access (unless needed)
- ❌ Calendar access (unless needed)

---

## 🐛 Troubleshooting

### Issue: "Error 400: redirect_uri_mismatch"

**Cause**: Redirect URI doesn't match Google Console configuration

**Solution**:
1. Check `.env` file: `GOOGLE_OAUTH_REDIRECT_URL`
2. Check Google Console: Authorized redirect URIs
3. Ensure exact match (including http/https, trailing slash)
4. Clear browser cache
5. Restart server

**Example**:
```
.env has: http://localhost:5000/auth/google/callback
Console has: http://localhost:5000/auth/google/callback/
                                                      ↑ Extra slash = ERROR
```

### Issue: "403: access_denied"

**Cause**: User denied permission or app not verified

**Solution**:
1. If testing: Add user to "Test users" in OAuth consent screen
2. If production: Submit for Google verification
3. Check scopes are correct
4. Ensure user email is verified

### Issue: Still showing Supabase branding

**Cause**: Using old Supabase OAuth instead of direct implementation

**Solution**:
1. Verify using new endpoint: `/api/auth/google/login`
2. Check `directGoogleOAuth` is imported in routes
3. Confirm environment variables are set
4. Clear browser cache
5. Test in incognito mode

### Issue: "invalid_client"

**Cause**: Client ID or Secret incorrect

**Solution**:
1. Copy credentials from Google Console
2. Verify no extra spaces in `.env`
3. Check Client ID format: `*.apps.googleusercontent.com`
4. Regenerate client secret if needed

---

## 📊 Production Checklist

Before going live:

### Google Cloud:
- [ ] OAuth consent screen configured with production URLs
- [ ] App logo uploaded (120x120px minimum)
- [ ] Privacy policy published at paperboxerp.com/privacy
- [ ] Terms of service published at paperboxerp.com/terms
- [ ] Production domain verified
- [ ] Authorized redirect URIs use HTTPS
- [ ] Test users removed (or switch to "Published" status)

### Application:
- [ ] Environment variables set in production
- [ ] Redirect URLs use HTTPS
- [ ] Client secret stored securely
- [ ] Error handling tested
- [ ] Logging enabled
- [ ] Session management secure (httpOnly cookies)

### Testing:
- [ ] Login flow works end-to-end
- [ ] New user signup creates account
- [ ] Existing user login works
- [ ] Error states handled gracefully
- [ ] Mobile responsive
- [ ] Cross-browser tested (Chrome, Firefox, Safari, Edge)

---

## 🔄 Verification Process (Optional)

If you want to remove the "unverified app" warning:

### Step 1: Prepare for Verification

1. **App Requirements**:
   - [ ] Domain ownership verified
   - [ ] Privacy policy published
   - [ ] Terms of service published
   - [ ] App functional and accessible
   - [ ] Clear description of data usage

2. **Documentation**:
   - [ ] Screenshot of OAuth consent screen
   - [ ] Video demo of auth flow
   - [ ] Explanation of why each scope is needed

### Step 2: Submit for Verification

1. Go to **OAuth consent screen** → **Publishing status**
2. Click "**Publish App**"
3. Fill out verification form
4. Submit

### Step 3: Wait for Approval

- **Timeline**: 4-6 weeks
- **Review Process**: Google manual review
- **Result**: Email notification

### Step 4: After Approval

- "Unverified app" warning removed
- Full access to all users (not just test users)
- Production-ready

---

## 📝 Example .env File (Complete)

```env
# Database
DATABASE_URL=postgres://user:password@localhost:5432/paperboxerp

# Supabase (still used for backend auth, but not visible to users)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxxxx
SUPABASE_ANON_KEY=xxxxx
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxxxx

# Google OAuth for Authentication (Direct - NO Supabase branding)
GOOGLE_OAUTH_CLIENT_ID=1234567890-xxxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxx
GOOGLE_OAUTH_REDIRECT_URL=http://localhost:5000/auth/google/callback

# Email Configuration
FROM_EMAIL=noreply@paperboxerp.com
FROM_NAME=PaperBox ERP

# Application
NODE_ENV=development
PORT=5000
APP_URL=http://localhost:5000
```

---

## 🎉 Success Indicators

You've successfully configured Google OAuth when:

1. ✅ OAuth consent screen shows "**PaperBox ERP**"
2. ✅ Your **custom logo** appears
3. ✅ **No Supabase branding** anywhere
4. ✅ Users can sign in with Google
5. ✅ New users are created automatically
6. ✅ Existing users can log in
7. ✅ Session persists correctly
8. ✅ Logout works properly

---

## 📞 Support

If you encounter issues:

1. Check Google Cloud Console → **APIs & Services** → **Credentials**
2. Verify environment variables are set
3. Check server logs for errors
4. Test in incognito mode
5. Contact: dev@paperboxerp.com

---

## 🔗 Useful Links

- **Google Cloud Console**: https://console.cloud.google.com/
- **OAuth 2.0 Docs**: https://developers.google.com/identity/protocols/oauth2
- **Consent Screen Guide**: https://support.google.com/cloud/answer/10311615
- **Verification Guide**: https://support.google.com/cloud/answer/9110914

---

**Created**: 2025-12-26
**Last Updated**: 2025-12-26
**Status**: ✅ Ready for Implementation

---

*Next Step*: Follow this guide to configure Google OAuth with PaperBox ERP branding, then test the login flow.*
