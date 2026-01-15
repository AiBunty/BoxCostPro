#!/usr/bin/env node
/**
 * Clean up broken email providers
 */

import { db } from '../server/db.js';
import { emailProviders } from '../shared/schema.js';
import { sql } from 'drizzle-orm';

async function cleanupProviders() {
  console.log('🧹 Cleaning up broken email providers...\n');

  try {
    // Delete providers with undefined/null provider_type or provider_name
    const result = await db
      .delete(emailProviders)
      .where(sql`provider_type IS NULL OR provider_name IS NULL`);

    console.log('✅ Deleted broken providers');
    
    // Show remaining providers
    const remaining = await db.select().from(emailProviders);
    console.log(`\n📊 Remaining providers: ${remaining.length}`);
    
    if (remaining.length > 0) {
      remaining.forEach((p, i) => {
        console.log(`\n${i + 1}. ${p.providerName} (${p.providerType})`);
        console.log(`   From: ${p.fromEmail}`);
        console.log(`   Active: ${p.isActive}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

cleanupProviders()
  .then(() => {
    console.log('\n✅ Cleanup complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
