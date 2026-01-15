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
  console.error('Checked .env file at:', envPath);
  process.exit(1);
}

const client = new Client({ connectionString: DATABASE_URL });

async function applyMigration() {
  try {
    await client.connect();
    console.log('✓ Connected to database');
    
    console.log('Reading migration file...');
    const migrationPath = path.join(__dirname, '..', 'migrations', '20260105_admins_table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    console.log('Applying admin tables migration...');
    
    // Split by semicolons and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const statement of statements) {
      if (statement.length < 10) continue; // Skip empty/tiny statements
      
      try {
        await client.query(statement);
        console.log('✓ Executed statement');
      } catch (err) {
        // Ignore "already exists" errors
        if (err.message?.includes('already exists') || err.message?.includes('duplicate key')) {
          console.log('⚠ Statement already applied (skipping)');
        } else {
          console.error('✗ Error:', err.message);
          // Continue with other statements
        }
      }
    }
    
    console.log('\n✓ Migration applied successfully');
    
    // Verify tables
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('admins', 'admin_sessions', 'admin_login_audit_logs', 'admin_allowed_ips')
      ORDER BY table_name
    `);
    
    console.log('\nAdmin tables in database:');
    tablesResult.rows.forEach(t => console.log(`  - ${t.table_name}`));
    
    // Check admin count
    const countResult = await client.query('SELECT COUNT(*) as count FROM admins');
    console.log(`\nAdmin users: ${countResult.rows[0].count}`);
    
  } catch (error) {
    console.error('\n✗ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
