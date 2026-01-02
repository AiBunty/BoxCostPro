/**
 * Promote First User to Super Admin
 * This script updates the first user's role to 'super_admin'
 */

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function promoteFirstUserToSuperAdmin() {
  console.log('🚀 Promoting first user to super_admin...\n');

  try {
    // Get all users ordered by creation date
    const users = await sql`
      SELECT id, email, role, created_at
      FROM users
      ORDER BY created_at ASC
      LIMIT 5
    `;

    if (users.length === 0) {
      console.log('⚠️  No users found in database');
      process.exit(0);
    }

    console.log(`Found ${users.length} user(s):\n`);
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} - Role: ${user.role} - Created: ${user.created_at}`);
    });

    // Get the first user (oldest)
    const firstUser = users[0];

    console.log(`\n📝 First user: ${firstUser.email}`);
    console.log(`   Current role: ${firstUser.role}`);

    if (firstUser.role === 'super_admin') {
      console.log('   ✅ Already a super_admin, no changes needed');
      process.exit(0);
    }

    // Update the first user to super_admin
    await sql`
      UPDATE users
      SET role = 'super_admin'
      WHERE id = ${firstUser.id}
    `;

    console.log(`   ✅ Updated role to: super_admin`);

    // Verify the update
    const [updatedUser] = await sql`
      SELECT id, email, role
      FROM users
      WHERE id = ${firstUser.id}
    `;

    console.log(`\n🎉 Success! ${updatedUser.email} is now a super_admin`);
    console.log('\n📝 Next steps:');
    console.log('   1. Restart your dev server if it\'s running');
    console.log('   2. Refresh your browser');
    console.log('   3. You should now have access to all admin features');

    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to promote user:', error.message);
    console.error(error);
    process.exit(1);
  }
}

promoteFirstUserToSuperAdmin();
