import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const usersResult = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'users'`);
  console.log('Users columns:', usersResult.rows.map(x => x.column_name));
  
  const tenantsResult = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'tenants'`);
  console.log('Tenants columns:', tenantsResult.rows.map(x => x.column_name));
  
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
