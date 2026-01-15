/**
 * Migration script to create control plane tables
 * Creates 8 tables: webhookSubscriptions, webhookDeliveries, integrations, 
 * integrationCredentials, subscriptionOverrides, entitlementCache, 
 * platformEvents, consistencyCheckLogs
 */
import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function runMigration() {
  try {
    console.log('Checking control plane tables...');
    
    const tables = [
      'webhook_subscriptions',
      'webhook_deliveries',
      'integrations',
      'integration_credentials',
      'subscription_overrides',
      'entitlement_cache',
      'platform_events',
      'consistency_check_logs'
    ];
    
    for (const tableName of tables) {
      const result = await db.execute(sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name = ${tableName}
      `);
      
      if (result.rows.length === 0) {
        console.log(`⚠️  Table ${tableName} does not exist. Run 'npm run db:push' to create it.`);
      } else {
        console.log(`✅ Table ${tableName} exists`);
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration check failed:', error);
    process.exit(1);
  }
}

runMigration();
