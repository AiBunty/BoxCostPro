# How to Run SQL Migration in Replit - Step by Step

## 🎯 Goal
Copy the SQL from `fix-incomplete-profiles.sql` file and paste it into Replit's database console to fix broken user profiles.

---

## 📋 Step-by-Step Instructions

### Step 1: Open the SQL File Locally

**On your computer** (where you have the code):

1. Navigate to your project folder:
   ```
   c:\Users\ventu\BoxCostPro\BoxCostPro
   ```

2. Open the file: `fix-incomplete-profiles.sql`

3. **Select ALL the text** (Ctrl+A)

4. **Copy it** (Ctrl+C)

**The SQL you need to copy**:
```sql
-- Fix Incomplete Company Profiles - Emergency Migration
-- Run this to fix users stuck at settings page

-- Problem: company_profiles created with only companyName, missing email/phone
-- Solution: Populate email/phone from users table

-- Step 1: Update existing company profiles with missing email/phone
UPDATE company_profiles cp
SET
  email = COALESCE(cp.email, u.email),
  phone = COALESCE(cp.phone, u.mobile_no),
  owner_name = COALESCE(cp.owner_name, u.full_name),
  updated_at = NOW()
FROM users u
WHERE cp.user_id = u.id
  AND (cp.email IS NULL OR cp.email = '' OR cp.phone IS NULL OR cp.phone = '');

-- Step 2: Verify the fix
SELECT
  cp.id,
  cp.company_name,
  cp.email,
  cp.phone,
  cp.owner_name,
  u.email AS user_email,
  u.mobile_no AS user_phone,
  u.full_name AS user_name
FROM company_profiles cp
JOIN users u ON cp.user_id = u.id
WHERE cp.is_default = true
ORDER BY cp.created_at DESC;

-- Step 3: Check for any profiles still missing email
SELECT
  cp.id,
  cp.company_name,
  cp.email,
  cp.phone,
  u.email AS user_email
FROM company_profiles cp
JOIN users u ON cp.user_id = u.id
WHERE cp.is_default = true
  AND (cp.email IS NULL OR cp.email = '');

-- Expected result: No rows (all profiles should have email now)
```

---

### Step 2: Open Replit

1. Go to: **https://replit.com**

2. **Login** to your account

3. **Open your Repl** (your PaperBox ERP project)

4. You should see your code files on the left sidebar

---

### Step 3: Open Replit Shell

1. Look at the **bottom panel** of Replit

2. You'll see tabs like: `Console`, `Shell`, `Logs`

3. **Click the "Shell" tab**

4. You'll see a terminal prompt like:
   ```
   ~/BoxCostPro $
   ```

**Visual Reference**:
```
┌─────────────────────────────────────────────┐
│  Replit Top Bar (Run, Stop buttons)        │
├─────────────────────────────────────────────┤
│                                             │
│  Code Editor (Your files)                  │
│                                             │
├─────────────────────────────────────────────┤
│  [Console] [Shell] [Logs] ← Click Shell   │
│                                             │
│  ~/BoxCostPro $ ← Terminal prompt here     │
│                                             │
└─────────────────────────────────────────────┘
```

---

### Step 4: Connect to Database

**In the Shell tab**, type this command and press Enter:

```bash
psql $DATABASE_URL
```

**What happens**:
- It connects to your Replit PostgreSQL database
- The prompt changes to:
  ```
  database=>
  ```

**Visual**:
```
~/BoxCostPro $ psql $DATABASE_URL

psql (15.3)
Type "help" for help.

database=>  ← You should see this prompt
```

**If you see this**, you're connected! ✅

**If you see an error**:
- Error: "DATABASE_URL not set" → Go to Replit → Database tool → Copy connection string
- Error: "connection refused" → Check if database is running in Replit

---

### Step 5: Paste the SQL

**Now you're in the database console** (you see `database=>` prompt)

1. **Right-click** in the Shell area

2. Click **"Paste"** (or press Ctrl+Shift+V in Replit)

3. The SQL will appear in the console

4. **Press Enter** to execute

**Visual Example**:
```
database=> UPDATE company_profiles cp
SET
  email = COALESCE(cp.email, u.email),
  phone = COALESCE(cp.phone, u.mobile_no),
  owner_name = COALESCE(cp.owner_name, u.full_name),
  updated_at = NOW()
FROM users u
WHERE cp.user_id = u.id
  AND (cp.email IS NULL OR cp.email = '' OR cp.phone IS NULL OR cp.phone = '');

UPDATE 3  ← This shows 3 rows were updated
```

---

### Step 6: See the Results

After pasting and pressing Enter, you'll see output like:

```
-- First query runs (the UPDATE)
UPDATE 3

-- Then the verification queries run
 id | company_name | email              | phone        | ...
----+--------------+--------------------+--------------+-----
  1 | My Business  | user@gmail.com     | +919876543210| ...
  2 | ABC Corp     | abc@company.com    | +919123456789| ...
  3 | XYZ Ltd      | xyz@example.com    |              | ...

-- Finally, check for remaining broken profiles
(0 rows)  ← This means SUCCESS! No broken profiles remain
```

**What to look for**:
- ✅ `UPDATE X` - Shows how many rows were fixed (X = number of broken profiles)
- ✅ `(0 rows)` at the end - Means all profiles are now fixed

---

### Step 7: Exit Database Console

**After the SQL runs successfully**, exit the database:

**Type**:
```bash
\q
```

**Press Enter**

**OR** press: `Ctrl+D`

**You'll return to the normal Shell prompt**:
```
database=> \q
~/BoxCostPro $ ← Back to normal shell
```

---

## 🎯 Complete Example Session

Here's what your complete session should look like:

```bash
# Step 1: You're in Replit Shell
~/BoxCostPro $

# Step 2: Connect to database
~/BoxCostPro $ psql $DATABASE_URL
psql (15.3)
Type "help" for help.

database=>

# Step 3: Paste the SQL (Right-click → Paste)
database=> UPDATE company_profiles cp
SET
  email = COALESCE(cp.email, u.email),
  phone = COALESCE(cp.phone, u.mobile_no),
  owner_name = COALESCE(cp.owner_name, u.full_name),
  updated_at = NOW()
FROM users u
WHERE cp.user_id = u.id
  AND (cp.email IS NULL OR cp.email = '' OR cp.phone IS NULL OR cp.phone = '');

UPDATE 3

# Step 4: See verification results
database=> SELECT ... (the verification queries run automatically)

 id | company_name | email           | phone
----+--------------+-----------------+---------------
  1 | My Business  | user@gmail.com  | +919876543210
  2 | ABC Corp     | abc@company.com | +919123456789

(0 rows)  ← No broken profiles!

# Step 5: Exit
database=> \q
~/BoxCostPro $
```

---

## ⚡ Quick Copy-Paste Version

**If you just want the SQL to copy**, here it is in a single block:

```sql
UPDATE company_profiles cp SET email = COALESCE(cp.email, u.email), phone = COALESCE(cp.phone, u.mobile_no), owner_name = COALESCE(cp.owner_name, u.full_name), updated_at = NOW() FROM users u WHERE cp.user_id = u.id AND (cp.email IS NULL OR cp.email = '' OR cp.phone IS NULL OR cp.phone = ''); SELECT cp.id, cp.company_name, cp.email, cp.phone, cp.owner_name, u.email AS user_email, u.mobile_no AS user_phone, u.full_name AS user_name FROM company_profiles cp JOIN users u ON cp.user_id = u.id WHERE cp.is_default = true ORDER BY cp.created_at DESC; SELECT cp.id, cp.company_name, cp.email, cp.phone, u.email AS user_email FROM company_profiles cp JOIN users u ON cp.user_id = u.id WHERE cp.is_default = true AND (cp.email IS NULL OR cp.email = '');
```

**Copy this**, then:
1. Replit → Shell tab
2. Type: `psql $DATABASE_URL`
3. Right-click → Paste (Ctrl+Shift+V)
4. Press Enter
5. Type: `\q` to exit

---

## 🐛 Troubleshooting

### Problem 1: "command not found: psql"

**Solution**:
Replit should have PostgreSQL installed. Try:
```bash
which psql
```

If not found, use Replit's Database tool instead:
1. Click "Tools" in left sidebar
2. Click "Database"
3. Click "Query" tab
4. Paste SQL there
5. Click "Run"

---

### Problem 2: "DATABASE_URL not set"

**Solution**:
1. In Replit, click "Database" tool (left sidebar)
2. Copy the connection string shown
3. Go to Secrets (🔒 icon)
4. Add: `DATABASE_URL = <paste connection string>`
5. Restart Repl
6. Try again

---

### Problem 3: Paste doesn't work

**Solutions**:
- Try: Ctrl+Shift+V (not Ctrl+V)
- Try: Right-click → Paste
- Try: Type it manually (not recommended for long SQL)
- Try: Use Replit Database Tool → Query tab instead

---

### Problem 4: "UPDATE 0" (no rows updated)

**This is OK!** It means:
- Either no users are broken (great!)
- Or migration already ran before

**Verify**:
```sql
SELECT COUNT(*) FROM company_profiles WHERE email IS NULL;
```

If result is `0`, you're good! ✅

---

## ✅ Success Checklist

You'll know it worked when:

- [x] Saw `UPDATE X` (X = number of broken profiles fixed)
- [x] Final query shows `(0 rows)` - no broken profiles remain
- [x] No error messages
- [x] Exited cleanly with `\q`

---

## 📊 What the SQL Does (Explained)

**Part 1 - The Fix**:
```sql
UPDATE company_profiles cp
SET email = COALESCE(cp.email, u.email)  ← If email is NULL, use user's email
FROM users u
WHERE cp.user_id = u.id
  AND cp.email IS NULL;  ← Only update if email is missing
```

**Part 2 - Verification**:
Shows all company profiles to verify they have emails now

**Part 3 - Final Check**:
Searches for any remaining broken profiles (should find 0)

---

## 🎥 Video Alternative

**If you prefer the Replit Database Tool UI**:

1. Click "Tools" (left sidebar)
2. Click "Database"
3. Click "Query" tab
4. Paste the SQL
5. Click "Run Query" button
6. See results below

**This is easier if command line is confusing!**

---

## 🚀 After Running the Migration

**Next steps**:
1. Exit database (`\q`)
2. Restart Replit app (Stop → Run)
3. Test login - users should not be stuck anymore!

---

**Status**: ✅ Ready to run
**Time needed**: 2 minutes
**Risk**: LOW (only updates missing data, doesn't delete anything)
**Safe to run multiple times**: YES (won't break anything)

---

*This migration is safe and only fills in missing email/phone data from the users table. It doesn't delete or modify existing data.*
