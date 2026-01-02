/**
 * Run Migration 008: Invoice Templates System
 * This script runs the migration using tsx --env-file
 */

import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// DATABASE_URL is loaded by tsx --env-file=.env
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL or DATABASE_URL_LOCAL not set');
  console.error('Please run: npm run local:db');
  console.error('Or set DATABASE_URL_LOCAL in your .env file');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function runMigration() {
  console.log('🚀 Starting Migration 008: Invoice Templates System');
  console.log(`📍 Database: ${DATABASE_URL.replace(/:[^:]*@/, ':****@')}`);

  try {
    // Read the SQL migration file
    const migrationPath = path.join(__dirname, '../server/migrations/008-invoice-templates.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Executing migration (splitting statements for Neon)...');

    // Split into individual statements (Neon doesn't support multiple statements)
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--') && !s.startsWith('/*') && s.toUpperCase() !== 'COMMENT ON');

    console.log(`   Found ${statements.length} SQL statements to execute`);

    // Execute each statement individually
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      try {
        console.log(`   [${i + 1}/${statements.length}] Executing...`);
        await sql([statement]);
      } catch (error) {
        // Ignore "already exists" errors
        if (error.message?.includes('already exists')) {
          console.log(`   ⚠️  Already exists, skipping...`);
          continue;
        }
        throw error;
      }
    }

    console.log('✅ Migration 008 completed successfully!');
    console.log('   - Created invoice_templates table');
    console.log('   - Created template indexes');
    console.log('   - Added PDF tracking columns to quotes');
    console.log('   - Created quotes indexes for PDFs');
    console.log('   - Seeded 3 default templates');

    // Verify templates were created
    const templates = await sql`SELECT id, name, template_key, is_default FROM invoice_templates ORDER BY is_default DESC, name`;
    console.log(`\n📋 Templates created (${templates.length}):`);
    templates.forEach(t => {
      console.log(`   - ${t.name} (${t.template_key})${t.is_default ? ' [DEFAULT]' : ''}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration 008 failed:', error.message);

    // Check if it's a duplicate error
    if (error.message?.includes('already exists')) {
      console.log('\n⚠️  Some objects already exist. Checking current state...');
      try {
        const templates = await sql`SELECT COUNT(*) as count FROM invoice_templates`;
        console.log(`✅ invoice_templates table exists with ${templates[0].count} templates`);
        process.exit(0);
      } catch (checkError) {
        console.error('Cannot verify table state:', checkError.message);
      }
    }

    console.error(error);
    process.exit(1);
  }
}

runMigration();
