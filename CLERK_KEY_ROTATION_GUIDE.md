# Clerk Secret Key Rotation - Step by Step

## 🚨 EXPOSED KEY DETECTED
Your Clerk secret key was found in Git history and has been compromised.

**The key has been redacted from this document for security purposes.**

This key MUST be rotated immediately.

---

## ✅ Step-by-Step Rotation Process

### Step 1: Login to Clerk Dashboard

1. Open your browser and go to: **https://dashboard.clerk.com**
2. Login with your account credentials
3. You should see your application(s) listed

### Step 2: Select Your Application

1. Click on your **"BoxCostPro"** application (or whatever name you gave it)
2. You'll be taken to the application dashboard

### Step 3: Navigate to API Keys

1. Look at the left sidebar
2. Click on **"API Keys"** (it has a key icon 🔑)
3. You'll see two sections:
   - **Secret keys** (these are sensitive)
   - **Publishable keys** (these are public)

### Step 4: Create New Secret Key

In the **Secret keys** section:

1. You should see a button that says **"+ Create secret key"** or **"Generate secret key"**
2. Click that button
3. A dialog may appear asking for a name (optional)
   - You can name it: "Production Key 2024" or leave default
4. Click **"Create"** or **"Generate"**
5. **IMMEDIATELY COPY THE NEW KEY** - it will look like:
   ```
   sk_test_XXXXXXXXXXXXXXXXXXXXXXXXXXXXX
   ```
6. ⚠️ **IMPORTANT**: Clerk may only show this key once! Save it somewhere safe temporarily.

### Step 5: Update Your Local .env File

1. Open your `.env` file in the BoxCostPro root directory
2. Find the line that says:
   ```bash
   CLERK_SECRET_KEY=sk_test_[YOUR_OLD_COMPROMISED_KEY]
   ```
3. Replace it with your NEW key:
   ```bash
   CLERK_SECRET_KEY=sk_test_[YOUR_NEW_KEY_HERE]
   ```
4. Save the file

### Step 6: Restart Your Development Server

1. Stop your current server (press `Ctrl+C` in the terminal)
2. Start it again:
   ```bash
   npm run dev
   ```
3. Watch the console output for any errors

### Step 7: Test Authentication

1. Open your browser to: **http://localhost:5000**
2. Try to **login** with your account
3. Try to **create a new account** (if possible)
4. Check if you can access protected pages

If everything works ✅ → Your new key is working!

### Step 8: Contact Clerk Support to Revoke Old Key

Since the old key was exposed publicly, you should request its immediate revocation:

**Option A: Email Support**
- To: support@clerk.com
- Subject: "URGENT: Revoke Compromised Secret Key"
- Body:
  ```
  Hello Clerk Support Team,

  My Clerk secret key was accidentally committed to a public GitHub repository.

  Application Name: BoxCostPro
  Compromised Secret Key: [INSERT YOUR OLD KEY HERE]

  I have already generated a new secret key and updated my application.
  The new key is working correctly.

  Please revoke/delete the compromised key immediately to prevent unauthorized access.

  Thank you for your urgent assistance.

  Best regards,
  [Your Name]
  ```

**Option B: Use Dashboard Support Chat**
1. Look for a chat bubble icon in the bottom-right corner of the Clerk dashboard
2. Click it to open support chat
3. Send message:
   ```
   URGENT: I need to revoke a compromised secret key that was exposed in a public GitHub repo.

   Compromised key: [INSERT YOUR OLD KEY HERE]

   I've already generated and tested a new key. Please delete the old one immediately.
   ```

### Step 9: Update Production Environment (If Deployed)

If you have already deployed your app to production, you need to update the secret key there too:

**For Replit:**
1. Go to your Replit project
2. Click the **"Secrets"** tab (lock icon)
3. Find `CLERK_SECRET_KEY`
4. Click **Edit** and paste your new key
5. Restart your Repl

**For Vercel:**
```bash
vercel env rm CLERK_SECRET_KEY production
vercel env add CLERK_SECRET_KEY production
# Paste new key when prompted
vercel --prod
```

**For Railway:**
1. Go to Railway dashboard
2. Open your project
3. Click **"Variables"** tab
4. Update `CLERK_SECRET_KEY` with new value
5. Railway will auto-redeploy

---

## 🔍 Verification Checklist

After rotation, verify these work:

- [ ] Server starts without errors
- [ ] Can login with existing account
- [ ] Can create new user account
- [ ] Can access protected pages (Dashboard, Account, etc.)
- [ ] No authentication errors in console
- [ ] Contacted Clerk support to revoke old key

---

## 📝 What About the Publishable Key?

**Good news:** Publishable keys are **designed to be public**. They're safe to be in:
- Client-side code
- Public GitHub repos
- Browser JavaScript

**You don't need to rotate the publishable key** unless:
- Clerk support recommends it
- You want to for extra security (optional)

If you do want to rotate it, you would need to contact Clerk support as publishable keys can't be generated from the dashboard in the same way.

---

## 🆘 Troubleshooting

### Error: "Invalid API key"
- Double-check you copied the entire key (they're quite long)
- Make sure there are no extra spaces before/after the key in .env
- Verify the key starts with `sk_test_` or `sk_live_`

### Error: "CLERK_SECRET_KEY is not configured"
- Make sure your `.env` file is in the root directory
- Restart your server after editing .env
- Check there are no typos in the variable name

### Authentication Still Not Working
1. Clear your browser cookies
2. Try incognito/private browsing mode
3. Check browser console for errors (F12)
4. Check server logs for detailed error messages

---

## ⏱️ Time Required

- **Generating new key**: 2 minutes
- **Updating .env and testing**: 5 minutes
- **Contacting support**: 5 minutes
- **Total**: ~15 minutes

---

## ✅ Success Indicators

You'll know the rotation was successful when:
1. Server starts without errors ✅
2. Login works ✅
3. No "Invalid API key" errors ✅
4. Clerk support confirms old key is revoked ✅

---

## 🔐 After Completion

Once you've completed these steps:
1. Delete this guide (it contains the old compromised key)
2. Never commit .env files to git again
3. Use the git hook we installed to prevent future accidents
4. Consider enabling 2FA on your Clerk account for extra security

---

**Need help?** If you encounter any issues, ask for assistance!
