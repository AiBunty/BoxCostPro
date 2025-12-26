# Quick Start: Add Google OAuth to .env File

## 📋 Step-by-Step Instructions

### Step 1: Locate Your .env File

1. Navigate to your project root directory:
   ```
   c:\Users\ventu\BoxCostPro\BoxCostPro\
   ```

2. Look for the `.env` file in the root folder
   - If it doesn't exist, create it by copying `.env.example`:
     ```bash
     copy .env.example .env
     ```

### Step 2: Get Google OAuth Credentials

**Option A: Quick Test (Use Existing Supabase Credentials)**

If you already have Google OAuth set up in Supabase:

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Authentication** → **Providers** → **Google**
4. Copy the **Client ID** and **Client Secret**

**Option B: Create New Credentials (Recommended)**

Follow the detailed guide in [GOOGLE_OAUTH_SETUP.md](GOOGLE_OAUTH_SETUP.md) to:
1. Create a Google Cloud project
2. Configure OAuth consent screen with PaperBox ERP branding
3. Get new credentials

### Step 3: Add to .env File

1. **Open** the `.env` file in your text editor (VS Code, Notepad++, etc.)

2. **Find or add** these lines:

```env
# Google OAuth for Authentication (Direct - NO Supabase branding)
GOOGLE_OAUTH_CLIENT_ID=your-client-id-here
GOOGLE_OAUTH_CLIENT_SECRET=your-client-secret-here
GOOGLE_OAUTH_REDIRECT_URL=http://localhost:5000/auth/google/callback
```

3. **Replace** the placeholder values:

   **Before:**
   ```env
   GOOGLE_OAUTH_CLIENT_ID=your-client-id-here
   GOOGLE_OAUTH_CLIENT_SECRET=your-client-secret-here
   ```

   **After (example):**
   ```env
   GOOGLE_OAUTH_CLIENT_ID=123456789-abc123xyz456.apps.googleusercontent.com
   GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-aBcDeFgHiJkLmNoPqRsTuVwXyZ
   ```

4. **Save** the file (Ctrl+S or File → Save)

### Step 4: Verify .env File Format

Your complete `.env` file should look like this:

```env
# Example environment variables for local development

# Supabase (optional) - required only if using Supabase auth
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxxxx

# Server / DB
DATABASE_URL=postgres://user:password@localhost:5432/boxcostpro
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxxxx
SUPABASE_ANON_KEY=xxxxx

# Email Configuration
FROM_EMAIL=noreply@paperboxerp.com
FROM_NAME=PaperBox ERP

# Google OAuth for Authentication (Direct - NO Supabase branding)
GOOGLE_OAUTH_CLIENT_ID=123456789-abc123xyz456.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-aBcDeFgHiJkLmNoPqRsTuVwXyZ
GOOGLE_OAUTH_REDIRECT_URL=http://localhost:5000/auth/google/callback

# Google OAuth for User Email (Optional - separate from auth)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_EMAIL_OAUTH_REDIRECT_URL=http://localhost:5000/api/email-settings/google/callback

# Other optional settings
NODE_ENV=development
PORT=3000
```

### Step 5: Important Notes

**DO**:
- ✅ Keep `.env` file in project root
- ✅ Use actual credentials (not placeholders)
- ✅ Save the file after editing
- ✅ Restart server after changes

**DON'T**:
- ❌ Add quotes around values
- ❌ Add spaces around `=` sign
- ❌ Commit `.env` to git
- ❌ Share credentials publicly

**Examples of Correct Format:**
```env
✅ CORRECT:
GOOGLE_OAUTH_CLIENT_ID=123456789-abc.apps.googleusercontent.com

❌ WRONG (quotes):
GOOGLE_OAUTH_CLIENT_ID="123456789-abc.apps.googleusercontent.com"

❌ WRONG (spaces):
GOOGLE_OAUTH_CLIENT_ID = 123456789-abc.apps.googleusercontent.com

❌ WRONG (no value):
GOOGLE_OAUTH_CLIENT_ID=
```

### Step 6: Restart Your Application

After adding credentials to `.env`:

1. **Stop** the running server (Ctrl+C in terminal)

2. **Restart** the application:
   ```bash
   npm run dev
   ```

3. **Verify** credentials are loaded:
   - Check console for: `[DirectGoogleOAuth] Initialized with redirect URL`
   - No errors about missing credentials

### Step 7: Test Google OAuth

1. Navigate to: `http://localhost:5000/auth`

2. Click **"Continue with Google"** button

3. **Expected Flow**:
   - Redirected to Google
   - See OAuth consent screen
   - Shows "PaperBox ERP" (if you configured Google Cloud)
   - OR shows your app name (if using Supabase credentials temporarily)

4. **Grant permissions** → **Redirected back** → **Logged in** ✅

---

## 🎯 Quick Copy-Paste Template

Copy this template and fill in your credentials:

```env
# Google OAuth for Authentication
GOOGLE_OAUTH_CLIENT_ID=PASTE_YOUR_CLIENT_ID_HERE
GOOGLE_OAUTH_CLIENT_SECRET=PASTE_YOUR_CLIENT_SECRET_HERE
GOOGLE_OAUTH_REDIRECT_URL=http://localhost:5000/auth/google/callback
```

**For Production** (when deploying):
```env
GOOGLE_OAUTH_REDIRECT_URL=https://paperboxerp.com/auth/google/callback
```

---

## 🔍 How to Find Your Credentials

### From Google Cloud Console:

1. Go to: https://console.cloud.google.com/
2. Select your project
3. Go to **APIs & Services** → **Credentials**
4. Click on your OAuth 2.0 Client ID
5. Copy **Client ID** and **Client Secret**

### From Supabase (Temporary):

1. Go to: https://supabase.com/dashboard
2. Select your project
3. **Authentication** → **Providers** → **Google**
4. Copy the credentials shown

---

## 🐛 Troubleshooting

### Issue: "Google OAuth is not configured"

**Cause**: Environment variables not loaded

**Solution**:
1. Check `.env` file exists in project root
2. Verify credentials are correct (no typos)
3. Restart server completely
4. Check for any `.env.local` or `.env.development` files overriding values

### Issue: "redirect_uri_mismatch"

**Cause**: Redirect URL doesn't match Google Console

**Solution**:
1. Check `.env` has: `http://localhost:5000/auth/google/callback`
2. Check Google Console has same URL in "Authorized redirect URIs"
3. Ensure exact match (including http/https, port, path)

### Issue: Changes not taking effect

**Cause**: Server not restarted

**Solution**:
1. Stop server (Ctrl+C)
2. Wait for complete shutdown
3. Restart: `npm run dev`
4. Wait for "Server running" message

---

## ✅ Verification Checklist

After adding credentials, verify:

- [ ] `.env` file exists in project root
- [ ] `GOOGLE_OAUTH_CLIENT_ID` is set (ends with `.apps.googleusercontent.com`)
- [ ] `GOOGLE_OAUTH_CLIENT_SECRET` is set (starts with `GOCSPX-`)
- [ ] `GOOGLE_OAUTH_REDIRECT_URL` is set correctly
- [ ] No quotes around values
- [ ] No spaces around `=` signs
- [ ] File is saved
- [ ] Server restarted
- [ ] No errors in console
- [ ] Google login button works

---

## 📞 Need Help?

If you're stuck:

1. **Check `.env` file location**: Must be in `c:\Users\ventu\BoxCostPro\BoxCostPro\.env`
2. **Check file contents**: Open in text editor and verify format
3. **Check server logs**: Look for errors about missing environment variables
4. **Try example credentials**: Test with Supabase credentials first

---

**Quick Visual Guide:**

```
Your Project Structure:
c:\Users\ventu\BoxCostPro\BoxCostPro\
├── .env                    ← ADD CREDENTIALS HERE
├── .env.example           ← Reference template
├── package.json
├── server/
│   └── auth/
│       └── directGoogleOAuth.ts
└── client/
    └── src/
        └── pages/
            └── auth.tsx
```

---

**Status**: ✅ Ready to use after completing steps above

**Next**: Test login at `http://localhost:5000/auth`
