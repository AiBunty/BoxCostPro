import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env manually
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim();
    }
  });
}

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable not set');
  process.exit(1);
}

const client = new Client({ connectionString: DATABASE_URL });

async function applyMigration() {
  try {
    await client.connect();
    console.log('✓ Connected to database\n');
    
    const migrationPath = path.join(__dirname, '..', 'migrations', '20260105_entitlement_system.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    console.log('Applying entitlement system migration...\n');
    
    // Execute the entire migration
    await client.query(migrationSQL);
    
    console.log('✓ Entitlement tables created\n');
    
    // Verify tables
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN (
          'subscription_overrides',
          'platform_events',
          'entitlement_cache',
          'consistency_check_logs'
        )
      ORDER BY table_name
    `);
    
    console.log('Entitlement system tables:');
    tablesResult.rows.forEach(t => console.log(`  ✓ ${t.table_name}`));
    
    console.log('\n✓ Migration completed successfully!');
    
  } catch (error) {
    console.error('\n✗ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
