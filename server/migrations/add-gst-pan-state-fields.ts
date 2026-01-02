/**
 * Migration: Add GST, PAN, State, and Invoice Locking Fields
 *
 * Run with: npx tsx --env-file=.env server/migrations/add-gst-pan-state-fields.ts
 */

import pg from 'pg';
const { Pool } = pg;

async function migrate() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🚀 Starting migration: Add GST, PAN, State fields...\n');

    // Add new columns
    console.log('Adding new columns to company_profiles table...');
    await pool.query(`
      ALTER TABLE company_profiles
        ADD COLUMN IF NOT EXISTS pan_no TEXT,
        ADD COLUMN IF NOT EXISTS state_code VARCHAR(2),
        ADD COLUMN IF NOT EXISTS state_name TEXT,
        ADD COLUMN IF NOT EXISTS gst_verified BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS gst_verified_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS gst_verification_provider TEXT,
        ADD COLUMN IF NOT EXISTS gst_verification_response TEXT,
        ADD COLUMN IF NOT EXISTS has_financial_docs BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS locked_reason TEXT;
    `);
    console.log('✅ Columns added');

    // Add unique constraint on GST
    console.log('\nAdding unique constraint on gst_no...');
    await pool.query(`
      ALTER TABLE company_profiles
        DROP CONSTRAINT IF EXISTS company_profiles_gst_no_unique;

      ALTER TABLE company_profiles
        ADD CONSTRAINT company_profiles_gst_no_unique UNIQUE (gst_no);
    `);
    console.log('✅ Unique constraint added');

    // Create index for state code lookups
    console.log('\nCreating index on state_code...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_company_profiles_state_code
      ON company_profiles(state_code);
    `);
    console.log('✅ Index created');

    // Backfill PAN and State for existing profiles with GSTIN
    console.log('\nBackfilling PAN and State from existing GSTIN values...');
    const result = await pool.query(`
      UPDATE company_profiles
      SET
        pan_no = SUBSTRING(gst_no, 3, 10),
        state_code = SUBSTRING(gst_no, 1, 2)
      WHERE gst_no IS NOT NULL
        AND LENGTH(gst_no) = 15
        AND pan_no IS NULL;
    `);
    console.log(`✅ Backfilled ${result.rowCount} profiles`);

    console.log('\n🎉 Migration completed successfully!');
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

migrate()
  .then(() => {
    console.log('\n✅ Done');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
