import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function addMissingColumns() {
  console.log("Adding missing columns...");
  
  try {
    // Add two_factor_enabled column if it doesn't exist
    await db.execute(sql`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false;
    `);
    console.log("✓ Added two_factor_enabled column");
    
    // Add two_factor_method column if it doesn't exist
    await db.execute(sql`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS two_factor_method VARCHAR;
    `);
    console.log("✓ Added two_factor_method column");
    
    // Add two_factor_verified_at column if it doesn't exist
    await db.execute(sql`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS two_factor_verified_at TIMESTAMP;
    `);
    console.log("✓ Added two_factor_verified_at column");
    
    // Update index names for admin_audit_logs if needed
    await db.execute(sql`
      DROP INDEX IF EXISTS idx_audit_logs_staff;
      DROP INDEX IF EXISTS idx_audit_logs_role;
    `);
    console.log("✓ Cleaned up duplicate indexes");
    
    console.log("\n✅ Database migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

addMissingColumns();
