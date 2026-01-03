/**
 * Enterprise System Migration Script
 * Runs the SQL migration against Neon PostgreSQL
 */

import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';

const DATABASE_URL = process.env.DATABASE_URL!;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function runMigration() {
  console.log('🚀 Starting Enterprise System Migration...\n');
  
  const migrationPath = path.join(process.cwd(), 'migrations', '20260102_subscription_fix_fk.sql');
  const migrationContent = fs.readFileSync(migrationPath, 'utf8');
  
  // Split by semicolons but be careful with function bodies
  // We'll split by statement and run them one by one
  const statements = splitSqlStatements(migrationContent);
  
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i].trim();
    if (!stmt || stmt.startsWith('--')) {
      continue;
    }
    
    try {
      // Extract first line for logging
      const firstLine = stmt.split('\n')[0].substring(0, 60);
      process.stdout.write(`[${i + 1}/${statements.length}] ${firstLine}... `);
      
      await sql(stmt);
      console.log('✅');
      successCount++;
    } catch (error: any) {
      // Check if it's a "already exists" error which is fine
      if (error.message?.includes('already exists') || 
          error.message?.includes('duplicate key')) {
        console.log('⏭️ (already exists)');
        skipCount++;
      } else {
        console.log(`❌ ${error.message}`);
        errorCount++;
        
        // Continue with other statements even if one fails
        // (except for critical errors)
        if (error.message?.includes('syntax error')) {
          console.error('\n🛑 Syntax error detected. Stopping migration.');
          break;
        }
      }
    }
  }
  
  console.log('\n========================================');
  console.log('📊 Migration Summary:');
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ⏭️  Skipped (already exists): ${skipCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log('========================================\n');
  
  if (errorCount === 0) {
    console.log('🎉 Enterprise system migration completed successfully!');
  } else {
    console.log('⚠️  Migration completed with some errors. Please review.');
    process.exit(1);
  }
}

/**
 * Split SQL into individual statements, handling:
 * - Multi-line statements
 * - Function/procedure bodies with $$ delimiters
 * - Comments
 * - CREATE TABLE with parentheses and constraints
 */
function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inDollarQuote = false;
  let dollarTag = '';
  let parenDepth = 0;
  
  const lines = sql.split('\n');
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip pure comment lines when not building a statement
    if (trimmedLine.startsWith('--') && current.trim() === '') {
      continue;
    }
    
    // Skip comment-only lines inside statements
    if (trimmedLine.startsWith('--')) {
      current += line + '\n';
      continue;
    }
    
    // Handle $$ dollar-quoted blocks (for functions/triggers)
    const dollarMatches = line.match(/\$\w*\$/g);
    if (dollarMatches) {
      for (const match of dollarMatches) {
        if (!inDollarQuote) {
          inDollarQuote = true;
          dollarTag = match;
        } else if (match === dollarTag) {
          inDollarQuote = false;
          dollarTag = '';
        }
      }
    }
    
    // Track parentheses depth (for CREATE TABLE, function params, etc.)
    if (!inDollarQuote) {
      for (const char of line) {
        if (char === '(') parenDepth++;
        else if (char === ')') parenDepth--;
      }
    }
    
    current += line + '\n';
    
    // Check if statement ends (semicolon at end, not in dollar quote, not in parens)
    if (!inDollarQuote && parenDepth === 0 && trimmedLine.endsWith(';')) {
      const cleanStatement = current.trim();
      // Filter out comment-only blocks
      const withoutComments = cleanStatement.replace(/--.*$/gm, '').trim();
      if (withoutComments && withoutComments !== ';') {
        statements.push(cleanStatement);
      }
      current = '';
    }
  }
  
  // Handle any remaining content
  if (current.trim()) {
    const withoutComments = current.trim().replace(/--.*$/gm, '').trim();
    if (withoutComments) {
      statements.push(current.trim());
    }
  }
  
  return statements;
}

runMigration().catch(console.error);
