#!/usr/bin/env node
/**
 * Remove Clerk Data from Database
 * 
 * This script:
 * 1. Removes all Clerk user IDs from users table
 * 2. Updates auth provider to 'native' for all users
 * 3. Cleans up Clerk-related fields
 * 
 * Safe to run multiple times
 */

import { db } from '../server/db.js';
import { users } from '../shared/schema.js';
import { sql } from 'drizzle-orm';

async function removeClerkData() {
  console.log('🧹 Removing Clerk data from database...\n');

  try {
    // Count users with Clerk data before cleanup
    const beforeCount = await db
      .select({ count: sql`count(*)::int` })
      .from(users)
      .where(sql`clerk_user_id IS NOT NULL`);

    console.log(`📊 Found ${beforeCount[0].count} users with Clerk user IDs`);

    if (beforeCount[0].count === 0) {
      console.log('✅ No Clerk data found. Database is clean!');
      process.exit(0);
    }

    // Update users table - remove Clerk user IDs and update auth provider
    const result = await db
      .update(users)
      .set({
        clerkUserId: null,
        authProvider: 'native',
        // Keep other fields intact
      })
      .where(sql`clerk_user_id IS NOT NULL`);

    console.log(`✅ Cleared Clerk user IDs from ${beforeCount[0].count} users`);
    console.log(`✅ Updated auth provider to 'native' for all affected users`);

    // Verify cleanup
    const afterCount = await db
      .select({ count: sql`count(*)::int` })
      .from(users)
      .where(sql`clerk_user_id IS NOT NULL`);

    if (afterCount[0].count === 0) {
      console.log('\n✨ Database cleanup complete! Clerk data has been removed.');
      console.log('📝 All user authentication is now native (session-based)');
    } else {
      console.log('\n⚠️  Warning: Some Clerk user IDs still remain');
      console.log(`   Remaining count: ${afterCount[0].count}`);
    }

  } catch (error) {
    console.error('❌ Error cleaning up Clerk data:', error);
    process.exit(1);
  }
}

console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║     CLERK DATA REMOVAL SCRIPT                             ║');
console.log('║     Cleaning up Clerk user IDs from database              ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

removeClerkData()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
