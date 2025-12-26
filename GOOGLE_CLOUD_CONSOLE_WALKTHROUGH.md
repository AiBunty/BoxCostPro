# Google Cloud Console Walkthrough - Get OAuth Credentials

## 🎯 Goal
Get Google OAuth credentials with **PaperBox ERP branding** in 15 minutes.

---

## 📋 Step-by-Step Instructions (Follow Along)

### Step 1: Access Google Cloud Console

1. **Open browser** and go to: https://console.cloud.google.com/

2. **Sign in** with your Google account
   - Use your company Gmail or personal Gmail
   - You'll need this account to manage the project

3. **You'll see** the Google Cloud Dashboard

---

### Step 2: Create New Project

1. **Click** the project dropdown at the top (next to "Google Cloud")

2. **Click** "NEW PROJECT" button (top right)

3. **Fill in project details**:
   ```
   Project name: PaperBox ERP
   Organization: (leave as is or select if you have one)
   Location: (leave as is)
   ```

4. **Click** "CREATE" button

5. **Wait** 10-20 seconds for project creation

6. **You'll see** notification "PaperBox ERP has been created"

7. **Click** "SELECT PROJECT" or switch to the new project

---

### Step 3: Enable Required APIs

1. **Click** the hamburger menu (☰) on top left

2. **Navigate to**: APIs & Services → Library

3. **Search for** "Google+ API"
   - Click on it
   - Click "ENABLE"
   - Wait for it to enable

4. **Go back** and search for "People API"
   - Click on it
   - Click "ENABLE"
   - Wait for it to enable

---

### Step 4: Configure OAuth Consent Screen

1. **Click** hamburger menu (☰) → APIs & Services → **OAuth consent screen**

2. **Select User Type**:
   - Choose: ⚪ Internal (if you have Google Workspace)
   - OR choose: ⚪ **External** (recommended for most users)
   - Click "CREATE"

3. **App Information** (Page 1):
   ```
   App name: PaperBox ERP

   User support email: [Your email - select from dropdown]

   App logo: [Click "Choose file" and upload PaperBox logo]
             (Recommended: 120x120 pixels, PNG format)
             (Can skip for now and add later)
   ```

4. **App Domain** (scroll down):
   ```
   Application home page: https://paperboxerp.com
   (Or use: http://localhost:5000 for testing)

   Application privacy policy link: https://paperboxerp.com/privacy
   (Or use: http://localhost:5000/privacy for testing)

   Application terms of service link: https://paperboxerp.com/terms
   (Or use: http://localhost:5000/terms for testing)
   ```

5. **Authorized domains**:
   ```
   paperboxerp.com
   ```
   (For local testing, you can skip this)

6. **Developer contact information**:
   ```
   Email addresses: [Your email]
   ```

7. **Click** "SAVE AND CONTINUE"

8. **Scopes** (Page 2):
   - Click "ADD OR REMOVE SCOPES"
   - In the search box, type: `userinfo.email`
   - ✅ Check: `.../auth/userinfo.email`
   - ✅ Check: `.../auth/userinfo.profile`
   - ✅ Check: `openid`
   - Click "UPDATE"
   - Click "SAVE AND CONTINUE"

9. **Test users** (Page 3):
   - For development, add test emails:
   - Click "+ ADD USERS"
   - Enter your email addresses (one per line):
     ```
     your-email@gmail.com
     developer@yourcompany.com
     ```
   - Click "ADD"
   - Click "SAVE AND CONTINUE"

10. **Summary** (Page 4):
    - Review everything
    - Click "BACK TO DASHBOARD"

---

### Step 5: Create OAuth Credentials

1. **Click** hamburger menu (☰) → APIs & Services → **Credentials**

2. **Click** "+ CREATE CREDENTIALS" (top)

3. **Select** "OAuth client ID"

4. **Application type**:
   - Select: **Web application**

5. **Name**:
   ```
   PaperBox ERP Web Client
   ```

6. **Authorized JavaScript origins**:
   - Click "+ Add URI"
   - Add for local development:
     ```
     http://localhost:5000
     ```
   - Click "+ Add URI" again
   - Add for production (when ready):
     ```
     https://paperboxerp.com
     ```

7. **Authorized redirect URIs**:
   - Click "+ Add URI"
   - Add for local development:
     ```
     http://localhost:5000/auth/google/callback
     ```
   - Click "+ Add URI" again
   - Add for production (when ready):
     ```
     https://paperboxerp.com/auth/google/callback
     ```

8. **Click** "CREATE"

9. **Popup appears** with your credentials:
   ```
   Your Client ID:
   1234567890-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com

   Your Client Secret:
   GOCSPX-AbCdEfGhIjKlMnOpQrStUvWxYz
   ```

10. **IMPORTANT**: Copy both values now!
    - Copy Client ID
    - Copy Client Secret
    - Or click "DOWNLOAD JSON" to save

---

### Step 6: Add Credentials to .env File

Now you have your credentials! Let's add them:

1. **Open** your `.env` file:
   ```
   c:\Users\ventu\BoxCostPro\BoxCostPro\.env
   ```

2. **Find lines 21-22** and replace:

   **BEFORE:**
   ```env
   GOOGLE_OAUTH_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
   GOOGLE_OAUTH_CLIENT_SECRET=your-google-oauth-client-secret
   ```

   **AFTER (paste your actual credentials):**
   ```env
   GOOGLE_OAUTH_CLIENT_ID=1234567890-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com
   GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-AbCdEfGhIjKlMnOpQrStUvWxYz
   ```

3. **Save** the file (Ctrl+S)

---

### Step 7: Verify Configuration

Let's make sure everything is set up correctly:

1. **Check .env file** has:
   ```env
   GOOGLE_OAUTH_CLIENT_ID=[your-client-id].apps.googleusercontent.com
   GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-[your-secret]
   GOOGLE_OAUTH_REDIRECT_URL=http://localhost:5000/auth/google/callback
   ```

2. **Check Google Console**:
   - Go back to: https://console.cloud.google.com/apis/credentials
   - You should see your OAuth 2.0 Client listed
   - Click on it to verify redirect URIs are correct

---

### Step 8: Test OAuth Flow

1. **Stop server** if running:
   ```bash
   Ctrl+C
   ```

2. **Start server**:
   ```bash
   npm run dev
   ```

3. **Look for** in console:
   ```
   [DirectGoogleOAuth] Initialized with redirect URL: http://localhost:5000/auth/google/callback
   ```

4. **Open browser**: http://localhost:5000/auth

5. **Click** "Continue with Google" button

6. **Expected flow**:
   ```
   → Redirected to Google
   → See "PaperBox ERP wants to access your Google Account"
   → Shows permissions: email, profile, openid
   → Click "Continue"
   → Redirected back to your app
   → Logged in! ✅
   ```

---

## 🎨 What Users Will See

### OAuth Consent Screen (Desktop):
```
┌─────────────────────────────────────────┐
│  [Google Logo]                          │
│                                          │
│  Sign in to continue to PaperBox ERP    │
│                                          │
│  [PaperBox ERP Logo]                    │
│  PaperBox ERP                            │
│                                          │
│  PaperBox ERP wants to access your      │
│  Google Account                          │
│                                          │
│  user@gmail.com                          │
│                                          │
│  This will allow PaperBox ERP to:       │
│  • See your primary email address       │
│  • See your personal info              │
│                                          │
│  [Cancel]  [Continue]                   │
│                                          │
│  support@paperboxerp.com                │
│  Privacy policy • Terms of service      │
└─────────────────────────────────────────┘
```

**No Supabase branding!** ✅

---

## 🐛 Troubleshooting

### Issue: Can't create project

**Solution**:
- Make sure you're signed in with correct Google account
- Try a different browser (Chrome recommended)
- Clear browser cache and try again

### Issue: Can't find OAuth consent screen

**Solution**:
- Hamburger menu (☰) → APIs & Services → OAuth consent screen
- Make sure you're in the correct project (check top dropdown)

### Issue: "Error 400: redirect_uri_mismatch"

**Cause**: Redirect URI mismatch between code and Google Console

**Solution**:
1. Check Google Console redirect URIs exactly match:
   ```
   http://localhost:5000/auth/google/callback
   ```
2. No trailing slash
3. Correct port number (5000)
4. Wait 1-2 minutes after saving in Console

### Issue: "Error 403: access_denied"

**Cause**: User not in test users list (for External apps in development)

**Solution**:
1. Go to OAuth consent screen → Test users
2. Add your email address
3. Save
4. Try logging in again

### Issue: "This app isn't verified"

**This is normal!** For development:
- Click "Advanced"
- Click "Go to PaperBox ERP (unsafe)" - it's safe, just not verified yet
- For production, you'll need to submit for verification

---

## ✅ Success Checklist

After completing all steps:

- [ ] Google Cloud project "PaperBox ERP" created
- [ ] OAuth consent screen configured
- [ ] App name shows "PaperBox ERP"
- [ ] Logo uploaded (optional)
- [ ] OAuth credentials created
- [ ] Client ID copied to .env
- [ ] Client Secret copied to .env
- [ ] Redirect URIs configured correctly
- [ ] .env file saved
- [ ] Server restarted
- [ ] Test login works
- [ ] OAuth screen shows "PaperBox ERP" (not Supabase)

---

## 🎯 Next Steps

Once credentials are working:

1. **Update frontend** to use new OAuth endpoint
2. **Test complete flow** (signup, login, logout)
3. **Customize branding** (upload logo if you haven't)
4. **For production**: Add production URLs to redirect URIs

---

## 📸 Visual Checkpoints

### ✅ Correct OAuth Consent Screen:
```
App name: PaperBox ERP ✅
Logo: [Your logo] ✅
Support email: support@paperboxerp.com ✅
```

### ❌ Incorrect (Old Supabase OAuth):
```
App name: Supabase Auth ❌
Logo: Supabase logo ❌
```

---

## 💾 Save Your Credentials

**Important**: Keep these safe!

1. **Download JSON**:
   - In Google Console → Credentials
   - Click download icon next to your OAuth client
   - Save to secure location (NOT in git repo)

2. **Backup .env file**:
   - Keep a copy in secure location
   - Don't commit to git

3. **Document**:
   - Note where credentials came from
   - Note which Google account owns the project

---

## 📞 Need Help?

**Google Cloud Support**:
- Documentation: https://cloud.google.com/docs
- OAuth 2.0 Guide: https://developers.google.com/identity/protocols/oauth2

**PaperBox ERP Support**:
- Check: [ENV_SETUP_GUIDE.md](ENV_SETUP_GUIDE.md)
- Check: [QUICK_START_GOOGLE_OAUTH.md](QUICK_START_GOOGLE_OAUTH.md)

---

**Estimated Time**: 10-15 minutes
**Difficulty**: ⭐⭐ (Moderate - just follow steps)
**Status**: ✅ Ready to follow

---

**After you complete this, your Google OAuth will show "PaperBox ERP" branding instead of Supabase!**
