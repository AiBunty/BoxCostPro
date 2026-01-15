/**
 * Test script to verify duplicate email validation
 * Tests that the same email address cannot be added twice
 */

const testDuplicateValidation = async () => {
  console.log('🧪 Testing duplicate email validation...\n');

  // Test credentials
  const adminEmail = 'aibuntysystems@gmail.com';
  const adminPassword = 'Admin@2026!Temp';
  const baseUrl = 'http://localhost:5000';

  try {
    // Step 1: Login as admin
    console.log('📝 Step 1: Logging in as admin...');
    const loginResponse = await fetch(`${baseUrl}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
      credentials: 'include',
    });

    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status} ${loginResponse.statusText}`);
    }

    // Get session cookie
    const cookies = loginResponse.headers.get('set-cookie');
    if (!cookies) {
      throw new Error('No session cookie received');
    }
    console.log('✅ Logged in successfully\n');

    // Step 2: Get existing providers
    console.log('📋 Step 2: Checking existing providers...');
    const providersResponse = await fetch(`${baseUrl}/api/admin/email/providers`, {
      headers: { 'Cookie': cookies },
    });

    const providersData = await providersResponse.json();
    const existingProviders = providersData.providers || [];
    console.log(`Found ${existingProviders.length} existing provider(s)`);
    
    if (existingProviders.length > 0) {
      console.log('\nExisting providers:');
      existingProviders.forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.providerName} (${p.fromEmail})`);
      });
    }

    // Use the first existing email or a test email
    const testEmail = existingProviders.length > 0 
      ? existingProviders[0].fromEmail 
      : 'test@example.com';
    
    console.log(`\n🎯 Testing with email: ${testEmail}\n`);

    // Step 3: Try to create a provider with duplicate email
    console.log('🔄 Step 3: Attempting to create provider with duplicate email...');
    const createResponse = await fetch(`${baseUrl}/api/admin/email/providers`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': cookies,
      },
      body: JSON.stringify({
        providerType: 'smtp',
        providerName: 'Test Duplicate Provider',
        fromName: 'Test Sender',
        fromEmail: testEmail, // Using existing email
        connectionType: 'smtp',
        smtpHost: 'smtp.example.com',
        smtpPort: 587,
        smtpUsername: 'test@example.com',
        smtpPassword: 'test-password',
        smtpEncryption: 'tls',
        isActive: true,
        priorityOrder: 100,
      }),
    });

    const createResult = await createResponse.json();

    if (createResponse.status === 400 && createResult.message === 'Email address already exists') {
      console.log('✅ SUCCESS: Duplicate email validation working!');
      console.log(`   Status: ${createResponse.status}`);
      console.log(`   Message: ${createResult.message}`);
      console.log(`   Error: ${createResult.error}`);
      return true;
    } else if (createResponse.status === 201) {
      console.log('⚠️  WARNING: Provider created (validation may not be working)');
      console.log(`   Status: ${createResponse.status}`);
      console.log(`   This means the duplicate validation might not be active yet.`);
      console.log(`   Server may need to be restarted.`);
      return false;
    } else {
      console.log('❌ UNEXPECTED RESPONSE:');
      console.log(`   Status: ${createResponse.status}`);
      console.log(`   Response:`, createResult);
      return false;
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    return false;
  }
};

// Run the test
testDuplicateValidation()
  .then((success) => {
    console.log('\n' + '='.repeat(60));
    if (success) {
      console.log('✅ Duplicate email validation is working correctly!');
    } else {
      console.log('⚠️  Validation test did not pass as expected.');
      console.log('   Make sure the server is restarted after code changes.');
    }
    console.log('='.repeat(60));
  })
  .catch((error) => {
    console.error('\n❌ Test script failed:', error);
    process.exit(1);
  });
