import { db } from '../server/db.js';
import { eq } from 'drizzle-orm';
import { adminEmailSettings } from '../shared/schema.js';

async function checkEmailConfig() {
  console.log('🔍 Checking Admin Email Configuration...\n');
  
  try {
    const config = await db.query.adminEmailSettings.findFirst({
      where: eq(adminEmailSettings.isActive, true)
    });
    
    if (!config) {
      console.log('❌ No active email configuration found!');
      console.log('   Please set up email in Admin > Settings > Email');
      process.exit(1);
    }
    
    console.log('✅ Active Email Configuration Found:\n');
    console.log(`   Provider:    ${config.provider}`);
    console.log(`   From Email:  ${config.fromEmail}`);
    console.log(`   From Name:   ${config.fromName}`);
    console.log(`   SMTP Host:   ${config.smtpHost}`);
    console.log(`   SMTP Port:   ${config.smtpPort}`);
    console.log(`   Encryption:  ${config.encryption}`);
    console.log('\n✅ Email system is configured and ready!\n');
    
  } catch (error) {
    console.error('❌ Error checking email config:', error);
    process.exit(1);
  }
}

checkEmailConfig();
