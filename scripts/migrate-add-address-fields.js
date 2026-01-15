/**
 * Migration: Add address1, address2, pincode, countryCode fields
 * Adds structured address fields to company_profiles table
 */

import { db } from '../server/db.js';
import { sql } from 'drizzle-orm';
import pg from 'pg';
const { Client } = pg;

async function migrate() {
  console.log('🔄 Starting address fields migration...');

  try {
    // Add new address fields
    await db.execute(sql`
      ALTER TABLE company_profiles 
      ADD COLUMN IF NOT EXISTS address_1 TEXT,
      ADD COLUMN IF NOT EXISTS address_2 TEXT,
      ADD COLUMN IF NOT EXISTS pincode VARCHAR(6),
      ADD COLUMN IF NOT EXISTS country_code VARCHAR(5) DEFAULT '+91';
    `);

    console.log('✅ Added new address columns');

    // Backfill address_1 from legacy address field
    await db.execute(sql`
      UPDATE company_profiles 
      SET address_1 = address 
      WHERE address_1 IS NULL AND address IS NOT NULL AND address != '';
    `);

    console.log('✅ Backfilled address_1 from legacy address field');

    console.log('✅ Migration completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

migrate()
  .then(() => {
    console.log('✅ All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
