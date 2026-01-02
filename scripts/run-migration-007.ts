/**
 * Run Migration 007: Admin Email Settings & Onboarding Fixes
 */

import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  console.log('🚀 Starting Migration 007: Admin Email Settings & Onboarding Fixes');

  try {
    // Read the SQL migration file
    const migrationPath = path.join(__dirname, '../server/migrations/007_admin_email_and_onboarding_fixes.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Execute the migration
    await db.execute(sql.raw(migrationSQL));

    console.log('✅ Migration 007 completed successfully!');
    console.log('   - Created admin_email_settings table');
    console.log('   - Added email_logs indexes');
    console.log('   - Fixed onboarding verification_status');
    console.log('   - Fixed tenant ownership');
    console.log('   - Reset incorrectly verified accounts');
    console.log('   - Ensured data integrity');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Migration 007 failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();
