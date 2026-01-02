# Quick Start: Migrate from Neon to Local PostgreSQL

**Time required:** 20-50 minutes
**Risk level:** Low (Neon data remains untouched)

## Prerequisites

- [ ] PostgreSQL running locally (or Docker)
- [ ] Node.js installed
- [ ] DATABASE_URL pointing to Neon in your `.env`

## One-Command Migration

```bash
npm run migrate:neon-to-local
```

This single command will:
1. ✅ Export all data from Neon
2. ✅ Set up local PostgreSQL database
3. ✅ Import all 59 tables
4. ✅ Promote first user to super_admin
5. ✅ Validate data integrity
6. ✅ Switch your app to use local database

## After Migration

### Restart Dev Server
```bash
npm run dev
```

### Test Your Application
- [ ] Login with your account
- [ ] View quotes
- [ ] Access admin panel (you're now super_admin!)
- [ ] Check master data
- [ ] Test email configuration

## If Something Goes Wrong

### Rollback to Neon
```bash
npm run migrate:rollback
npm run dev
```

Your Neon data is safe - nothing was deleted!

## Individual Commands (Optional)

If you prefer step-by-step control:

```bash
# 1. Export from Neon
npm run migrate:export

# 2. Import to local
npm run migrate:import

# 3. Validate
npm run migrate:validate

# 4. Switch environment
npm run migrate:switch

# 5. Rollback (if needed)
npm run migrate:rollback
```

## Detailed Documentation

For advanced options and troubleshooting:
- [Complete Migration Guide](scripts/migration/README.md)

## What Gets Migrated?

✅ **All Users** - Including authentication data
✅ **All Quotes** - Including versions and items
✅ **Master Data** - Paper prices, flute prices, print prices
✅ **Company Profiles** - Your business settings
✅ **Party Profiles** - Customer data
✅ **Email Settings** - SMTP configurations
✅ **Invoices** - PDF generation history
✅ **Support Tickets** - Customer support data
✅ **Everything else** - All 59 tables in your schema

## Benefits of Local Development

⚡ **Faster Queries** - Near-zero latency vs 100-500ms
🔧 **Better Debugging** - Direct database access
💰 **No Usage Limits** - Unlimited queries and connections
🚀 **Rapid Testing** - No network delays
📊 **Full Control** - Your data, your machine

## Still Using Neon for Production?

That's fine! This migration is for local development only.

**Keep Neon for:**
- Production deployment
- Staging environment
- Team collaboration
- Automatic backups

**Use Local for:**
- Development
- Testing
- Debugging
- Prototyping

You can switch between them anytime using the npm scripts.

---

**Ready? Run this now:**

```bash
npm run migrate:neon-to-local
```

**Questions?** Check [scripts/migration/README.md](scripts/migration/README.md)
