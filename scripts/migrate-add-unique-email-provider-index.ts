import { pool } from '../server/db';

async function main() {
  console.log('🔒 Adding unique index on email_providers.from_email (case-insensitive)...');
  const sql = `
    CREATE UNIQUE INDEX IF NOT EXISTS email_providers_from_email_unique_idx
    ON email_providers ((lower(from_email)));
  `;
  try {
    await pool.query(sql);
    console.log('✅ Unique index created (or already present).');
  } catch (err: any) {
    console.error('❌ Failed to create unique index:', err?.message || err);
    process.exit(1);
  } finally {
    try { await pool.end(); } catch {}
  }
}

main();
