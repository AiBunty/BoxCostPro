/**
 * Migration script to add submitted_for_verification_at column to users table
 */
import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function runMigration() {
  try {
    console.log('Running migration: add submitted_for_verification_at column');
    
    // Check if column exists
    const result = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
        AND column_name = 'submitted_for_verification_at'
    `);
    
    if (result.rows.length > 0) {
      console.log('Column submitted_for_verification_at already exists, skipping migration');
      process.exit(0);
    }
    
    // Add the column
    await db.execute(sql`
      ALTER TABLE users ADD COLUMN submitted_for_verification_at timestamp
    `);
    
    console.log('✅ Successfully added submitted_for_verification_at column to users table');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
