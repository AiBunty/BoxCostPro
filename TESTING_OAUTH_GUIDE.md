# Testing Google OAuth - Complete Guide

## ✅ Prerequisites

Before testing, ensure:
- [ ] Followed [GOOGLE_CLOUD_CONSOLE_WALKTHROUGH.md](GOOGLE_CLOUD_CONSOLE_WALKTHROUGH.md)
- [ ] Got OAuth credentials from Google Cloud
- [ ] Added credentials to `.env` file
- [ ] Saved `.env` file
- [ ] Server restarted

---

## 🚀 Testing Steps

### Step 1: Start the Server

```bash
# Navigate to project
cd c:\Users\ventu\BoxCostPro\BoxCostPro

# Start server
npm run dev
```

**Expected output**:
```
[DirectGoogleOAuth] Initialized with redirect URL: http://localhost:5000/auth/google/callback
✅ Server running on http://localhost:5000
```

**If you see this**: ✅ OAuth is configured correctly
**If you don't see this**: ❌ Check .env file has credentials

---

### Step 2: Open Login Page

1. **Open browser**: http://localhost:5000/auth

2. **You should see**:
   ```
   ┌─────────────────────────────────┐
   │  [Package Icon] PaperBox ERP    │
   │                                  │
   │  Welcome Back                    │
   │  Sign in to continue             │
   │                                  │
   │  [Continue with Google] 🔵       │
   │                                  │
   │  ────────── OR ──────────        │
   │                                  │
   │  [Password] [OTP] [Magic Link]   │
   │  ...                             │
   └─────────────────────────────────┘
   ```

---

### Step 3: Click "Continue with Google"

**What happens**:
1. Page redirects to `/api/auth/google/login`
2. Server generates authorization URL
3. Browser redirects to Google

**Expected**: You should see Google's login/consent screen within 1-2 seconds

**If stuck**: Check browser console for errors (F12 → Console tab)

---

### Step 4: Google OAuth Consent Screen

**What you'll see (Desktop)**:
```
┌─────────────────────────────────────────┐
│  [Google Logo]                          │
│                                          │
│  Choose an account                       │
│  to continue to PaperBox ERP             │
│                                          │
│  🔵 user@gmail.com                       │
│     User Name                            │
│                                          │
│  ➕ Use another account                  │
└─────────────────────────────────────────┘
```

**Select your Google account** (click on it)

**Then you'll see**:
```
┌─────────────────────────────────────────┐
│  [Google Logo]                          │
│                                          │
│  PaperBox ERP wants to access your      │
│  Google Account                          │
│                                          │
│  [PaperBox Logo] (if uploaded)          │
│  PaperBox ERP                            │
│                                          │
│  user@gmail.com                          │
│                                          │
│  This will allow PaperBox ERP to:       │
│  • See your email address               │
│  • See your personal info               │
│                                          │
│  ⚠️ Make sure you trust PaperBox ERP    │
│                                          │
│  By continuing, PaperBox ERP will       │
│  have this access until you change      │
│  permissions in your Google Account.    │
│                                          │
│  [Cancel]  [Continue]                   │
│                                          │
│  support@paperboxerp.com                │
│  Privacy policy • Terms of service      │
└─────────────────────────────────────────┘
```

**Important Checks**:
- ✅ Shows "PaperBox ERP" (NOT "Supabase Auth")
- ✅ Shows your uploaded logo (or default if not uploaded)
- ✅ Shows support@paperboxerp.com
- ✅ Permissions listed: email, personal info

---

### Step 5: Grant Permissions

**Click "Continue" button**

**What happens**:
1. Google redirects to: `http://localhost:5000/auth/google/callback?code=...&state=...`
2. Your backend:
   - Validates state (CSRF protection)
   - Exchanges code for access token
   - Gets user info from Google
   - Creates or logs in user
   - Redirects to `/auth?success=google_login`
3. Frontend:
   - Shows success toast
   - Redirects to dashboard

**Expected time**: 1-3 seconds

---

### Step 6: Success!

**You should see**:
1. **Toast notification**: "Welcome Back! Successfully signed in with Google"
2. **Redirect to dashboard**: http://localhost:5000/
3. **Logged in** as the Google account

**Verify**:
- [ ] Dashboard loaded
- [ ] User name displayed (top right)
- [ ] Can access protected pages
- [ ] Can log out

---

## 🎯 What to Verify

### ✅ OAuth Branding Checklist

When you see the consent screen, verify:

- [ ] **App name**: "PaperBox ERP" (NOT "Supabase Auth")
- [ ] **Logo**: Your uploaded logo OR none (not Supabase logo)
- [ ] **Support email**: support@paperboxerp.com
- [ ] **Privacy policy link**: paperboxerp.com/privacy
- [ ] **Terms link**: paperboxerp.com/terms
- [ ] **Requested permissions**: Only email and profile
- [ ] **No mention of "Supabase" anywhere**

### ✅ Flow Checklist

- [ ] Clicked "Continue with Google"
- [ ] Redirected to Google (not stuck)
- [ ] Saw consent screen with correct branding
- [ ] Clicked "Continue"
- [ ] Redirected back to app
- [ ] Saw success message
- [ ] Logged in successfully
- [ ] Can access dashboard

---

## 🐛 Troubleshooting

### Issue: "Google OAuth is not configured"

**Symptoms**:
- Console shows: `[DirectGoogleOAuth] Google OAuth credentials not configured`
- Error message in UI

**Solution**:
1. Check `.env` file has:
   ```env
   GOOGLE_OAUTH_CLIENT_ID=...apps.googleusercontent.com
   GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-...
   ```
2. Verify no typos
3. Restart server (Ctrl+C, then `npm run dev`)

---

### Issue: "redirect_uri_mismatch"

**Symptoms**:
- Google shows error: `Error 400: redirect_uri_mismatch`
- URL doesn't match

**Solution**:
1. Check `.env` has:
   ```env
   GOOGLE_OAUTH_REDIRECT_URL=http://localhost:5000/auth/google/callback
   ```
2. Check Google Console → Credentials → Your OAuth Client
3. Verify "Authorized redirect URIs" has:
   ```
   http://localhost:5000/auth/google/callback
   ```
4. Exact match required (no trailing slash, correct port)
5. Wait 1-2 minutes after saving in Console
6. Clear browser cache
7. Try again

---

### Issue: "Error 403: access_denied"

**Symptoms**:
- Can't proceed with OAuth
- "Access blocked" or "This app hasn't been verified"

**Solution (For Development)**:
1. Go to Google Cloud Console → OAuth consent screen
2. Scroll to "Test users"
3. Click "+ ADD USERS"
4. Add your email
5. Save
6. Try logging in again

**For "This app hasn't been verified" warning**:
1. This is normal for unverified apps
2. Click "Advanced"
3. Click "Go to PaperBox ERP (unsafe)" - it's safe, just not verified
4. Continue with login

---

### Issue: Still shows "Supabase" branding

**Symptoms**:
- OAuth screen shows "Supabase Auth"
- Not using new direct OAuth

**Solution**:
1. **Check frontend code** - Make sure auth.tsx uses:
   ```typescript
   window.location.href = '/api/auth/google/login';
   ```
   NOT:
   ```typescript
   await signInWithGoogle();  // Old Supabase method
   ```

2. **Clear browser cache**:
   - Chrome: Ctrl+Shift+Delete → Clear cache
   - Or use Incognito mode (Ctrl+Shift+N)

3. **Restart server**:
   ```bash
   Ctrl+C
   npm run dev
   ```

4. **Verify backend route** exists:
   ```bash
   # Check server logs for:
   [DirectGoogleOAuth] Initialized...
   ```

---

### Issue: Redirects but doesn't log in

**Symptoms**:
- Google OAuth completes
- Redirected to /auth
- But not logged in

**Solution**:
1. **Check browser console** (F12 → Console)
2. Look for errors
3. **Check server logs**
4. Verify user creation worked
5. Check session is created

**Debug steps**:
```bash
# In server console, you should see:
[Google OAuth] New user created: user@gmail.com
# OR
[Google OAuth] User logged in: user@gmail.com
```

If you don't see this:
1. Check database connection
2. Check Supabase credentials in .env
3. Verify `storage.getUserByEmail` works

---

### Issue: "Invalid state" error

**Symptoms**:
- Redirected to /auth?error=invalid_state

**Cause**: Session mismatch or CSRF attack attempt

**Solution**:
1. Clear browser cookies
2. Clear session storage (F12 → Application → Clear storage)
3. Try again in incognito mode
4. If persists, check server session configuration

---

## 📊 Test Scenarios

### Test Case 1: New User Signup

**Steps**:
1. Use Google account that hasn't signed up before
2. Click "Continue with Google"
3. Grant permissions
4. Should create new account
5. Redirect to dashboard

**Verify**:
- [ ] User created in database
- [ ] Email verified automatically
- [ ] Account status: email_verified
- [ ] Can access calculator
- [ ] Profile shows Google name and picture

---

### Test Case 2: Existing User Login

**Steps**:
1. Use Google account that already has an account
2. Click "Continue with Google"
3. Should log in directly (no signup)
4. Redirect to dashboard

**Verify**:
- [ ] No duplicate user created
- [ ] Logged in to existing account
- [ ] Can access existing data
- [ ] Profile unchanged

---

### Test Case 3: Deny Permissions

**Steps**:
1. Click "Continue with Google"
2. Click "Cancel" on consent screen

**Expected**:
- Redirected to /auth?error=google_denied
- Toast: "You denied Google access"
- Back on login page

---

### Test Case 4: Multiple Accounts

**Steps**:
1. Log in with Account A
2. Log out
3. Log in with Account B
4. Verify different users

**Expected**:
- Two separate accounts
- No data mixing
- Correct user logged in each time

---

## ✅ Success Criteria

OAuth is working correctly when:

1. ✅ Consent screen shows "PaperBox ERP" (not Supabase)
2. ✅ Your logo appears (or no logo, but not Supabase logo)
3. ✅ Support email is correct
4. ✅ Can sign up with new Google account
5. ✅ Can log in with existing Google account
6. ✅ Session persists (refresh page, still logged in)
7. ✅ Can log out
8. ✅ No console errors
9. ✅ No 400/403/500 server errors
10. ✅ Fast (< 3 seconds total flow)

---

## 🎥 Expected Flow Video

**Ideal flow** (should take ~5 seconds):

```
00:00 - User on /auth page
00:01 - Clicks "Continue with Google"
00:02 - Redirected to Google (instantly)
00:03 - Consent screen appears (PaperBox ERP)
00:04 - User clicks "Continue"
00:05 - Back on dashboard, logged in ✅
```

---

## 📞 Need Help?

If you're stuck:

1. **Check .env file**: Credentials added correctly?
2. **Check server logs**: What errors appear?
3. **Check browser console**: JavaScript errors?
4. **Try incognito mode**: Eliminates cache issues
5. **Restart everything**: Stop server, clear cache, restart

**Common mistake**: Forgetting to restart server after editing .env

**Quick fix checklist**:
- [ ] .env file saved
- [ ] Server restarted
- [ ] Browser cache cleared
- [ ] Using correct port (5000)
- [ ] Google Console redirect URIs match

---

## 🎉 Next Steps

After OAuth is working:

1. **Customize branding**:
   - Upload better logo (120x120px minimum)
   - Update app description
   - Add better privacy policy

2. **Test edge cases**:
   - Slow internet
   - Interrupted flow
   - Multiple tabs
   - Mobile devices

3. **Prepare for production**:
   - Add production URLs
   - Submit for verification (optional)
   - Monitor analytics

---

**Status**: ✅ Ready to test
**Estimated time**: 5-10 minutes for first test
**Difficulty**: ⭐ (Easy - just follow steps)

---

*Once testing succeeds, you'll have enterprise-grade OAuth with full PaperBox ERP branding!*
