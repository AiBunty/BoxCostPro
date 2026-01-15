#!/usr/bin/env node
/**
 * Fix User Roles and Approval Status
 * 
 * Issues to fix:
 * 1. Users with wrong roles (owner, staff) should be 'user'
 * 2. Users with verificationStatus='PENDING' need accountStatus='verification_pending'
 * 3. Only admins table should have admin/staff roles
 */

import { db } from '../server/db.js';
import { users } from '../shared/schema.js';
import { sql, eq, or, ne } from 'drizzle-orm';

async function fixUserRolesAndApprovals() {
  console.log('🔧 Fixing user approval status...\n');

  try {
    // Fix approval status - Users with verificationStatus='PENDING' need proper accountStatus
    console.log('📝 Fixing approval/verification status...');
    
    const needsFixing = await db
      .select()
      .from(users)
      .where(
        sql`verification_status = 'PENDING' AND (account_status != 'verification_pending' OR submitted_for_verification_at IS NULL)`
      );

    console.log(`   Found ${needsFixing.length} users with mismatched status`);

    if (needsFixing.length > 0) {
      for (const user of needsFixing) {
        console.log(`   Fixing ${user.email}:`);
        console.log(`      accountStatus: ${user.accountStatus} → verification_pending`);
        console.log(`      submittedForVerificationAt: ${user.submittedForVerificationAt || 'null'} → now`);
        console.log(`      role: ${user.role} (kept as-is)`);
      }

      await db
        .update(users)
        .set({
          accountStatus: 'verification_pending',
          submittedForVerificationAt: sql`COALESCE(submitted_for_verification_at, NOW())`,
        })
        .where(
          sql`verification_status = 'PENDING' AND (account_status != 'verification_pending' OR submitted_for_verification_at IS NULL)`
        );

      console.log(`   ✅ Fixed ${needsFixing.length} approval statuses\n`);
    } else {
      console.log('   ✅ All approval statuses are correct\n');
    }

    // Step 3: Show summary
    console.log('📊 Final Summary:');
    console.log('═'.repeat(50));

    const allUsers = await db.select().from(users);
    const roleCount = allUsers.reduce((acc, u) => {
      acc[u.role] = (acc[u.role] || 0) + 1;
      return acc;
    }, {});

    console.log('\nUser Roles:');
    Object.entries(roleCount).forEach(([role, count]) => {
      console.log(`   ${role}: ${count}`);
    });

    const pendingApprovals = await db
      .select()
      .from(users)
      .where(eq(users.accountStatus, 'verification_pending'));

    console.log(`\nPending Approvals: ${pendingApprovals.length}`);
    if (pendingApprovals.length > 0) {
      pendingApprovals.forEach(u => {
        console.log(`   - ${u.email} (submitted: ${u.submittedForVerificationAt || 'now'})`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║     USER APPROVAL STATUS FIX                              ║');
console.log('║     Correcting approval workflow                          ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

fixUserRolesAndApprovals()
  .then(() => {
    console.log('\n✅ All fixes completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
