import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Client } = pg;

// Load .env manually
const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match && !process.env[match[1]]) {
    process.env[match[1]] = match[2];
  }
});

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function checkDatabase() {
  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Check for user_setup table
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('user_setup', 'admin_email_settings')
    `);
    console.log('\n📊 Migration tables:', tablesRes.rows.length > 0 ? tablesRes.rows.map(r => r.table_name).join(', ') : 'NONE FOUND');

    // Check users table columns
    const columnsRes = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('setup_progress', 'is_setup_complete', 'verification_status')
    `);
    console.log('📊 Users table new columns:', columnsRes.rows.length > 0 ? columnsRes.rows.map(r => r.column_name).join(', ') : 'NONE FOUND');

    if (tablesRes.rows.length === 0) {
      console.log('\n❌ PROBLEM: user_setup table does NOT exist');
      console.log('👉 Solution: Run database migration to create required tables');
    } else {
      console.log('\n✅ Migration tables exist');
    }

    if (columnsRes.rows.length === 0) {
      console.log('❌ PROBLEM: Users table missing new columns');
      console.log('👉 Solution: Run database migration to add columns');
    } else {
      console.log('✅ Users table has new columns');
    }

    await client.end();
  } catch (error) {
    console.error('❌ Database check failed:', error.message);
    process.exit(1);
  }
}

checkDatabase();
