/**
 * Migration Script: Add clerk_user_id column to users table
 *
 * Usage:
 *   npx tsx server/migrations/run-clerk-migration.ts
 */

import pg from 'pg';
const { Pool } = pg;

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🚀 Starting migration: Add clerk_user_id column...\n');

    // Add clerk_user_id column if it doesn't exist
    console.log('Adding clerk_user_id column to users table...');
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS clerk_user_id VARCHAR UNIQUE;
    `);
    console.log('✅ Column added successfully');

    // Add index for faster lookups
    console.log('\nCreating index on clerk_user_id...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_clerk_user_id ON users(clerk_user_id);
    `);
    console.log('✅ Index created successfully');

    console.log('\n🎉 Migration completed successfully!');
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

runMigration()
  .then(() => {
    console.log('\n✅ Done');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
