#!/usr/bin/env node
/**
 * Email Configuration Diagnostics
 * Run this to check if your email provider can send emails
 */

import 'dotenv/config';
import nodemailer from 'nodemailer';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function testEmailConfig() {
  console.log('\n📧 Email Configuration Test\n');
  console.log('This will test your SMTP configuration by sending a test email.\n');

  try {
    const host = await question('SMTP Host (e.g., smtp.gmail.com): ');
    const port = await question('SMTP Port (default 587): ') || '587';
    const username = await question('SMTP Username (email): ');
    const password = await question('SMTP Password (or App Password): ');
    const fromEmail = await question('From Email (same as username): ') || username;
    const toEmail = await question('Test recipient email: ');

    console.log('\n🔄 Testing connection...\n');

    const transporter = nodemailer.createTransport({
      host: host.trim(),
      port: parseInt(port),
      secure: false, // Use TLS
      auth: {
        user: username.trim(),
        pass: password.trim(),
      },
      tls: {
        rejectUnauthorized: false, // Allow self-signed certs
      },
    });

    // Test connection
    console.log('1️⃣ Verifying SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection successful!\n');

    // Send test email
    console.log('2️⃣ Sending test email...');
    const info = await transporter.sendMail({
      from: `"BoxCostPro Test" <${fromEmail.trim()}>`,
      to: toEmail.trim(),
      subject: '✅ BoxCostPro Email Test - Success!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px;">
            <h1 style="margin: 0;">✅ Email Test Successful!</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; margin-top: 20px; border-radius: 8px;">
            <p>Great news! Your email configuration is working correctly.</p>
            <p><strong>From:</strong> ${fromEmail}</p>
            <p><strong>SMTP Host:</strong> ${host}</p>
            <p><strong>Port:</strong> ${port}</p>
            <p>You can now use this configuration in BoxCostPro.</p>
          </div>
        </div>
      `,
      text: `Email Test Successful!\n\nYour email configuration is working.\nFrom: ${fromEmail}\nSMTP Host: ${host}\nPort: ${port}`,
    });

    console.log('✅ Test email sent successfully!\n');
    console.log('📬 Message ID:', info.messageId);
    console.log('📧 Check your inbox at:', toEmail);
    console.log('\n✨ Your configuration works! You can now add it to BoxCostPro.\n');

  } catch (error) {
    console.error('\n❌ Test failed!\n');
    console.error('Error:', error.message);
    
    if (error.message.includes('Invalid login')) {
      console.error('\n💡 Hint: Check your username and password.');
      console.error('   For Gmail, use an App Password (not your regular password).');
    } else if (error.message.includes('ENOTFOUND')) {
      console.error('\n💡 Hint: SMTP host not found. Check the hostname.');
    } else if (error.message.includes('ECONNREFUSED')) {
      console.error('\n💡 Hint: Connection refused. Check the port number.');
    }
    
    console.error('\n');
  } finally {
    rl.close();
  }
}

testEmailConfig();
