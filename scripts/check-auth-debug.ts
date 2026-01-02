/**
 * Debug script to check company_profiles userId values
 * Run with: npx tsx scripts/check-auth-debug.ts
 */
import { db } from "../server/db";
import { companyProfiles, users } from "@shared/schema";
import { sql } from "drizzle-orm";

async function checkAuthDebug() {
  console.log('=== Auth Debug Check ===\n');

  // Check users table
  console.log('1. Checking users table:');
  const allUsers = await db.select({
    id: users.id,
    email: users.email,
    clerkUserId: users.clerkUserId,
    role: users.role
  }).from(users);

  console.log(`Found ${allUsers.length} users:`);
  allUsers.forEach(u => {
    console.log(`  - ID: ${u.id} | Email: ${u.email} | ClerkID: ${u.clerkUserId} | Role: ${u.role}`);
  });

  console.log('\n2. Checking company_profiles table:');
  const allProfiles = await db.select({
    id: companyProfiles.id,
    userId: companyProfiles.userId,
    companyName: companyProfiles.companyName
  }).from(companyProfiles);

  console.log(`Found ${allProfiles.length} profiles:`);
  allProfiles.forEach(p => {
    const matchingUser = allUsers.find(u => u.id === p.userId);
    console.log(`  - Profile ID: ${p.id}`);
    console.log(`    Company: ${p.companyName}`);
    console.log(`    userId: ${p.userId}`);
    console.log(`    Matches User: ${matchingUser ? `✓ ${matchingUser.email}` : '✗ NO MATCH'}`);
  });

  console.log('\n3. Checking for userId type mismatches:');
  // Check if any profile userId doesn't match any user id (potential Clerk ID stored directly)
  const orphanedProfiles = allProfiles.filter(p => !allUsers.find(u => u.id === p.userId));
  if (orphanedProfiles.length > 0) {
    console.log(`⚠️  Found ${orphanedProfiles.length} profiles with non-matching userId:`);
    orphanedProfiles.forEach(p => {
      console.log(`  - Profile: ${p.companyName} (${p.id})`);
      console.log(`    userId: ${p.userId}`);
      
      // Check if this userId matches any Clerk user ID
      const matchingClerkUser = allUsers.find(u => u.clerkUserId === p.userId);
      if (matchingClerkUser) {
        console.log(`    ⚠️  This is a Clerk User ID! Should be: ${matchingClerkUser.id}`);
      }
    });
  } else {
    console.log('✓ All profiles have valid userId references');
  }

  process.exit(0);
}

checkAuthDebug().catch(console.error);
