/**
 * Manual Migration Script
 * Applies SQL migrations to the database
 */

import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function runMigrations() {
  const migrationsDir = path.join(__dirname, '../server/migrations');

  const migrationFiles = [
    '001_create_temporary_business_profiles.sql',
    '002_create_invoices.sql',
    '003_create_invoice_templates.sql',
    '004_create_seller_profile.sql',
    '005_alter_users_add_payment_fields.sql',
    '006_alter_user_subscriptions_add_invoice_ref.sql',
  ];

  for (const filename of migrationFiles) {
    const filePath = path.join(migrationsDir, filename);

    try {
      console.log(`\nApplying migration: ${filename}`);
      const migrationSQL = fs.readFileSync(filePath, 'utf-8');

      // Execute migration
      await sql(migrationSQL);

      console.log(`✅ Successfully applied: ${filename}`);
    } catch (error: any) {
      console.error(`❌ Failed to apply ${filename}:`, error.message);
      // Continue with other migrations even if one fails
    }
  }

  console.log('\n✅ All migrations completed!');
}

runMigrations().catch(error => {
  console.error('Migration error:', error);
  process.exit(1);
});
