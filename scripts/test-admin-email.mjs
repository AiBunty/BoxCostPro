/**
 * Test Admin Email Configuration
 * Checks if admin email is configured and sends test to parin11@gmail.com
 */

import { db } from '../server/db.ts';
import { adminEmailSettings } from '../shared/schema.ts';
import { eq } from 'drizzle-orm';
import { sendSystemEmailAsync } from '../server/services/adminEmailService.ts';
import { createStorage } from '../server/storage.ts';

async function testAdminEmail() {
  try {
    console.log('🔍 Checking admin email configuration...\n');
    
    // Get active email settings
    const settings = await db.select()
      .from(adminEmailSettings)
      .where(eq(adminEmailSettings.isActive, true))
      .limit(1);
    
    if (settings.length === 0) {
      console.log('❌ No active admin email configuration found!');
      console.log('\nPlease configure admin email in the Admin Panel:');
      console.log('   Admin Panel → Settings → Email Configuration');
      console.log('\nSupported providers: Gmail, Zoho, Outlook, Yahoo, AWS SES, Custom SMTP\n');
      process.exit(1);
    }
    
    const config = settings[0];
    console.log('✅ Active Email Configuration Found:');
    console.log(`   Provider: ${config.provider}`);
    console.log(`   From: ${config.fromName} <${config.fromEmail}>`);
    console.log(`   SMTP Host: ${config.smtpHost}`);
    console.log(`   SMTP Port: ${config.smtpPort}`);
    console.log(`   Encryption: ${config.encryption}`);
    console.log(`   Status: ${config.isActive ? 'Active ✓' : 'Inactive'}\n`);
    
    // Send test email
    console.log('📧 Sending test email to parin11@gmail.com...\n');
    
    const storage = createStorage();
    const result = await sendSystemEmailAsync(storage, {
      to: 'parin11@gmail.com',
      subject: '✅ BoxCostPro Email Test - Success!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #10b981;">Email Configuration Test Successful! 🎉</h2>
          <p>This test email confirms that your admin email system is working correctly.</p>
          
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #374151;">System Details:</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 5px 0;"><strong>Provider:</strong></td><td>${config.provider}</td></tr>
              <tr><td style="padding: 5px 0;"><strong>From:</strong></td><td>${config.fromName} &lt;${config.fromEmail}&gt;</td></tr>
              <tr><td style="padding: 5px 0;"><strong>Test Date:</strong></td><td>${new Date().toLocaleString()}</td></tr>
              <tr><td style="padding: 5px 0;"><strong>Recipient:</strong></td><td>parin11@gmail.com</td></tr>
            </table>
          </div>
          
          <p style="color: #10b981; font-weight: bold; font-size: 18px;">✓ Email system verified and operational!</p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
          
          <p style="color: #6b7280; font-size: 14px;">
            This is an automated test email from BoxCostPro Admin Panel.<br/>
            If you received this, the email configuration is working perfectly.
          </p>
        </div>
      `,
      text: `BoxCostPro Email Test - Success!\n\nThis test email confirms that your admin email system is working correctly.\n\nProvider: ${config.provider}\nFrom: ${config.fromName} <${config.fromEmail}>\nTest Date: ${new Date().toLocaleString()}\nRecipient: parin11@gmail.com\n\n✓ Email system verified and operational!`,
      emailType: 'system_test',
      relatedEntityType: 'system',
      relatedEntityId: 'test',
    });
    
    if (result.success) {
      console.log('✅ SUCCESS! Test email sent to parin11@gmail.com');
      console.log('\nPlease check the inbox (and spam folder) for the test email.\n');
    } else {
      console.log('❌ FAILED to send test email');
      console.log(`Error: ${result.error}\n`);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

testAdminEmail();
