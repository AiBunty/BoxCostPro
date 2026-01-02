#!/usr/bin/env node

/**
 * CI/CD Environment Validation Script
 * 
 * Validates required environment variables before deployment.
 * Exits with code 1 if validation fails, preventing deployment.
 * 
 * Usage:
 *   node scripts/validate-env.js
 *   npm run validate:env
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI color codes for terminal output
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

// Load .env file if it exists (for local validation)
function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env');
  
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim();
          // Only set if not already in process.env (process.env takes precedence)
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    });
    console.log(`${YELLOW}[Info]${RESET} Loaded environment from .env file\n`);
  }
}

// Validate encryption key
function validateEncryptionKey() {
  console.log('Validating EMAIL_SECRET_KEY...');
  
  const encryptionKey = process.env.ENCRYPTION_KEY || process.env.SESSION_SECRET;
  
  if (!encryptionKey) {
    console.error(`\n${'='.repeat(80)}`);
    console.error(`${RED}ERROR: EMAIL_SECRET_KEY required but missing${RESET}`);
    console.error('');
    console.error('Required: ENCRYPTION_KEY or SESSION_SECRET environment variable');
    console.error('Minimum length: 32 characters');
    console.error('');
    console.error('To generate a secure key, run:');
    console.error('  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    console.error('='.repeat(80) + '\n');
    return false;
  }
  
  if (encryptionKey.length < 32) {
    console.error(`\n${'='.repeat(80)}`);
    console.error(`${RED}ERROR: EMAIL_SECRET_KEY too short${RESET}`);
    console.error(`Current length: ${encryptionKey.length} characters`);
    console.error('Minimum required: 32 characters');
    console.error('');
    console.error('To generate a secure key, run:');
    console.error('  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    console.error('='.repeat(80) + '\n');
    return false;
  }
  
  console.log(`${GREEN}✓${RESET} EMAIL_SECRET_KEY present (${encryptionKey.length} characters)\n`);
  return true;
}

// Validate no hardcoded SMTP credentials in source code
function validateNoHardcodedCredentials() {
  console.log('Checking for hardcoded SMTP credentials...');
  
  const dangerousPatterns = [
    /smtp[_-]?password\s*[:=]\s*['"][^'"]+['"]/gi,
    /password\s*[:=]\s*['"](?!.*env\.|.*process\.env)[^'"]{8,}['"]/gi,
  ];
  
  const sourceFiles = [
    'server/services/adminEmailService.ts',
    'server/routes/adminRoutes.ts',
    'server/utils/providerValidation.ts',
  ];
  
  let foundHardcoded = false;
  
  for (const file of sourceFiles) {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      
      for (const pattern of dangerousPatterns) {
        const matches = content.match(pattern);
        if (matches) {
          console.error(`${RED}✗${RESET} Found potential hardcoded credential in ${file}`);
          foundHardcoded = true;
        }
      }
    }
  }
  
  if (foundHardcoded) {
    console.error(`\n${'='.repeat(80)}`);
    console.error(`${RED}ERROR: Hardcoded credentials detected${RESET}`);
    console.error('SMTP passwords must NEVER be hardcoded in source code');
    console.error('Use environment variables or database storage only');
    console.error('='.repeat(80) + '\n');
    return false;
  }
  
  console.log(`${GREEN}✓${RESET} No hardcoded credentials detected\n`);
  return true;
}

// Validate supported provider enums
function validateProviderEnums() {
  console.log('Validating email provider enums...');
  
  const providerValidationPath = path.join(process.cwd(), 'server/utils/providerValidation.ts');
  
  if (!fs.existsSync(providerValidationPath)) {
    console.error(`${RED}✗${RESET} Provider validation file not found: ${providerValidationPath}`);
    return false;
  }
  
  const content = fs.readFileSync(providerValidationPath, 'utf8');
  
  // Check that all required providers are defined
  const requiredProviders = ['gmail', 'zoho', 'outlook', 'yahoo', 'ses', 'custom'];
  const missingProviders = [];
  
  for (const provider of requiredProviders) {
    if (!content.includes(`${provider}:`)) {
      missingProviders.push(provider);
    }
  }
  
  if (missingProviders.length > 0) {
    console.error(`${RED}✗${RESET} Missing provider definitions: ${missingProviders.join(', ')}`);
    console.error(`\n${'='.repeat(80)}`);
    console.error(`${RED}ERROR: Incomplete provider configuration${RESET}`);
    console.error('All supported providers must be defined in PROVIDER_PRESETS');
    console.error('='.repeat(80) + '\n');
    return false;
  }
  
  console.log(`${GREEN}✓${RESET} All required providers defined (${requiredProviders.length} providers)\n`);
  return true;
}

// Main validation
function main() {
  console.log('\n' + '='.repeat(80));
  console.log('CI/CD Environment Validation');
  console.log('='.repeat(80) + '\n');
  
  // Load .env file for local testing
  loadEnvFile();
  
  // Validate required environment variables
  const validationResults = [];
  
  // Check encryption key
  validationResults.push(validateEncryptionKey());
  
  // Check for hardcoded credentials
  validationResults.push(validateNoHardcodedCredentials());
  
  // Validate provider enums
  validationResults.push(validateProviderEnums());
  
  // Summary
  console.log('='.repeat(80));
  const allValid = validationResults.every(result => result === true);
  
  if (allValid) {
    console.log(`${GREEN}✓ All environment validations passed${RESET}`);
    console.log('='.repeat(80) + '\n');
    process.exit(0);
  } else {
    console.log(`${RED}✗ Environment validation failed${RESET}`);
    console.log('='.repeat(80) + '\n');
    process.exit(1);
  }
}

// Run validation
main();
