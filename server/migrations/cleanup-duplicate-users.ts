/**
 * Cleanup Script: Remove duplicate users created due to Clerk bug
 *
 * This script removes duplicate users that were created because clerkUserId wasn't being saved.
 *
 * Usage:
 *   npx tsx server/migrations/cleanup-duplicate-users.ts
 */

import pg from 'pg';
const { Pool } = pg;

async function cleanupDuplicates() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🚀 Starting cleanup: Remove duplicate users...\n');

    // Find all users with the same email
    const result = await pool.query(`
      SELECT email, array_agg(id ORDER BY created_at) as user_ids, count(*) as count
      FROM users
      GROUP BY email
      HAVING count(*) > 1
    `);

    if (result.rows.length === 0) {
      console.log('✅ No duplicate users found');
      await pool.end();
      return;
    }

    console.log(`Found ${result.rows.length} duplicate email(s)\n`);

    for (const row of result.rows) {
      const email = row.email;
      const userIds = row.user_ids;
      const keepId = userIds[0]; // Keep the first user
      const deleteIds = userIds.slice(1); // Delete the rest

      console.log(`Email: ${email}`);
      console.log(`  Keeping user: ${keepId}`);
      console.log(`  Deleting ${deleteIds.length} duplicate(s): ${deleteIds.join(', ')}`);

      // Delete duplicate users
      await pool.query(`
        DELETE FROM users
        WHERE id = ANY($1)
      `, [deleteIds]);

      console.log(`  ✅ Deleted duplicates\n`);
    }

    console.log('🎉 Cleanup completed successfully!');
  } catch (error: any) {
    console.error('\n❌ Cleanup failed:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

cleanupDuplicates()
  .then(() => {
    console.log('\n✅ Done');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
