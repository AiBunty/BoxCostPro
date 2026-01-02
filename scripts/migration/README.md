# Neon to Local PostgreSQL Migration Guide

Complete toolkit for migrating your BoxCostPro data from Neon PostgreSQL cloud database to a local PostgreSQL instance.

## Quick Start

**One-command migration (recommended):**

```powershell
powershell -ExecutionPolicy Bypass -File scripts/migrate-neon-to-local.ps1 -AutoSwitch
```

This will:
1. Export all data from Neon
2. Set up local PostgreSQL database
3. Import all data
4. Promote first user to super_admin
5. Validate data integrity
6. Switch your application to use local database

**Estimated time:** 20-50 minutes (depending on data size)

---

## Prerequisites

### Required:
- ✅ Node.js installed
- ✅ PostgreSQL running (local or Docker)
- ✅ `DATABASE_URL` environment variable set (pointing to Neon)
- ✅ Neon database accessible

### Optional:
- PostgreSQL client (`psql`) for enhanced validation
- Docker (if running PostgreSQL in container)

---

## Migration Scripts

### 1. Export Script
**File:** `export-neon-data.ts`

**Purpose:** Export all data from Neon to JSON files

**Usage:**
```bash
npx tsx scripts/migration/export-neon-data.ts
```

**Output:**
- `migration-export/metadata.json` - Export summary
- `migration-export/data/*.json` - 59 table data files
- `migration-export/sequences.json` - Sequence values
- `migration-export/constraints.json` - Foreign key definitions

**Features:**
- Batch processing (1000 rows/batch)
- MD5 checksums for validation
- Progress tracking
- Resumable (can continue from last table if interrupted)

---

### 2. Provision Script
**File:** `provision-local-db.ps1`

**Purpose:** Set up local PostgreSQL database

**Usage:**
```powershell
powershell -ExecutionPolicy Bypass -File scripts/migration/provision-local-db.ps1
```

**What it does:**
1. Checks PostgreSQL availability
2. Creates `boxcostpro_local` database (or recreates if exists)
3. Applies schema using `npm run db:push`
4. Optimizes settings for bulk import
5. Verifies schema matches Neon

**Default credentials:**
- Database: `boxcostpro_local`
- User: `postgres`
- Password: `postgres`
- Host: `localhost`
- Port: `5432`

---

### 3. Import Script
**File:** `import-local-data.ts`

**Purpose:** Import exported data to local database

**Usage:**
```bash
# Set DATABASE_URL to local before running
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/boxcostpro_local" npx tsx scripts/migration/import-local-data.ts
```

**Features:**
- Dependency-aware import order
- Temporarily disables triggers/constraints
- Batch inserts (100 rows/batch)
- Transaction safety with rollback
- Sequence restoration
- Progress tracking

**Import Order:**
Tables are imported in dependency order to respect foreign keys:
1. Independent tables (sessions, subscription_plans, paper_shades)
2. Core entities (tenants, users)
3. User data (user_profiles, user_email_settings)
4. Business data (company_profiles, quotes, invoices)
5. Supporting data (email_logs, support_tickets, etc.)

---

### 4. Post-Migration Config
**File:** `post-migration-config.ts`

**Purpose:** Configure database after import

**Usage:**
```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/boxcostpro_local" npx tsx scripts/migration/post-migration-config.ts
```

**Tasks:**
- Find first user (oldest by `created_at`)
- Promote to `super_admin` role
- Verify foreign key integrity
- Rebuild indexes
- Update table statistics (ANALYZE)
- Display database statistics

---

### 5. Validation Script
**File:** `validate-migration.ts`

**Purpose:** Verify migration integrity

**Usage:**
```bash
DATABASE_URL_NEON="<neon-url>" DATABASE_URL_LOCAL="<local-url>" npx tsx scripts/migration/validate-migration.ts
```

**Checks:**
- Row count comparison (Neon vs Local)
- Sample data verification (random 10%)
- Foreign key constraint validation
- Unique constraint validation
- Sequence value correctness
- Generates detailed JSON report

**Output:**
- `migration-export/validation-report.json`

---

### 6. Environment Switcher
**File:** `switch-to-local-db.ps1`

**Purpose:** Update application to use local database

**Usage:**
```powershell
powershell -ExecutionPolicy Bypass -File scripts/migration/switch-to-local-db.ps1
```

**What it does:**
1. Backs up `.env` to `.env.neon.backup`
2. Updates `DATABASE_URL` to local connection
3. Tests local database connection
4. Shows restart instructions

**After running:**
- Restart dev server: `npm run dev`
- Your app now uses local PostgreSQL

---

### 7. Rollback Script
**File:** `rollback-to-neon.ps1`

**Purpose:** Emergency rollback to Neon

**Usage:**
```powershell
powershell -ExecutionPolicy Bypass -File scripts/migration/rollback-to-neon.ps1
```

**What it does:**
1. Restores `.env` from `.env.neon.backup`
2. Verifies Neon connection URL
3. Shows restart instructions

**When to use:**
- Migration validation failed
- Local database issues
- Need to revert quickly

---

### 8. Master Orchestrator
**File:** `migrate-neon-to-local.ps1`

**Purpose:** Run entire migration process

**Usage:**
```powershell
# Full migration with auto-switch
powershell -ExecutionPolicy Bypass -File scripts/migrate-neon-to-local.ps1 -AutoSwitch

# Skip export (use existing data)
powershell -ExecutionPolicy Bypass -File scripts/migrate-neon-to-local.ps1 -SkipExport

# Skip validation (faster)
powershell -ExecutionPolicy Bypass -File scripts/migrate-neon-to-local.ps1 -SkipValidation
```

**Parameters:**
- `-AutoSwitch` - Automatically switch to local after migration
- `-SkipExport` - Skip export step (use existing export)
- `-SkipValidation` - Skip validation step

**Flow:**
1. Pre-flight checks
2. Export from Neon
3. Provision local DB
4. Import data
5. Post-migration config
6. Validation
7. Switch environment (if `-AutoSwitch`)

---

## Manual Step-by-Step Migration

If you prefer manual control:

### Step 1: Export from Neon
```bash
npx tsx scripts/migration/export-neon-data.ts
```
**Expected:** `migration-export/` directory created with data files

### Step 2: Set up local database
```powershell
powershell -ExecutionPolicy Bypass -File scripts/migration/provision-local-db.ps1
```
**Expected:** `boxcostpro_local` database created with schema

### Step 3: Import data
```bash
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/boxcostpro_local"
npx tsx scripts/migration/import-local-data.ts
```
**Expected:** All tables populated with data

### Step 4: Post-migration configuration
```bash
npx tsx scripts/migration/post-migration-config.ts
```
**Expected:** First user promoted to super_admin

### Step 5: Validate
```bash
$env:DATABASE_URL_NEON="<your-neon-url>"
$env:DATABASE_URL_LOCAL="postgresql://postgres:postgres@localhost:5432/boxcostpro_local"
npx tsx scripts/migration/validate-migration.ts
```
**Expected:** Validation report showing 100% match

### Step 6: Switch environment
```powershell
powershell -ExecutionPolicy Bypass -File scripts/migration/switch-to-local-db.ps1
```
**Expected:** `.env` updated to use local database

### Step 7: Restart and test
```bash
npm run dev
```
**Test:** Login, view quotes, check master data

---

## Troubleshooting

### Export Fails

**Error:** "DATABASE_URL not set"
- **Fix:** Ensure `DATABASE_URL` environment variable is set
- **Check:** Run `echo $env:DATABASE_URL` in PowerShell

**Error:** "Connection timeout"
- **Fix:** Check Neon database is accessible
- **Check:** Verify DATABASE_URL is correct

### Provision Fails

**Error:** "PostgreSQL is not running"
- **Fix:** Start PostgreSQL service
  - Windows: `net start postgresql-x64-15`
  - Docker: `docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:15`

**Error:** "Database already exists"
- **Fix:** Script will prompt to drop and recreate
- **Alternative:** Drop manually: `psql -U postgres -c "DROP DATABASE boxcostpro_local;"`

### Import Fails

**Error:** "Export directory not found"
- **Fix:** Run export script first
- **Check:** Verify `migration-export/` directory exists

**Error:** "Foreign key violation"
- **Fix:** Import respects dependencies, this shouldn't happen
- **Check:** Review `migration-export/constraints.json`

**Error:** "Duplicate key error"
- **Fix:** Ensure database is empty before import
- **Check:** Reprovision database

### Validation Warnings

**Warning:** "Row count mismatch"
- **Cause:** Data changed in Neon after export
- **Fix:** Re-export and re-import
- **Alternative:** Accept differences if they're expected

**Warning:** "Sample data mismatch"
- **Cause:** Data modified during migration
- **Fix:** Usually safe to proceed if row counts match

---

## Safety Features

### Non-Destructive
- ✅ Neon database is NEVER modified
- ✅ Original data always safe
- ✅ Can rollback anytime

### Backups
- `.env.neon.backup` - Original environment config
- `migration-export/` - Complete data snapshot
- Neon database - Untouched original

### Validation
- Row count verification
- Foreign key integrity checks
- Unique constraint validation
- Sample data comparison
- Sequence value verification

### Rollback Ready
```powershell
# Instant rollback to Neon
powershell -ExecutionPolicy Bypass -File scripts/migration/rollback-to-neon.ps1
npm run dev
```

---

## Success Criteria

Migration is successful when:
- ✅ All 59 tables imported with matching row counts
- ✅ Zero foreign key violations
- ✅ All unique constraints valid
- ✅ Sequences set correctly
- ✅ First user promoted to super_admin
- ✅ Application starts without errors
- ✅ Core features work (login, quotes, master data)
- ✅ Validation report shows 100% integrity

---

## Post-Migration Testing

After migration, test these features:

### Authentication
- [ ] Login with existing account
- [ ] First user has super_admin access
- [ ] Password reset works
- [ ] Email verification works

### Core Features
- [ ] View quotes list
- [ ] Create new quote
- [ ] Edit quote
- [ ] Generate invoice PDF
- [ ] Download quote

### Master Data
- [ ] View paper prices
- [ ] View flute prices
- [ ] View print prices
- [ ] Update master data

### Admin Features (super_admin only)
- [ ] Access admin panel
- [ ] View all users
- [ ] Manage email providers
- [ ] View analytics
- [ ] Access admin settings

### Email Features
- [ ] SMTP configuration
- [ ] Send test email
- [ ] View email logs

---

## Performance Comparison

### Neon (Cloud)
- ⚠️ Network latency (100-500ms)
- ⚠️ Connection limits
- ⚠️ Regional restrictions
- ✅ Automatic backups
- ✅ Scalable

### Local PostgreSQL
- ✅ Near-zero latency (<5ms)
- ✅ Unlimited connections
- ✅ Full control
- ✅ Faster development
- ⚠️ Manual backups needed

---

## Disk Space Requirements

### Export Files
- Typical size: 100-500 MB
- Depends on: Number of quotes, master data, email logs

### Local Database
- Initial size: ~200-600 MB
- Growth: Depends on usage
- Location: PostgreSQL data directory

---

## Frequently Asked Questions

### Q: Will this delete my Neon data?
**A:** No. The migration is non-destructive. Your Neon database remains unchanged.

### Q: Can I switch back to Neon after migration?
**A:** Yes. Use the rollback script anytime:
```powershell
powershell -ExecutionPolicy Bypass -File scripts/migration/rollback-to-neon.ps1
```

### Q: What if the migration fails halfway?
**A:** Each step is isolated. You can restart from any step. The import script uses transactions for safety.

### Q: Do I need to keep the Neon database?
**A:** Recommended to keep it as a backup for at least 30 days after migration.

### Q: Can I run both Neon and Local simultaneously?
**A:** Yes, by switching `DATABASE_URL` in `.env`. Use the switch/rollback scripts.

### Q: How do I backup the local database?
**A:** Use pg_dump:
```bash
pg_dump -U postgres boxcostpro_local > backup.sql
```

### Q: Can I deploy the local database to production?
**A:** Not recommended. Use Neon or another cloud provider for production. Local is for development.

---

## Support

If you encounter issues:

1. Check this README troubleshooting section
2. Review script output for error messages
3. Check `migration-export/metadata.json` for export details
4. Review `migration-export/validation-report.json` for validation results
5. Rollback to Neon if critical issues occur

---

## Files Created

### Migration Scripts
- `scripts/migration/export-neon-data.ts` (232 lines)
- `scripts/migration/provision-local-db.ps1` (135 lines)
- `scripts/migration/import-local-data.ts` (328 lines)
- `scripts/migration/post-migration-config.ts` (227 lines)
- `scripts/migration/validate-migration.ts` (372 lines)
- `scripts/migration/switch-to-local-db.ps1` (122 lines)
- `scripts/migration/rollback-to-neon.ps1` (108 lines)
- `scripts/migrate-neon-to-local.ps1` (327 lines) - Master orchestrator

### Documentation
- `scripts/migration/README.md` (this file)

### Generated Files (during migration)
- `migration-export/metadata.json`
- `migration-export/data/*.json` (59 files)
- `migration-export/sequences.json`
- `migration-export/constraints.json`
- `migration-export/validation-report.json`
- `.env.neon.backup`

---

## License

Part of BoxCostPro project. Use freely for your database migration needs.

---

**Ready to migrate?**

```powershell
powershell -ExecutionPolicy Bypass -File scripts/migrate-neon-to-local.ps1 -AutoSwitch
```

**Happy local development!** 🚀
