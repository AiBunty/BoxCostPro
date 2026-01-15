#!/usr/bin/env node
/**
 * Check User Approval Status
 * Diagnose approval issues for specific users
 */

import { db } from '../server/db.js';
import { users } from '../shared/schema.js';
import { eq, or } from 'drizzle-orm';

async function checkUsers() {
  console.log('🔍 Checking user approval status...\n');

  const emails = ['venturapackagers@gmail.com', 'parin11@gmail.com'];

  for (const email of emails) {
    console.log(`\n📧 ${email}`);
    console.log('─'.repeat(50));

    const user = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (user.length === 0) {
      console.log('❌ User not found');
      continue;
    }

    const u = user[0];
    console.log(`Name: ${u.firstName} ${u.lastName}`);
    console.log(`Role: ${u.role} ${u.role !== 'user' ? '⚠️  SHOULD BE "user"' : '✅'}`);
    console.log(`Account Status: ${u.accountStatus}`);
    console.log(`Verification Status: ${u.verificationStatus}`);
    console.log(`Email Verified: ${u.emailVerified}`);
    console.log(`Setup Complete: ${u.isSetupComplete}`);
    console.log(`Submitted for Verification: ${u.submittedForVerificationAt}`);
    console.log(`Approved: ${u.approvedAt ? 'Yes' : 'No'}`);
    console.log(`Approval Note: ${u.approvalNote || 'None'}`);
  }

  // Check all users pending approval
  console.log('\n\n📋 All Users Pending Approval:');
  console.log('═'.repeat(50));

  const pendingUsers = await db
    .select()
    .from(users)
    .where(eq(users.verificationStatus, 'PENDING'));

  if (pendingUsers.length === 0) {
    console.log('✅ No users pending approval');
  } else {
    pendingUsers.forEach(u => {
      console.log(`\n${u.email}`);
      console.log(`  Status: ${u.verificationStatus}`);
      console.log(`  Submitted: ${u.submittedForVerificationAt}`);
      console.log(`  Role: ${u.role}`);
    });
  }
}

checkUsers()
  .then(() => {
    console.log('\n✅ Check complete\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
