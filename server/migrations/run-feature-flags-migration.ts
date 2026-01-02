#!/usr/bin/env tsx

/**
 * Run Feature Flags and User Email Providers Migration
 * Adds plan-based feature limits, usage tracking, and user-owned providers
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  console.log('🚀 Running Feature Flags & User Email Providers Migration...\n');

  try {
    // Read the migration SQL file
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'add-feature-flags-and-user-providers.sql'),
      'utf-8'
    );

    // Execute the migration
    console.log('📝 Executing migration SQL...');
    await db.execute(sql.raw(migrationSQL));

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📊 Verifying migration results...\n');

    // Verify tables exist
    const tableCheck = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('user_feature_usage', 'user_feature_overrides')
    `);

    console.log(`✓ Tables created: ${JSON.stringify(tableCheck.rows.map((r: any) => r.table_name))}`);

    // Check subscription plans
    const plansCheck = await db.execute(sql`
      SELECT name, plan_tier, 
             features->>'maxEmailProviders' as max_providers
      FROM subscription_plans
    `);

    console.log('\n✓ Subscription Plans:');
    plansCheck.rows.forEach((plan: any) => {
      console.log(`  - ${plan.name} (${plan.plan_tier}): ${plan.max_providers} email providers`);
    });

    // Check user_feature_usage
    const usageCheck = await db.execute(sql`
      SELECT COUNT(*) as count FROM user_feature_usage
    `);

    console.log(`\n✓ User feature usage records: ${usageCheck.rows[0].count}`);

    // Check email_providers for user_id column
    const columnCheck = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'email_providers' 
      AND column_name = 'user_id'
    `);

    console.log(`\n✓ email_providers.user_id column exists: ${columnCheck.rows.length > 0 ? 'Yes' : 'No'}`);

    console.log('\n🎉 Migration verification complete!\n');
    console.log('Next steps:');
    console.log('  1. Users can now add email providers based on their plan limits');
    console.log('  2. Admin can override limits for specific users');
    console.log('  3. Usage is tracked automatically with triggers');
    console.log('  4. Plans enforce: Basic=1, Professional=3, Enterprise=unlimited providers\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration
runMigration()
  .then(() => {
    console.log('Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });
