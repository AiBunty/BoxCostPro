/**
 * Quick Gmail Test
 * Tests the existing Gmail provider in database
 */

import pg from 'pg';
import nodemailer from 'nodemailer';

const { Pool } = pg;

async function testGmailProvider() {
  console.log('\n📧 Testing Gmail Provider\n');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    // Get the Gmail provider
    const result = await pool.query(`
      SELECT * FROM email_providers 
      WHERE provider_type = 'smtp' 
      AND smtp_host = 'smtp.gmail.com'
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      console.log('❌ No Gmail provider found in database.\n');
      return;
    }

    const provider = result.rows[0];
    console.log(`Provider: ${provider.provider_name}`);
    console.log(`Email: ${provider.from_email}`);
    console.log(`Username: ${provider.smtp_username}\n`);

    // Check if password is encrypted
    if (!provider.smtp_password_encrypted) {
      console.log('❌ No SMTP password configured!\n');
      return;
    }

    console.log('⚠️  Password is encrypted in database.');
    console.log('   To test, you need to decrypt it or use the Verify button in UI.\n');
    
    console.log('✅ Quick checks passed:');
    console.log('   • Provider exists in database');
    console.log('   • SMTP credentials are set');
    console.log('   • Host: smtp.gmail.com:587\n');
    
    console.log('🔧 To verify it works:');
    console.log('   1. Open Admin Panel → Email');
    console.log('   2. Click the Verify button (checkmark icon)');
    console.log('   3. Check the toast notification for results\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

testGmailProvider();
