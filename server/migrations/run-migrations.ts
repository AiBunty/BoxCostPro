/**
 * Run all database migrations
 *
 * Usage: npx tsx server/migrations/run-migrations.ts
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;

// ESM dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🚀 Starting database migrations...\n');

    // Migration files in order
    const migrations = [
      'create-temporary-business-profiles.sql',
      'create-invoice-templates.sql',
      'create-invoices.sql',
      'create-seller-profile.sql',
      'alter-users-add-payment-fields.sql',
    ];

    for (const migrationFile of migrations) {
      const migrationPath = path.join(__dirname, migrationFile);

      if (!fs.existsSync(migrationPath)) {
        console.warn(`⚠️  Migration file not found: ${migrationFile}`);
        continue;
      }

      console.log(`📄 Running migration: ${migrationFile}`);

      const sql = fs.readFileSync(migrationPath, 'utf-8');

      try {
        await pool.query(sql);
        console.log(`✅ Successfully applied: ${migrationFile}\n`);
      } catch (error: any) {
        console.error(`❌ Failed to apply ${migrationFile}:`, error.message);

        // Continue with other migrations even if one fails
        // (helpful for re-running migrations)
        if (!error.message.includes('already exists')) {
          throw error;
        } else {
          console.log(`   (Table already exists - skipping)\n`);
        }
      }
    }

    console.log('🎉 All migrations completed successfully!');
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
