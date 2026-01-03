# Remaining Security Tasks - Priority Order

## ✅ COMPLETED
- [x] Clerk secret key rotated
- [x] Development server tested with new key
- [x] `.gitignore` updated to prevent future accidents
- [x] Pre-commit hooks installed
- [x] `.env` files removed from git tracking

---

## 🚨 IMMEDIATE ACTION (Do This Now)

### 1. Email Clerk Support to Revoke Old Key

**Action**: Send email to support@clerk.com

**Template**: See `CLERK_SUPPORT_EMAIL.txt`

**Why**: The old compromised key still works and could be used by attackers

**Time Required**: 5 minutes

---

## ⚠️ HIGH PRIORITY (Do Within 24 Hours)

### 2. Rotate Google OAuth Credentials

**Exposed Credentials** (in `.env` lines 25-26):
- Client ID: `[REDACTED].apps.googleusercontent.com`
- Client Secret: `GOCSPX-[REDACTED]`

**Steps to Rotate**:

1. Go to https://console.cloud.google.com/apis/credentials
2. Login to your Google Cloud account
3. Select your project (or the project containing these credentials)
4. Find the OAuth 2.0 Client ID that matches the exposed Client ID
5. Click "Delete" to remove the old credentials
6. Click "Create Credentials" → "OAuth client ID"
7. Choose "Web application" as application type
8. Set name: "BoxCostPro OAuth (Rotated)"
9. Add authorized redirect URIs:
   - `http://localhost:5000/auth/google/callback`
   - Add your production URL if deployed
10. Click "Create"
11. Copy the new Client ID and Client Secret
12. Update your `.env` file:
   ```bash
   GOOGLE_OAUTH_CLIENT_ID=<new_client_id>
   GOOGLE_OAUTH_CLIENT_SECRET=<new_client_secret>
   ```
13. Restart your dev server: `npm run dev`
14. Test Google OAuth login flow

**Time Required**: 15 minutes

---

### 3. Rotate Database Password

**Exposed**: PostgreSQL connection string contains password (`.env` line 7)

**Database**: Neon PostgreSQL
- Host: `[YOUR_NEON_HOST].neon.tech`
- Database: `neondb`
- User: `neondb_owner`

**Steps to Rotate**:

1. Go to https://console.neon.tech
2. Login to your account
3. Select your "neondb" project
4. Go to "Settings" tab
5. Under "Database" section, find "Reset password" or "Change password"
6. Click "Reset Password"
7. Copy the new password
8. Click "Generate Connection String" (if available)
9. Copy the new full connection string
10. Update your `.env` file line 7:
    ```bash
    DATABASE_URL=postgresql://neondb_owner:<new_password>@[YOUR_NEON_HOST].neon.tech/neondb?sslmode=require
    ```
11. Restart your dev server: `npm run dev`
12. Test database connectivity:
    ```bash
    npm run db:push
    ```

**Time Required**: 10 minutes

---

## 📋 MEDIUM PRIORITY (Do This Week)

### 4. Rotate Encryption Key

**Current Key** (`.env` line 13):
- `ENCRYPTION_KEY=[64_CHARACTER_HEX_STRING]`

**Problem**: This key is used to encrypt user email credentials (SMTP passwords). If you rotate it, existing encrypted data becomes unreadable.

**Options**:

**Option A: Keep Current Key (Easiest)**
- Accept that this key was exposed
- Keep using it to avoid breaking existing encrypted data
- Only rotate if you suspect active exploitation

**Option B: Rotate + Re-encrypt Data (Complex)**
1. Generate new encryption key:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. Create migration script to:
   - Read all encrypted SMTP passwords with old key
   - Decrypt with old key
   - Re-encrypt with new key
   - Save back to database
3. Update `.env` with new key
4. Run migration script
5. Restart server and test

**Recommendation**: **Option A** for now (keep current key) unless you have evidence of active exploitation.

**Time Required**:
- Option A: 0 minutes
- Option B: 2-4 hours (requires custom migration script)

---

### 5. Rotate Session Secret

**Current Key** (`.env` line 14):
- `SESSION_SECRET=secure-random-session-secret-key-change-in-production`

**Impact**: Rotating this will invalidate all existing user sessions (force everyone to re-login)

**Steps**:

1. Generate new secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. Update `.env` line 14:
   ```bash
   SESSION_SECRET=<new_generated_secret>
   ```
3. Restart server: `npm run dev`
4. All users will need to re-login

**Time Required**: 5 minutes

---

## 🔄 OPTIONAL (If Deployed to Production)

### 6. Update Production Environment Variables

**If deployed on Replit**:
1. Go to your Replit project
2. Click "Secrets" tab (lock icon)
3. Update each secret with new values:
   - `CLERK_SECRET_KEY` → new value
   - `GOOGLE_OAUTH_CLIENT_ID` → new value
   - `GOOGLE_OAUTH_CLIENT_SECRET` → new value
   - `DATABASE_URL` → new value
   - `SESSION_SECRET` → new value (optional)
4. Restart your Repl

**If deployed on Vercel**:
```bash
vercel env rm CLERK_SECRET_KEY production
vercel env add CLERK_SECRET_KEY production
# Enter new value

vercel env rm GOOGLE_OAUTH_CLIENT_ID production
vercel env add GOOGLE_OAUTH_CLIENT_ID production
# Enter new value

# Repeat for all rotated credentials
vercel --prod
```

**If deployed on Railway**:
1. Open Railway dashboard
2. Select your project
3. Click "Variables" tab
4. Update each variable with new values
5. Railway will auto-redeploy

---

## 🔍 MONITORING

### Check for Suspicious Activity

**Clerk Dashboard**:
- Go to https://dashboard.clerk.com
- Check "Users" tab for unknown accounts created recently
- Check "Sessions" for unusual login locations
- Check "Events" for suspicious activity patterns

**Database**:
```sql
-- Check for unauthorized users
SELECT * FROM users WHERE created_at > NOW() - INTERVAL '7 days' ORDER BY created_at DESC;

-- Check for unusual profile modifications
SELECT * FROM business_profiles WHERE updated_at > NOW() - INTERVAL '7 days' ORDER BY updated_at DESC;
```

**Google OAuth**:
- Go to https://console.cloud.google.com/apis/credentials
- Check "OAuth consent screen" → "Test users" for unauthorized additions

---

## 📊 Summary Checklist

- [ ] Email Clerk support to revoke old key (IMMEDIATE)
- [ ] Rotate Google OAuth credentials (24 hours)
- [ ] Rotate database password (24 hours)
- [ ] Decide on encryption key rotation (this week)
- [ ] Rotate session secret (optional, this week)
- [ ] Update production environment if deployed
- [ ] Monitor Clerk dashboard for suspicious activity
- [ ] Monitor database for unauthorized changes
- [ ] Set calendar reminder to rotate credentials every 90 days

---

## 🆘 Need Help?

If you need assistance with any of these steps:
1. Refer to `SECURITY_BEST_PRACTICES.md`
2. Check service-specific documentation
3. Contact support for each service
4. Ask for help in this session

---

## ⏱️ Total Time Estimate

- Immediate tasks: 5 minutes
- High priority tasks: 25 minutes
- Medium priority tasks: 5 minutes (or 2-4 hours for full encryption rotation)
- **Total**: ~35 minutes for critical security hardening

---

**Remember**: It's better to spend 30 minutes securing your application now than dealing with a data breach later!
