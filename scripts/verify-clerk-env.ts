/**
 * Clerk Environment Variable Verification Script
 * Run with: npx tsx scripts/verify-clerk-env.ts
 * 
 * This script verifies that Clerk authentication is properly configured
 * before starting the application.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const envPath = path.join(projectRoot, '.env');

console.log('🔍 Verifying Clerk Configuration...\n');

// Check if .env exists
if (!fs.existsSync(envPath)) {
  console.error('❌ ERROR: .env file not found!');
  console.error('   Expected location:', envPath);
  console.error('\n📋 Action Required:');
  console.error('   1. Copy .env.example to .env');
  console.error('   2. Add your Clerk keys from https://dashboard.clerk.com\n');
  process.exit(1);
}

// Read .env file
const envContent = fs.readFileSync(envPath, 'utf-8');
const envLines = envContent.split('\n');

// Extract keys
const publishableKeyLine = envLines.find(line => 
  line.trim().startsWith('VITE_CLERK_PUBLISHABLE_KEY=') && !line.trim().startsWith('#')
);
const secretKeyLine = envLines.find(line => 
  line.trim().startsWith('CLERK_SECRET_KEY=') && !line.trim().startsWith('#')
);

const publishableKey = publishableKeyLine?.split('=')[1]?.trim();
const secretKey = secretKeyLine?.split('=')[1]?.trim();

let hasErrors = false;

// Verify Frontend Key (VITE_ prefix required)
console.log('1. Frontend Publishable Key (VITE_CLERK_PUBLISHABLE_KEY):');
if (!publishableKey || publishableKey.length === 0) {
  console.error('   ❌ MISSING or EMPTY');
  console.error('   ⚠️  Frontend will fail to initialize Clerk');
  hasErrors = true;
} else if (!publishableKey.startsWith('pk_test_') && !publishableKey.startsWith('pk_live_')) {
  console.error('   ❌ INVALID FORMAT');
  console.error(`   Found: ${publishableKey.substring(0, 20)}...`);
  console.error('   Expected: pk_test_... or pk_live_...');
  hasErrors = true;
} else {
  console.log(`   ✅ Found: ${publishableKey.substring(0, 25)}...`);
  console.log(`   📍 Type: ${publishableKey.startsWith('pk_test_') ? 'Development' : 'Production'}`);
}

// Verify Backend Key (NO VITE_ prefix)
console.log('\n2. Backend Secret Key (CLERK_SECRET_KEY):');
if (!secretKey || secretKey.length === 0) {
  console.error('   ❌ MISSING or EMPTY');
  console.error('   ⚠️  Backend API calls will fail');
  hasErrors = true;
} else if (!secretKey.startsWith('sk_test_') && !secretKey.startsWith('sk_live_')) {
  console.error('   ❌ INVALID FORMAT');
  console.error(`   Found: ${secretKey.substring(0, 20)}...`);
  console.error('   Expected: sk_test_... or sk_live_...');
  hasErrors = true;
} else {
  console.log(`   ✅ Found: ${secretKey.substring(0, 20)}...`);
  console.log(`   📍 Type: ${secretKey.startsWith('sk_test_') ? 'Development' : 'Production'}`);
}

// Check for common mistakes
console.log('\n3. Common Configuration Issues:');

const wrongPrefix = envLines.find(line => 
  line.trim().startsWith('CLERK_PUBLISHABLE_KEY=') && !line.trim().startsWith('#')
);
if (wrongPrefix) {
  console.error('   ❌ Found: CLERK_PUBLISHABLE_KEY (wrong!)');
  console.error('   ⚠️  Should be: VITE_CLERK_PUBLISHABLE_KEY');
  console.error('   📝 Vite requires VITE_ prefix for frontend env vars');
  hasErrors = true;
} else {
  console.log('   ✅ No CLERK_PUBLISHABLE_KEY found (correct)');
}

const secretWithVite = envLines.find(line => 
  line.trim().startsWith('VITE_CLERK_SECRET_KEY=') && !line.trim().startsWith('#')
);
if (secretWithVite) {
  console.error('   ❌ Found: VITE_CLERK_SECRET_KEY (SECURITY RISK!)');
  console.error('   🚨 Secret keys must NOT have VITE_ prefix');
  console.error('   📝 VITE_ prefix exposes vars to browser!');
  hasErrors = true;
} else {
  console.log('   ✅ Secret key not exposed to frontend (correct)');
}

// Final verdict
console.log('\n' + '='.repeat(60));
if (hasErrors) {
  console.error('❌ CONFIGURATION ERRORS FOUND\n');
  console.error('📋 Required Actions:');
  console.error('   1. Fix the errors listed above in .env');
  console.error('   2. Get correct keys from https://dashboard.clerk.com');
  console.error('   3. Restart dev server after fixing');
  console.error('\n⚠️  IMPORTANT: Vite does NOT hot-reload .env changes!');
  process.exit(1);
} else {
  console.log('✅ CLERK CONFIGURATION VERIFIED\n');
  console.log('🚀 You can now start the dev server with: npm run dev');
  console.log('\n💡 Reminder: Restart dev server if you change .env variables');
}
