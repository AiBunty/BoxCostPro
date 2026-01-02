import { db } from "../db";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  console.log("🚀 Starting payment gateways migration...\n");

  try {
    // Read the SQL file
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, "add-payment-gateways.sql"),
      "utf-8"
    );

    // Execute the migration
    await db.execute(sql.raw(migrationSQL));
    console.log("✅ Migration SQL executed successfully!\n");

    // Verify the migration
    console.log("🔍 Verifying migration...\n");

    // Check if table exists
    const tableCheck = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'payment_gateways'
      ) as exists;
    `);
    console.log(`✓ payment_gateways table exists: ${tableCheck.rows[0]?.exists ? 'Yes' : 'No'}`);

    // Check inserted gateways
    const gatewaysResult = await db.execute(sql`
      SELECT gateway_type, gateway_name, is_active, priority, environment
      FROM payment_gateways
      ORDER BY priority ASC;
    `);

    console.log(`✓ Payment Gateways configured: ${gatewaysResult.rows.length}`);
    gatewaysResult.rows.forEach((gateway: any) => {
      const status = gateway.is_active ? '🟢 Active' : '🔴 Inactive';
      console.log(`  ${status} - ${gateway.gateway_name} (${gateway.gateway_type}) [Priority: ${gateway.priority}, Env: ${gateway.environment}]`);
    });

    // Check indexes
    const indexCheck = await db.execute(sql`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'payment_gateways';
    `);
    console.log(`\n✓ Indexes created: ${indexCheck.rows.length}`);
    indexCheck.rows.forEach((index: any) => {
      console.log(`  - ${index.indexname}`);
    });

    console.log("\n🎉 Payment gateways migration completed successfully!");
    console.log("\n📝 Next steps:");
    console.log("  1. Configure gateway credentials via admin UI or environment variables");
    console.log("  2. Test gateway connections");
    console.log("  3. Enable gateways for production");
    console.log("  4. Monitor gateway health and failover behavior\n");

  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }
}

// Run the migration
runMigration()
  .then(() => {
    console.log("✨ Migration script completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Migration script failed:", error);
    process.exit(1);
  });
