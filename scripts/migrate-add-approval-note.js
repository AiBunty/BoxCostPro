/**
 * Adds approval_note column to users table if missing.
 */
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function run() {
  try {
    console.log("Checking approval_note column...");
    const result = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'approval_note'
    `);

    if (result.rows.length > 0) {
      console.log("approval_note already exists. No action needed.");
      process.exit(0);
    }

    console.log("Adding approval_note column to users...");
    await db.execute(sql`ALTER TABLE users ADD COLUMN approval_note text`);
    console.log("✅ approval_note column added successfully.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  }
}

run();
