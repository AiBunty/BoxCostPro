import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

let pool: any;
let db: any;

if (!process.env.DATABASE_URL) {
  console.warn("DATABASE_URL not set — running in DB-less test mode. Many features will be disabled.");
  // Provide a minimal in-memory stub for pool and db so the server can start for testing OAuth flows.
  const dummyPool: any = {
    query: async () => ({ rows: [] }),
    // close compatibility
    end: async () => {},
  };

  pool = dummyPool;
  db = {};
} else {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzle(pool, { schema });

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
}

export { pool, db };
