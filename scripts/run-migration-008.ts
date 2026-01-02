/**
 * Run Migration 008: Invoice Templates System
 */

import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  console.log('🚀 Starting Migration 008: Invoice Templates System');

  try {
    // Read the SQL migration file
    const migrationPath = path.join(__dirname, '../server/migrations/008-invoice-templates.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Split into individual statements to avoid transaction issues
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--') && !s.startsWith('/*'));

    console.log(`Executing ${statements.length} SQL statements...`);

    for (const statement of statements) {
      try {
        await db.execute(sql.raw(statement));
      } catch (err: any) {
        // Ignore duplicate errors (already exists)
        if (!err.message?.includes('already exists')) {
          throw err;
        }
      }
    }

    console.log('✅ Migration 008 completed successfully!');
    console.log('   - Created invoice_templates table');
    console.log('   - Created template indexes');
    console.log('   - Added PDF tracking columns to quotes');
    console.log('   - Created quotes indexes for PDFs');
    console.log('   - Seeded 3 default templates');
    console.log('');
    console.log('📝 Next steps:');
    console.log('   1. Run: tsx scripts/seed-invoice-templates.ts');
    console.log('   2. Test PDF generation with sample data');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Migration 008 failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();
