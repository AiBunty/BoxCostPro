import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_9PQRYKM3gBVH@ep-shiny-hill-ahld3t7l-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

try {
  await client.connect();
  console.log('✅ Connected to database\n');

  // Check table structure
  const tableRes = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'admin_email_settings' 
    ORDER BY ordinal_position
  `);
  
  console.log('=== TABLE STRUCTURE ===\n');
  tableRes.rows.forEach(row => {
    console.log(`${row.column_name}: ${row.data_type}`);
  });

  console.log('\n=== EMAIL PROVIDERS TABLE STRUCTURE ===\n');
  
  const provTableRes = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'email_providers' 
    ORDER BY ordinal_position
  `);
  
  provTableRes.rows.forEach(row => {
    console.log(`${row.column_name}: ${row.data_type}`);
  });

  console.log('\n=== EMAIL PROVIDERS (Data) ===\n');
  
  // Check email providers
  const provRes = await client.query('SELECT * FROM email_providers ORDER BY created_at DESC LIMIT 10');
  
  if (provRes.rows.length === 0) {
    console.log('❌ No email providers configured!');
  } else {
    console.log(`✅ Found ${provRes.rows.length} email provider(s)\n`);
    provRes.rows.forEach((row, i) => {
      console.log(`${i + 1}. ${row.provider_type.toUpperCase()}`);
      console.log(`   Name: ${row.provider_name}`);
      console.log(`   From: ${row.from_name} <${row.from_email}>`);
      console.log(`   User: ${row.user_id || 'System/Admin'}`);
      console.log(`   Active: ${row.is_active ? '✅ YES' : '❌ NO'}`);
      console.log(`   Verified: ${row.is_verified ? '✅ YES' : '❌ NO'}`);
      console.log(`   Created: ${new Date(row.created_at).toLocaleString()}\n`);
    });
  }

  await client.end();
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
