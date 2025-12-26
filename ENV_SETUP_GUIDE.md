# .env File Setup Guide - Visual Instructions

## ✅ Step 1: File Created

I've created a `.env` file for you by copying from `.env.example`.

**Location**: `c:\Users\ventu\BoxCostPro\BoxCostPro\.env`

---

## 📝 Step 2: Open the .env File

**Option 1 - Using VS Code:**
1. Open VS Code
2. Go to File → Open File
3. Navigate to: `c:\Users\ventu\BoxCostPro\BoxCostPro`
4. Select `.env` file
5. Click Open

**Option 2 - Using Notepad:**
1. Open Notepad
2. Go to File → Open
3. Change filter to "All Files (*.*)"
4. Navigate to: `c:\Users\ventu\BoxCostPro\BoxCostPro`
5. Select `.env` file
6. Click Open

**Option 3 - Command Line:**
```bash
cd c:\Users\ventu\BoxCostPro\BoxCostPro
notepad .env
```

---

## 🔑 Step 3: Find These Lines in .env

Look for these lines (should be around line 17-23):

```env
# Google OAuth for Authentication (Direct - NO Supabase branding)
# Get credentials from: https://console.cloud.google.com/apis/credentials
# Configure OAuth consent screen with PaperBox ERP branding
# Required scopes: userinfo.email, userinfo.profile, openid
GOOGLE_OAUTH_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=your-google-oauth-client-secret
GOOGLE_OAUTH_REDIRECT_URL=http://localhost:5000/auth/google/callback
```

---

## ✏️ Step 4: Replace Placeholder Values

### Current (Placeholders):
```env
GOOGLE_OAUTH_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=your-google-oauth-client-secret
```

### After (With Your Credentials):
```env
GOOGLE_OAUTH_CLIENT_ID=123456789012-abc123def456ghi789jkl012mno345pq.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-aBcDeFgHiJkLmNoPqRsTuVwXyZ
```

**Important**:
- ✅ Replace the ENTIRE value (including "your-google-oauth-client-id...")
- ✅ Paste your actual Client ID and Secret
- ❌ Don't add quotes
- ❌ Don't add spaces

---

## 🎯 Where to Get Your Credentials

### Option A: Google Cloud Console (Recommended)

1. **Go to**: https://console.cloud.google.com/apis/credentials

2. **Create Project** (if needed):
   - Click "Select Project" → "New Project"
   - Name: "PaperBox ERP"
   - Click "Create"

3. **Create OAuth Client**:
   - Click "+ CREATE CREDENTIALS"
   - Select "OAuth client ID"
   - Application type: "Web application"
   - Name: "PaperBox ERP Web"
   - Authorized redirect URIs:
     ```
     http://localhost:5000/auth/google/callback
     ```
   - Click "CREATE"

4. **Copy Credentials**:
   ```
   Client ID: 123456789012-abc...apps.googleusercontent.com
   Client Secret: GOCSPX-abc...xyz
   ```

5. **Paste in .env file**

### Option B: Use Existing Supabase Credentials (Quick Test)

If you already have Google OAuth in Supabase:

1. **Go to**: https://supabase.com/dashboard
2. Select your project
3. **Authentication** → **Providers** → **Google**
4. Copy the Client ID and Secret shown
5. Paste in .env file

---

## 📸 Visual Example

**Before (Placeholder):**
```env
GOOGLE_OAUTH_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
                       ↑ This needs to be replaced
```

**After (Real Credential):**
```env
GOOGLE_OAUTH_CLIENT_ID=123456789012-abc123def456.apps.googleusercontent.com
                       ↑ Actual Client ID from Google
```

---

## 🔍 Complete .env File Example

Here's what your complete `.env` file should look like:

```env
# Example environment variables for local development
# Supabase (optional) - required only if using Supabase auth
VITE_SUPABASE_URL=https://yourproject.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Server / DB
DATABASE_URL=postgres://user:password@localhost:5432/boxcostpro
SUPABASE_URL=https://yourproject.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Email Configuration
# Global system email (fallback when user hasn't configured personal email)
FROM_EMAIL=noreply@paperboxerp.com
FROM_NAME=PaperBox ERP

# ⭐ ADD YOUR GOOGLE OAUTH CREDENTIALS HERE ⭐
# Google OAuth for Authentication (Direct - NO Supabase branding)
# Get credentials from: https://console.cloud.google.com/apis/credentials
# Configure OAuth consent screen with PaperBox ERP branding
# Required scopes: userinfo.email, userinfo.profile, openid
GOOGLE_OAUTH_CLIENT_ID=123456789012-abc123def456ghi789jkl012mno345pq.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-aBcDeFgHiJkLmNoPqRsTuVwXyZ
GOOGLE_OAUTH_REDIRECT_URL=http://localhost:5000/auth/google/callback

# Google OAuth for User Email (Optional - separate from auth)
# Required scopes: gmail.send, userinfo.email
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_EMAIL_OAUTH_REDIRECT_URL=http://localhost:5000/api/email-settings/google/callback

# Other optional settings
NODE_ENV=development
PORT=3000
```

---

## ✅ Step 5: Save the File

**VS Code**: Press `Ctrl+S` or File → Save
**Notepad**: Press `Ctrl+S` or File → Save

---

## 🚀 Step 6: Restart Your Server

After saving `.env`:

1. **Open Terminal** (in VS Code or separate)

2. **Stop** running server (if any):
   - Press `Ctrl+C`
   - Wait for "Server stopped" or process to exit

3. **Start** server:
   ```bash
   npm run dev
   ```

4. **Look for confirmation**:
   ```
   [DirectGoogleOAuth] Initialized with redirect URL: http://localhost:5000/auth/google/callback
   ✅ Server running on http://localhost:5000
   ```

---

## 🧪 Step 7: Test It Works

1. **Open browser**: http://localhost:5000/auth

2. **Click** "Continue with Google" button

3. **Expected**: Redirected to Google OAuth consent screen

4. **If it works**:
   - ✅ You see Google login page
   - ✅ Can select your Google account
   - ✅ See permissions screen
   - ✅ Get redirected back after granting access

5. **If it doesn't work**:
   - Check console for errors
   - Verify `.env` values are correct
   - Make sure server restarted
   - See troubleshooting below

---

## 🐛 Troubleshooting

### Error: "Google OAuth is not configured"

**Check**:
1. `.env` file has the credentials
2. No typos in variable names
3. Server was restarted after editing
4. Client ID ends with `.apps.googleusercontent.com`
5. Client Secret starts with `GOCSPX-`

**Fix**:
```bash
# Stop server
Ctrl+C

# Check .env file
cat .env | grep GOOGLE_OAUTH

# Restart server
npm run dev
```

### Error: "redirect_uri_mismatch"

**Cause**: Google Console redirect URI doesn't match .env

**Fix**:
1. Go to Google Cloud Console → Credentials
2. Edit your OAuth Client
3. Add to "Authorized redirect URIs":
   ```
   http://localhost:5000/auth/google/callback
   ```
4. Save
5. Wait 1-2 minutes for Google to update
6. Try again

### Error: "invalid_client"

**Cause**: Client ID or Secret is wrong

**Fix**:
1. Go to Google Cloud Console → Credentials
2. Click on your OAuth Client
3. Copy Client ID and Secret again
4. Paste in `.env` (replace entire value)
5. Save
6. Restart server

### Server doesn't restart

**Fix**:
```bash
# Kill any running node processes
taskkill /F /IM node.exe

# Start server fresh
npm run dev
```

---

## 📋 Quick Checklist

Before testing, verify:

- [ ] `.env` file exists in project root
- [ ] Opened `.env` in text editor
- [ ] Found `GOOGLE_OAUTH_CLIENT_ID` line
- [ ] Replaced placeholder with actual Client ID
- [ ] Found `GOOGLE_OAUTH_CLIENT_SECRET` line
- [ ] Replaced placeholder with actual Secret
- [ ] Saved the file (Ctrl+S)
- [ ] Stopped server (Ctrl+C)
- [ ] Restarted server (`npm run dev`)
- [ ] No errors in console
- [ ] Tested at http://localhost:5000/auth

---

## 🎯 Summary

**What you need to do**:
1. Get Google OAuth credentials (from Google Cloud or Supabase)
2. Open `.env` file
3. Replace these two lines:
   ```env
   GOOGLE_OAUTH_CLIENT_ID=paste-your-client-id-here
   GOOGLE_OAUTH_CLIENT_SECRET=paste-your-secret-here
   ```
4. Save file
5. Restart server
6. Test login

**That's it!** Once done, Google OAuth will work with PaperBox ERP branding.

---

## 📞 Need Help?

1. **Can't find .env file**: Run `ls -la` in project root, look for `.env`
2. **Don't have credentials**: Follow [GOOGLE_OAUTH_SETUP.md](GOOGLE_OAUTH_SETUP.md)
3. **Server errors**: Check console logs for specific error messages
4. **Still stuck**: Check the detailed guide in [QUICK_START_GOOGLE_OAUTH.md](QUICK_START_GOOGLE_OAUTH.md)

---

**Status**: ✅ `.env` file created and ready to edit

**Next Step**: Add your Google OAuth credentials and restart server
