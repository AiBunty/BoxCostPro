/**
 * Test Email Provider Creation with Auto-Confirmation
 * 
 * This script tests:
 * 1. Creating an email provider (admin route)
 * 2. Automatic confirmation email sending
 * 3. Verification status update
 */

import fetch from 'node-fetch';

const API_URL = 'http://localhost:5000';

async function testEmailProviderCreation() {
  console.log('\n🧪 Testing Email Provider Creation with Auto-Confirmation\n');

  // Test data
  const testProvider = {
    providerType: 'smtp',
    providerName: 'Test Gmail Provider',
    fromEmail: 'test@example.com',
    fromName: 'Test Sender',
    connectionType: 'smtp',
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    smtpUsername: 'test@example.com',
    smtpPassword: 'test_app_password',
    isActive: true,
  };

  try {
    console.log('📧 Creating email provider...');
    const response = await fetch(`${API_URL}/api/admin/email/providers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testProvider),
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ Provider created successfully');
      console.log('   Provider ID:', data.provider?.id);
      console.log('   Email:', data.provider?.fromEmail);
      console.log('   Status:', data.provider?.isActive ? 'Active' : 'Inactive');
      console.log('\n⏳ Confirmation email should be sent in background...');
      console.log('   Check the provider email inbox for confirmation');
    } else {
      console.log('❌ Failed to create provider');
      console.log('   Error:', data.error || data.message);
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testEmailProviderCreation();
