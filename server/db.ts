import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

// Create partial unique index to ensure only one owner exists
// This prevents race conditions in first-user-becomes-owner logic
pool.query(`
  CREATE UNIQUE INDEX IF NOT EXISTS users_single_owner_idx 
  ON users (role) 
  WHERE role = 'owner'
`).catch(err => {
  // Index may already exist or table doesn't exist yet - safe to ignore
  console.log('Owner index creation note:', err.message);
});
