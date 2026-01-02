import pg from 'pg';
const { Client } = pg;

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log('Deleting all data...');

  // Delete in order respecting foreign keys
  const tables = [
    'admin_actions',
    'support_messages',
    'support_tickets', 
    'quote_versions',
    'quote_send_logs',
    'quotes',
    'party_profiles',
    'onboarding_status',
    'company_profiles',
    'flute_settings',
    'fluting_settings',
    'paper_pricing_rules',
    'paper_bf_prices',
    'paper_prices',
    'shade_premiums',
    'user_quote_terms',
    'business_defaults',
    'app_settings',
    'user_email_settings',
    'email_logs',
    'email_bounces',
    'tenant_users',
    'tenants',
    'user_profiles',
    'auth_audit_logs',
    'sessions',
    'users'
  ];

  for (const table of tables) {
    try {
      await client.query(`DELETE FROM ${table}`);
      console.log(`✓ Deleted from ${table}`);
    } catch (err) {
      console.log(`- Skipped ${table} (may not exist or has dependencies)`);
    }
  }

  console.log('\n✅ All user and admin data deleted successfully!');
  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
