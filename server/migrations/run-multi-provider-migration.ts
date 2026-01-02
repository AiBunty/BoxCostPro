/**
 * Run Multi-Provider Email System Migration
 *
 * Usage: npx tsx --env-file=.env server/migrations/run-multi-provider-migration.ts
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;

// ESM dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMultiProviderMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🚀 Starting Multi-Provider Email System migration...\n');

    const migrationPath = path.join(__dirname, 'multi-provider-email-schema.sql');

    if (!fs.existsSync(migrationPath)) {
      throw new Error('Migration file not found: multi-provider-email-schema.sql');
    }

    console.log('📄 Running migration: multi-provider-email-schema.sql');

    const sql = fs.readFileSync(migrationPath, 'utf-8');

    await pool.query(sql);
    console.log('✅ Successfully applied multi-provider email schema\n');

    // Verify tables were created
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'email_providers',
          'email_task_routing',
          'email_send_logs',
          'email_provider_health',
          'user_email_preferences'
        )
      ORDER BY table_name;
    `);

    console.log('✅ Verification - Tables created:');
    result.rows.forEach((row) => {
      console.log(`   - ${row.table_name}`);
    });

    // Check backward compatibility view
    const viewResult = await pool.query(`
      SELECT table_name
      FROM information_schema.views
      WHERE table_schema = 'public'
        AND table_name = 'admin_email_settings';
    `);

    if (viewResult.rows.length > 0) {
      console.log('✅ Backward compatibility view created: admin_email_settings');
    }

    console.log('\n🎉 Multi-Provider Email System migration completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('   1. Configure email providers via Admin Panel');
    console.log('   2. Set up task routing rules');
    console.log('   3. Test provider connections');
    console.log('   4. Update application code to use routing engine');
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);

    if (error.message.includes('already exists')) {
      console.log('\n⚠️  Tables already exist. Migration may have been run previously.');
      console.log('   If you need to re-run, drop the tables first (CAUTION: data loss).');
    }

    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMultiProviderMigration();
