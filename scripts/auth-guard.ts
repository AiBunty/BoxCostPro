#!/usr/bin/env npx tsx
/**
 * AUTH CONTAMINATION GUARD
 * 
 * This script prevents non-Clerk auth code from being introduced.
 * Run as part of CI/CD pipeline or pre-commit hook.
 * 
 * CLERK IS THE ONLY ALLOWED AUTHENTICATION SYSTEM.
 * 
 * Usage: npx tsx scripts/auth-guard.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Forbidden patterns that indicate auth contamination
const FORBIDDEN_PATTERNS = [
  // Supabase auth
  { pattern: /from\s+['"]@supabase\/auth-ui/g, name: 'Supabase Auth UI import' },
  { pattern: /from\s+['"]@supabase\/supabase-js['"]/g, name: 'Supabase JS import' },
  { pattern: /createClient\s*\(\s*SUPABASE_URL/g, name: 'Supabase client creation' },
  { pattern: /supabase\.auth\./g, name: 'Supabase auth method call' },
  
  // Neon Auth
  { pattern: /from\s+['"]@neondatabase\/auth['"]/g, name: 'Neon Auth import' },
  { pattern: /from\s+['"]@neondatabase\/auth-ui['"]/g, name: 'Neon Auth UI import' },
  { pattern: /neon_auth/g, name: 'neon_auth reference' },
  
  // Passport/Replit Auth
  { pattern: /from\s+['"]passport['"]/g, name: 'Passport import' },
  { pattern: /import\s+.*replitAuth/g, name: 'Replit Auth import' },
  { pattern: /setupAuth\s*\(/g, name: 'Replit Auth setup call' },
  
  // Direct Google OAuth (not for email)
  { pattern: /\/auth\/google\/callback/g, name: 'Google OAuth auth callback route' },
  { pattern: /directGoogleOAuth/g, name: 'Direct Google OAuth reference' },
];

// Allowed patterns - these are false positives
const ALLOWED_PATTERNS = [
  /\/api\/email-settings\/google\/callback/, // Google OAuth for EMAIL (not auth)
  /supabaseUserId/, // Database column name (legacy compatibility)
  /neonAuthUserId/, // Database column name (legacy compatibility)
  /\.env\.example/, // Example files documenting deprecated vars
  /auth-guard\.ts/, // This script itself
  /CLERK_/,  // Clerk environment variables
  /@clerk\//,  // Clerk packages
];

// Directories to scan
const SCAN_DIRS = ['client/src', 'server', 'shared'];

// File extensions to check
const FILE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

interface Violation {
  file: string;
  line: number;
  pattern: string;
  content: string;
}

function shouldSkipLine(line: string): boolean {
  return ALLOWED_PATTERNS.some(pattern => pattern.test(line));
}

function scanFile(filePath: string): Violation[] {
  const violations: Violation[] = [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  lines.forEach((line, index) => {
    if (shouldSkipLine(line)) {
      return;
    }
    
    FORBIDDEN_PATTERNS.forEach(({ pattern, name }) => {
      if (pattern.test(line)) {
        violations.push({
          file: filePath,
          line: index + 1,
          pattern: name,
          content: line.trim().substring(0, 100),
        });
      }
      // Reset regex lastIndex for global patterns
      pattern.lastIndex = 0;
    });
  });
  
  return violations;
}

function scanDirectory(dir: string): Violation[] {
  const violations: Violation[] = [];
  
  if (!fs.existsSync(dir)) {
    return violations;
  }
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      // Skip node_modules and other irrelevant dirs
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') {
        continue;
      }
      violations.push(...scanDirectory(fullPath));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (FILE_EXTENSIONS.includes(ext)) {
        violations.push(...scanFile(fullPath));
      }
    }
  }
  
  return violations;
}

function main(): void {
  console.log('🔒 AUTH CONTAMINATION GUARD');
  console.log('===========================\n');
  console.log('Scanning for non-Clerk auth code...\n');
  
  const projectRoot = path.resolve(__dirname, '..');
  let allViolations: Violation[] = [];
  
  for (const scanDir of SCAN_DIRS) {
    const dir = path.join(projectRoot, scanDir);
    console.log(`📂 Scanning ${scanDir}/...`);
    const violations = scanDirectory(dir);
    allViolations.push(...violations);
  }
  
  console.log('');
  
  if (allViolations.length === 0) {
    console.log('✅ NO AUTH CONTAMINATION DETECTED');
    console.log('');
    console.log('Clerk is the ONLY authentication system in use.');
    process.exit(0);
  } else {
    console.log('❌ AUTH CONTAMINATION DETECTED!\n');
    console.log(`Found ${allViolations.length} violation(s):\n`);
    
    allViolations.forEach((v, i) => {
      console.log(`${i + 1}. ${v.file}:${v.line}`);
      console.log(`   Pattern: ${v.pattern}`);
      console.log(`   Content: ${v.content}`);
      console.log('');
    });
    
    console.log('⚠️  CLERK IS THE ONLY ALLOWED AUTHENTICATION SYSTEM');
    console.log('   Remove all Supabase, Neon Auth, Passport, and Google OAuth auth code.');
    console.log('');
    process.exit(1);
  }
}

main();
