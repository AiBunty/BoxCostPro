/**
 * Check columns in subscription-related tables
 */
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function checkColumns() {
  const tables = ['subscription_plans', 'user_subscriptions'];
  
  for (const table of tables) {
    console.log(`\n=== ${table} ===`);
    const columns = await sql`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = ${table} 
      ORDER BY ordinal_position
    `;
    if (columns.length === 0) {
      console.log('  (table does not exist)');
    } else {
      columns.forEach(c => {
        console.log(`  ${c.column_name}: ${c.data_type} ${c.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
      });
    }
  }
  
  // Check what subscription tables are missing
  console.log('\n=== Missing Subscription Tables ===');
  const requiredTables = ['plan_versions', 'subscription_features', 'plan_features', 'subscription_audit_logs', 'subscription_payments', 'subscription_invoices', 'subscription_coupons', 'coupon_usages', 'plan_audit_logs'];
  for (const table of requiredTables) {
    const exists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = ${table}
      )
    `;
    console.log(`  ${table}: ${exists[0].exists ? '✅ exists' : '❌ MISSING'}`);
  }
}

checkColumns().catch(console.error);
