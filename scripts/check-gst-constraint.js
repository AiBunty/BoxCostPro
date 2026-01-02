import pg from 'pg';
const { Client } = pg;

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  // Check all constraints
  const constraints = await client.query(`
    SELECT conname, contype 
    FROM pg_constraint 
    WHERE conrelid = 'company_profiles'::regclass
  `);
  console.log('Constraints:', constraints.rows);

  // Check all indexes with gst in name
  const indexes = await client.query(`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = 'company_profiles'
  `);
  console.log('Indexes:', indexes.rows);

  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
