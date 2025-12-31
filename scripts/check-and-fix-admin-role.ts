/**
 * Check and Fix Admin Role
 * Checks the current user's role and promotes to super_admin if needed
 */

import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';

// Try to load .env file
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const lines = envContent.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key === 'DATABASE_URL' && valueParts.length > 0) {
        process.env.DATABASE_URL = valueParts.join('=').trim();
        break;
      }
    }
  }
}

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set in environment or .env file');
  console.error('   Please ensure DATABASE_URL is set in your .env file');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function main() {
  console.log('🔍 Checking user roles...\n');

  try {
    // Get all users
    const users = await sql`
      SELECT id, email, role, clerk_user_id, first_name, last_name, created_at
      FROM users
      ORDER BY created_at ASC
    `;

    if (users.length === 0) {
      console.log('⚠️  No users found in database');
      return;
    }

    console.log(`Found ${users.length} user(s):\n`);

    users.forEach((user: any, index: number) => {
      console.log(`${index + 1}. ${user.email}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Name: ${user.first_name || ''} ${user.last_name || ''}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Clerk User ID: ${user.clerk_user_id || 'N/A'}`);
      console.log(`   Created: ${user.created_at}`);
      console.log('');
    });

    // Check if first user is super_admin
    const firstUser = users[0];

    if (firstUser.role === 'super_admin') {
      console.log('✅ First user is already super_admin');
      return;
    }

    console.log(`\n⚠️  First user (${firstUser.email}) has role: ${firstUser.role}`);
    console.log('   Promoting to super_admin...\n');

    // Update first user to super_admin
    await sql`
      UPDATE users
      SET role = 'super_admin'
      WHERE id = ${firstUser.id}
    `;

    console.log('✅ Successfully promoted first user to super_admin');

    // Verify
    const updated = await sql`
      SELECT id, email, role
      FROM users
      WHERE id = ${firstUser.id}
    `;

    console.log('\n📋 Updated user info:');
    console.log(`   Email: ${updated[0].email}`);
    console.log(`   Role: ${updated[0].role}`);

    console.log('\n✅ Done! Please restart your dev server for changes to take effect.');
    console.log('   npm run dev\n');

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
