# Replit Deployment Guide - PaperBox ERP

## 🎯 Overview

Your setup:
- **Code Repository**: GitHub → Replit (auto-sync)
- **Database**: Replit PostgreSQL (managed by Replit)
- **Hosting**: Replit
- **Domain**: paperboxerp.com (or Replit subdomain)

---

## 📋 Step-by-Step Deployment Process

### Step 1: Sync Code from GitHub to Replit

#### Option A: Automatic Sync (If configured)

1. **Push to GitHub** (Already done):
   ```bash
   # On your local machine
   git add -A
   git commit -m "Your changes"
   git push origin main
   ```

2. **Replit Auto-Pulls**:
   - If you have GitHub integration enabled, Replit will auto-pull
   - Wait 30-60 seconds for sync

3. **Verify in Replit**:
   - Open your Repl
   - Check if new files appear in file tree
   - Look for: `ONBOARDING_FIX_PLAN.md`, `fix-incomplete-profiles.sql`, etc.

#### Option B: Manual Sync

If auto-sync isn't working:

1. **Open Replit Shell** (bottom panel, Shell tab)

2. **Pull from GitHub**:
   ```bash
   git pull origin main
   ```

3. **If there are conflicts**:
   ```bash
   # Stash local changes
   git stash

   # Pull from GitHub
   git pull origin main

   # Apply your changes back (if needed)
   git stash pop
   ```

---

### Step 2: Run Database Migration (CRITICAL)

This fixes existing users stuck at settings page.

#### Open Replit Database Console

**Method 1: Using Replit Shell**

1. **Click "Shell" tab** (bottom panel in Replit)

2. **Connect to database**:
   ```bash
   psql $DATABASE_URL
   ```

3. **You should see**:
   ```
   psql (15.x)
   Type "help" for help.

   database=>
   ```

**Method 2: Using Replit Database Tool**

1. **Click "Tools"** (left sidebar)
2. **Click "Database"**
3. **Click "Query"** tab

#### Run the Migration SQL

**Copy and paste this complete script**:

```sql
-- ============================================
-- Fix Incomplete Company Profiles Migration
-- Run this ONCE to fix existing broken users
-- ============================================

-- Step 1: Show current status (before fix)
SELECT
  'BEFORE FIX' as status,
  COUNT(*) as total_profiles,
  COUNT(CASE WHEN email IS NULL OR email = '' THEN 1 END) as missing_email,
  COUNT(CASE WHEN phone IS NULL OR phone = '' THEN 1 END) as missing_phone
FROM company_profiles;

-- Step 2: Fix incomplete profiles
UPDATE company_profiles cp
SET
  email = COALESCE(cp.email, u.email),
  phone = COALESCE(cp.phone, u.mobile_no),
  owner_name = COALESCE(cp.owner_name, u.full_name),
  updated_at = NOW()
FROM users u
WHERE cp.user_id = u.id
  AND (cp.email IS NULL OR cp.email = '' OR cp.phone IS NULL OR cp.phone = '');

-- Step 3: Verify the fix (after)
SELECT
  'AFTER FIX' as status,
  COUNT(*) as total_profiles,
  COUNT(CASE WHEN email IS NULL OR email = '' THEN 1 END) as missing_email,
  COUNT(CASE WHEN phone IS NULL OR phone = '' THEN 1 END) as missing_phone
FROM company_profiles;

-- Step 4: Show fixed profiles
SELECT
  cp.id,
  cp.company_name,
  cp.email,
  cp.phone,
  cp.owner_name,
  cp.is_default,
  cp.updated_at
FROM company_profiles cp
WHERE cp.updated_at > NOW() - INTERVAL '1 minute'
ORDER BY cp.updated_at DESC;

-- Step 5: Final verification - should return 0 rows
SELECT
  cp.id,
  cp.company_name,
  u.email as user_email,
  cp.email as company_email
FROM company_profiles cp
JOIN users u ON cp.user_id = u.id
WHERE cp.is_default = true
  AND (cp.email IS NULL OR cp.email = '');
```

#### Expected Output:

```
 status      | total_profiles | missing_email | missing_phone
-------------+----------------+---------------+--------------
 BEFORE FIX  |              5 |             3 |            2

UPDATE 3

 status      | total_profiles | missing_email | missing_phone
-------------+----------------+---------------+--------------
 AFTER FIX   |              5 |             0 |            0

 id | company_name | email              | phone        | ...
----+--------------+--------------------+--------------+----
 1  | My Business  | user@gmail.com     | +919876543210| ...
 2  | ABC Corp     | abc@company.com    | +919123456789| ...
 3  | XYZ Ltd      | xyz@example.com    |              | ...

(0 rows)  ← This means all profiles are fixed!
```

#### Exit Database Console:

```bash
\q
```

Or press `Ctrl+D`

---

### Step 3: Restart Replit Application

**Critical**: After code sync, you MUST restart the app.

#### Option A: Using Replit UI

1. **Click "Stop" button** (top bar)
2. **Wait** for it to fully stop (5-10 seconds)
3. **Click "Run" button**

#### Option B: Using Shell

```bash
# Kill the running process
pkill -f node

# Start the app
npm run dev
```

#### Verify Restart:

Look for these logs in Console:
```
[DirectGoogleOAuth] Initialized with redirect URL: ...
[TenantContext] Created default company profile with email: ...
✅ Server running on http://...
```

---

### Step 4: Update Replit Environment Variables

**If you added new environment variables** (like Google OAuth credentials):

1. **Click "Secrets" tool** (🔒 lock icon in left sidebar)

2. **Add/Update these secrets**:

   ```
   Key: GOOGLE_OAUTH_CLIENT_ID
   Value: your-client-id.apps.googleusercontent.com

   Key: GOOGLE_OAUTH_CLIENT_SECRET
   Value: GOCSPX-your-secret

   Key: GOOGLE_OAUTH_REDIRECT_URL
   Value: https://your-repl-name.your-username.repl.co/auth/google/callback
   ```

3. **Click "Add Secret"** for each

4. **Restart app** (Stop → Run)

**Note**: Replit Secrets are automatically loaded as environment variables.

---

### Step 5: Update Google OAuth Redirect URI

**IMPORTANT**: Change from localhost to Replit URL

1. **Go to**: https://console.cloud.google.com/apis/credentials

2. **Click** your OAuth Client ID

3. **Add Replit production URI**:
   - Click "+ Add URI" under "Authorized redirect URIs"
   - Add: `https://your-repl-name.your-username.repl.co/auth/google/callback`
   - Replace `your-repl-name` and `your-username` with actual values

4. **Click "Save"**

5. **Update Replit Secret**:
   - Go to Replit → Secrets
   - Update `GOOGLE_OAUTH_REDIRECT_URL` to production URL
   - Restart app

---

### Step 6: Test the Deployment

#### Test 1: Website Loads

1. **Open your Replit URL**: `https://your-repl-name.your-username.repl.co`
2. Should see login page
3. No errors in browser console (F12 → Console)

#### Test 2: New User Signup

1. **Click "Continue with Google"**
2. Should redirect to Google
3. **Verify**: OAuth consent shows "PaperBox ERP" (not Supabase)
4. Grant permissions
5. Should redirect back to your app
6. **Expected flow**:
   - Complete Profile page
   - Settings page (email pre-filled) ✅
   - Can proceed to Masters
   - NO infinite redirect loop ✅

#### Test 3: Existing User Login

1. Login with existing user
2. Should NOT be stuck at settings
3. Should reach dashboard

#### Test 4: Database Check

Open Replit Shell:
```bash
psql $DATABASE_URL
```

Run:
```sql
-- Verify all profiles have email
SELECT COUNT(*) FROM company_profiles WHERE email IS NULL;
-- Expected: 0

-- Check sample profiles
SELECT company_name, email, phone FROM company_profiles LIMIT 5;
-- All should have email populated
```

---

## 🐛 Common Replit Issues & Fixes

### Issue 1: "Cannot connect to database"

**Symptoms**: App crashes with database connection error

**Fix**:
```bash
# In Replit Shell
echo $DATABASE_URL
```

If empty or incorrect:
1. Click "Database" tool (left sidebar)
2. Verify PostgreSQL database exists
3. Copy connection string
4. Add to Secrets as `DATABASE_URL`

### Issue 2: "Port already in use"

**Symptoms**: App won't start, says port 5000 in use

**Fix**:
```bash
# Kill all node processes
pkill -f node

# Wait 5 seconds
sleep 5

# Restart
npm run dev
```

### Issue 3: Git conflicts when pulling

**Symptoms**: `git pull` fails with merge conflicts

**Fix**:
```bash
# See what files have conflicts
git status

# Option A: Keep GitHub version (discard local changes)
git fetch origin main
git reset --hard origin/main

# Option B: Keep local changes
git stash
git pull origin main
git stash pop
```

### Issue 4: Environment variables not loading

**Symptoms**: App starts but features don't work (OAuth, email, etc.)

**Fix**:
1. Check Secrets are added correctly (🔒 Secrets tool)
2. Verify key names match exactly (case-sensitive)
3. Restart app (Stop → Run)
4. Check logs for "undefined" errors

### Issue 5: Database migration didn't apply

**Symptoms**: Users still stuck at settings

**Fix**:
```bash
# Connect to database
psql $DATABASE_URL

# Check if migration ran
SELECT * FROM company_profiles WHERE email IS NULL LIMIT 1;

# If rows returned, run migration again
\i fix-incomplete-profiles.sql

# Or paste the SQL directly (from Step 2 above)
```

### Issue 6: OAuth redirect URI mismatch

**Symptoms**: Google OAuth fails with "redirect_uri_mismatch"

**Fix**:
1. Check Replit URL exactly (case-sensitive)
2. Go to Google Console → Credentials
3. Verify redirect URI matches:
   ```
   https://exact-repl-url.repl.co/auth/google/callback
   ```
4. No trailing slash
5. Wait 1-2 minutes after saving
6. Clear browser cache
7. Try again

---

## 📊 Monitoring on Replit

### Check Application Logs

1. **Click "Console" tab** (bottom panel)
2. **Look for**:
   ```
   ✅ [DirectGoogleOAuth] Initialized
   ✅ [TenantContext] Created default company profile
   ✅ Server running on port 5000
   ```

3. **Watch for errors**:
   ```
   ❌ Error: Cannot connect to database
   ❌ GOOGLE_OAUTH_CLIENT_ID is undefined
   ❌ Failed to create company profile
   ```

### Check Database Health

```bash
# In Replit Shell
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM company_profiles;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM tenants;"
```

**Expected**: Numbers should match (1 tenant, 1 company profile per user)

### Check User Activity

```sql
-- Recent signups (last 24 hours)
SELECT email, full_name, created_at
FROM users
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- Recent logins
SELECT user_id, action, status, created_at
FROM auth_audit_logs
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 20;
```

---

## 🚀 Complete Deployment Checklist

### Pre-Deployment:
- [ ] All code pushed to GitHub
- [ ] GitHub synced to Replit
- [ ] Environment variables added to Replit Secrets
- [ ] Google OAuth redirect URI updated for production

### Database Migration:
- [ ] Opened Replit database console
- [ ] Ran `fix-incomplete-profiles.sql`
- [ ] Verified 0 rows with missing email
- [ ] Exited database console

### Application Restart:
- [ ] Stopped Replit app
- [ ] Started Replit app
- [ ] Verified logs show no errors
- [ ] Checked OAuth initialization log

### Testing:
- [ ] Website loads at Replit URL
- [ ] New user signup works
- [ ] Google OAuth shows PaperBox ERP branding
- [ ] No infinite redirect loops
- [ ] Existing users can login
- [ ] Dashboard accessible
- [ ] Calculator works

### Final Verification:
- [ ] No console errors
- [ ] Database queries work
- [ ] All features functional
- [ ] Mobile responsive

---

## 🎯 Quick Commands Reference

### Code Management:
```bash
# Sync from GitHub
git pull origin main

# Check current status
git status

# Discard local changes
git reset --hard origin/main
```

### Database:
```bash
# Connect
psql $DATABASE_URL

# Run migration file
\i fix-incomplete-profiles.sql

# Quick query
psql $DATABASE_URL -c "SELECT COUNT(*) FROM company_profiles WHERE email IS NULL;"

# Exit
\q
```

### Application:
```bash
# Restart
pkill -f node && npm run dev

# Check environment
env | grep GOOGLE_OAUTH

# View logs
tail -f /tmp/repl_logs.txt
```

---

## 📞 Support Checklist

If deployment fails:

1. **Check Replit Console** for error messages
2. **Verify Secrets** are added correctly
3. **Test database connection**: `psql $DATABASE_URL`
4. **Check GitHub sync** worked (new files visible)
5. **Verify app restarted** after changes

---

## ✅ Success Criteria

Deployment is successful when:

1. ✅ Replit app runs without errors
2. ✅ Database migration completed (0 missing emails)
3. ✅ Google OAuth works with PaperBox branding
4. ✅ New users can sign up and complete onboarding
5. ✅ Existing users can login (not stuck at settings)
6. ✅ All pages load correctly
7. ✅ Calculator accessible after onboarding

---

## 🔄 Regular Maintenance

### Weekly:
```bash
# Check for stuck users
psql $DATABASE_URL -c "SELECT COUNT(*) FROM company_profiles WHERE email IS NULL;"

# Check recent errors
psql $DATABASE_URL -c "SELECT * FROM auth_audit_logs WHERE status = 'failed' AND created_at > NOW() - INTERVAL '7 days' LIMIT 10;"
```

### After Each Code Push:
1. Pull from GitHub
2. Restart Replit app
3. Test critical flows
4. Monitor logs for 5 minutes

---

**Status**: ✅ READY TO DEPLOY TO REPLIT
**Estimated Time**: 10-15 minutes
**Risk Level**: LOW (migration only adds data, doesn't delete)

---

*Follow the steps above in order. Start with Step 1 (sync code) and proceed through Step 6 (testing).*
