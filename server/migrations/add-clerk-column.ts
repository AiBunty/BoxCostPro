/**
 * Migration Script: Add clerk_user_id column to users table
 *
 * This script adds support for Clerk authentication by adding the clerk_user_id column.
 *
 * Usage:
 *   npx tsx server/migrations/add-clerk-column.ts
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';

async function addClerkColumn() {
  console.log('🚀 Starting migration: Add clerk_user_id column...\n');

  try {
    // Add clerk_user_id column if it doesn't exist
    console.log('Adding clerk_user_id column to users table...');
    await db.execute(sql`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS clerk_user_id VARCHAR UNIQUE;
    `);
    console.log('✅ Column added successfully');

    // Add index for faster lookups
    console.log('\nCreating index on clerk_user_id...');
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_users_clerk_user_id ON users(clerk_user_id);
    `);
    console.log('✅ Index created successfully');

    console.log('\n🎉 Migration completed successfully!');
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    throw error;
  }
}

// Run migration if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  addClerkColumn()
    .then(() => {
      console.log('\n✅ Done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { addClerkColumn };
