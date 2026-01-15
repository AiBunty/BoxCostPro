#!/usr/bin/env node
/**
 * Check Email Provider Configuration in Database
 * Run with: npx tsx --env-file=.env scripts/check-email-providers.mjs
 */

import pg from 'pg';

const { Pool } = pg;

async function checkEmailProviders() {
  console.log('\n📧 Email Provider Status Check\n');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const result = await pool.query(`
      SELECT 
        id,
        provider_name as "providerName",
        provider_type as "providerType",
        from_email as "fromEmail",
        smtp_host as "smtpHost",
        smtp_port as "smtpPort",
        smtp_username as "smtpUsername",
        is_active as "isActive",
        is_verified as "isVerified",
        last_test_at as "lastTestAt",
        last_error_message as "lastError",
        consecutive_failures as "failures",
        created_at as "createdAt"
      FROM email_providers
      ORDER BY priority_order, created_at DESC
    `);

    if (result.rows.length === 0) {
      console.log('❌ No email providers configured yet.\n');
      console.log('Add one via the Admin Panel → Email page.\n');
    } else {
      console.log(`Found ${result.rows.length} email provider(s):\n`);
      
      result.rows.forEach((provider, index) => {
        console.log(`${index + 1}. ${provider.providerName}`);
        console.log(`   Email: ${provider.fromEmail}`);
        console.log(`   Type: ${provider.providerType}`);
        console.log(`   SMTP: ${provider.smtpHost}:${provider.smtpPort}`);
        console.log(`   Username: ${provider.smtpUsername}`);
        console.log(`   Status: ${provider.isActive ? '✅ Active' : '⚠️  Inactive'}`);
        console.log(`   Verified: ${provider.isVerified ? '✅ Yes' : '❌ No'}`);
        if (provider.lastTestAt) {
          console.log(`   Last Test: ${new Date(provider.lastTestAt).toLocaleString()}`);
        }
        if (provider.lastError) {
          console.log(`   Last Error: ${provider.lastError}`);
        }
        if (provider.failures > 0) {
          console.log(`   Failures: ${provider.failures}`);
        }
        console.log('');
      });
    }
  } catch (error) {
    console.error('❌ Database error:', error.message);
  } finally {
    await pool.end();
  }
}

checkEmailProviders();
