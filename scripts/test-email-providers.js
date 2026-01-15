#!/usr/bin/env node
/**
 * Test Email Provider Endpoints
 * Check if email provider endpoints are working
 */

import { db } from '../server/db.js';
import { emailProviders } from '../shared/schema.js';

async function testEmailProviders() {
  console.log('🧪 Testing Email Provider System...\n');

  try {
    // Check database directly
    console.log('1️⃣ Checking database...');
    const providers = await db.select().from(emailProviders);
    console.log(`   Found ${providers.length} email provider(s) in database`);
    
    if (providers.length > 0) {
      console.log('\n   Providers:');
      providers.forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.name} (${p.provider})`);
        console.log(`      - Active: ${p.isActive}`);
        console.log(`      - Primary: ${p.isPrimary}`);
        console.log(`      - Priority: ${p.priorityOrder}`);
        console.log(`      - ID: ${p.id}`);
      });
    } else {
      console.log('\n   ⚠️  No providers found in database');
    }

    // Test the endpoints via HTTP
    console.log('\n2️⃣ Testing HTTP endpoints...');
    
    const endpoints = [
      'http://localhost:5000/api/admin/email/config',
      'http://localhost:5000/api/admin/email/providers',
      'http://localhost:5000/api/admin/email-providers',
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          headers: { 'Cookie': 'admin_session=test' } // This will fail auth but shows if route exists
        });
        console.log(`   ${endpoint.split('/').slice(-2).join('/')}: ${response.status} ${response.statusText}`);
      } catch (error) {
        console.log(`   ${endpoint.split('/').slice(-2).join('/')}: ❌ ${error.message}`);
      }
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  }
}

console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║     EMAIL PROVIDER DIAGNOSTICS                            ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

testEmailProviders()
  .then(() => {
    console.log('\n✅ Diagnostics complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Diagnostics failed:', error);
    process.exit(1);
  });
