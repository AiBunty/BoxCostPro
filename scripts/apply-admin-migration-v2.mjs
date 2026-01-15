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
    console.log('✓ Connected to database\n');
    
    // 1. Create admins table
    console.log('Creating admins table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT,
        role VARCHAR(20) NOT NULL CHECK (role IN ('super_admin', 'admin')),
        is_active BOOLEAN DEFAULT true,
        twofa_enabled BOOLEAN DEFAULT false,
        twofa_secret TEXT,
        created_at TIMESTAMP DEFAULT now(),
        last_login_at TIMESTAMP
      )
    `);
    console.log('✓ admins table created\n');
    
    // 2. Create admin_sessions table
    console.log('Creating admin_sessions table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_sessions (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        admin_id VARCHAR NOT NULL REFERENCES admins(id),
        session_token VARCHAR(255) UNIQUE NOT NULL,
        ip_address VARCHAR(64),
        user_agent TEXT,
        impersonated_user_id VARCHAR(255),
        last_activity_at TIMESTAMP DEFAULT now(),
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT now()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(session_token)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin ON admin_sessions(admin_id)`);
    console.log('✓ admin_sessions table created\n');
    
    // 3. Create admin_login_audit_logs table
    console.log('Creating admin_login_audit_logs table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_login_audit_logs (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        admin_id VARCHAR REFERENCES admins(id),
        action VARCHAR(32) NOT NULL,
        ip_address VARCHAR(64),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT now()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_admin_login_logs_admin ON admin_login_audit_logs(admin_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_admin_login_logs_action ON admin_login_audit_logs(action)`);
    console.log('✓ admin_login_audit_logs table created\n');
    
    // 4. Create admin_allowed_ips table
    console.log('Creating admin_allowed_ips table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_allowed_ips (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        admin_id VARCHAR REFERENCES admins(id),
        ip_address VARCHAR(64) NOT NULL,
        created_at TIMESTAMP DEFAULT now()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_admin_ips_admin ON admin_allowed_ips(admin_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_admin_ips_cidr ON admin_allowed_ips(ip_address)`);
    console.log('✓ admin_allowed_ips table created\n');
    
    // 5. Seed super admin
    console.log('Seeding super admin...');
    const seedResult = await client.query(`
      INSERT INTO admins (email, name, role, is_active, password_hash)
      VALUES ('admin@boxcostpro.com', 'Super Admin', 'super_admin', true, '$2b$12$QvqBL6zr4gqXWFutQkL.DuJl6VFdSxZ6rpKvyGlvNH.x5VdlVcfL6')
      ON CONFLICT (email) DO NOTHING
      RETURNING id
    `);
    if (seedResult.rows.length > 0) {
      console.log('✓ Super admin created (email: admin@boxcostpro.com, password: AdminPass123!)\n');
    } else {
      console.log('⚠ Super admin already exists\n');
    }
    
    // 6. Update users table constraint to remove admin roles
    console.log('Updating users table constraints...');
    try {
      await client.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);
      await client.query(`UPDATE users SET role = 'staff' WHERE role NOT IN ('owner', 'staff')`);
      await client.query(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('owner', 'staff'))`);
      console.log('✓ Users table constrained to business roles only\n');
    } catch (err) {
      console.log('⚠ Users table constraint update skipped:', err.message, '\n');
    }
    
    // Verify
    const countResult = await client.query('SELECT COUNT(*) as count FROM admins');
    console.log(`\n✓ Migration completed successfully!`);
    console.log(`✓ Admin users in database: ${countResult.rows[0].count}`);
    
  } catch (error) {
    console.error('\n✗ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
