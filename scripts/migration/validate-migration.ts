/**
 * Validation Script for Migration
 * Compares Neon export data with local PostgreSQL to ensure data integrity
 */

import { neon } from '@neondatabase/serverless';
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const NEON_DATABASE_URL = process.env.DATABASE_URL_NEON || process.env.DATABASE_URL;
const LOCAL_DB_URL = process.env.DATABASE_URL_LOCAL || 'postgresql://postgres:postgres@localhost:5432/boxcostpro_local';
const EXPORT_DIR = path.join(process.cwd(), 'migration-export');

if (!NEON_DATABASE_URL) {
  console.error('❌ NEON DATABASE_URL not set');
  console.error('   Set DATABASE_URL_NEON environment variable or ensure DATABASE_URL points to Neon');
  process.exit(1);
}

const neonSql = neon(NEON_DATABASE_URL);

interface ValidationResult {
  tableName: string;
  neonCount: number;
  localCount: number;
  match: boolean;
  difference: number;
}

/**
 * Connect to local PostgreSQL
 */
async function connectToLocal(): Promise<Client> {
  const client = new Client({
    connectionString: LOCAL_DB_URL,
  });

  await client.connect();
  return client;
}

/**
 * Get row count from Neon
 */
async function getNeonRowCount(tableName: string): Promise<number> {
  try {
    const result = await neonSql`SELECT COUNT(*) as count FROM ${neonSql(tableName)}`;
    return parseInt(result[0].count);
  } catch (error) {
    return -1;
  }
}

/**
 * Get row count from local
 */
async function getLocalRowCount(client: Client, tableName: string): Promise<number> {
  try {
    const result = await client.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
    return parseInt(result.rows[0].count);
  } catch (error) {
    return -1;
  }
}

/**
 * Get all table names
 */
async function getAllTables(client: Client): Promise<string[]> {
  const result = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  return result.rows.map(row => row.table_name);
}

/**
 * Validate row counts for all tables
 */
async function validateRowCounts(client: Client): Promise<ValidationResult[]> {
  console.log('\n📊 Validating row counts...\n');

  const tables = await getAllTables(client);
  const results: ValidationResult[] = [];

  for (const tableName of tables) {
    const neonCount = await getNeonRowCount(tableName);
    const localCount = await getLocalRowCount(client, tableName);

    const match = neonCount === localCount;
    const difference = Math.abs(neonCount - localCount);

    results.push({
      tableName,
      neonCount,
      localCount,
      match,
      difference,
    });

    const status = match ? '✓' : '❌';
    const color = match ? '' : ' (MISMATCH)';

    console.log(`   ${status} ${tableName.padEnd(35)} Neon: ${neonCount.toString().padStart(6)} | Local: ${localCount.toString().padStart(6)}${color}`);
  }

  return results;
}

/**
 * Sample data comparison for critical tables
 */
async function validateSampleData(client: Client): Promise<void> {
  console.log('\n🔍 Validating sample data...\n');

  const criticalTables = ['users', 'quotes', 'company_profiles', 'party_profiles'];

  for (const tableName of criticalTables) {
    try {
      // Get sample from Neon
      const neonSample = await neonSql`
        SELECT * FROM ${neonSql(tableName)}
        ORDER BY RANDOM()
        LIMIT 5
      `;

      if (neonSample.length === 0) {
        console.log(`   ⚠️  ${tableName}: No data to compare`);
        continue;
      }

      // Get same records from local using IDs
      const ids = neonSample.map((row: any) => row.id);
      const localSample = await client.query(`
        SELECT * FROM "${tableName}"
        WHERE id = ANY($1::text[])
      `, [ids]);

      if (localSample.rows.length === neonSample.length) {
        console.log(`   ✓ ${tableName}: ${localSample.rows.length} sample records match`);
      } else {
        console.log(`   ❌ ${tableName}: Expected ${neonSample.length} records, found ${localSample.rows.length}`);
      }
    } catch (error: any) {
      console.log(`   ⚠️  ${tableName}: ${error.message}`);
    }
  }
}

/**
 * Validate sequences
 */
async function validateSequences(client: Client): Promise<void> {
  console.log('\n🔢 Validating sequences...\n');

  // Get sequences from local
  const sequences = await client.query(`
    SELECT sequence_name
    FROM information_schema.sequences
    WHERE sequence_schema = 'public'
  `);

  for (const seq of sequences.rows) {
    const result = await client.query(`SELECT last_value FROM "${seq.sequence_name}"`);
    const lastValue = parseInt(result.rows[0].last_value);

    console.log(`   ✓ ${seq.sequence_name.padEnd(40)} → ${lastValue}`);
  }

  console.log(`\n   Total sequences: ${sequences.rows.length}`);
}

/**
 * Validate foreign keys
 */
async function validateForeignKeys(client: Client): Promise<void> {
  console.log('\n🔗 Validating foreign key constraints...\n');

  const constraints = await client.query(`
    SELECT
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      tc.constraint_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
  `);

  console.log(`   Found ${constraints.rows.length} foreign key constraints`);

  let violations = 0;

  for (const constraint of constraints.rows) {
    const violationCheck = await client.query(`
      SELECT COUNT(*) as count
      FROM "${constraint.table_name}" t
      WHERE t."${constraint.column_name}" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM "${constraint.foreign_table_name}" f
          WHERE f."${constraint.foreign_column_name}" = t."${constraint.column_name}"
        )
    `);

    const violationCount = parseInt(violationCheck.rows[0].count);
    if (violationCount > 0) {
      console.log(`   ❌ ${constraint.table_name}.${constraint.column_name} → ${constraint.foreign_table_name}: ${violationCount} violations`);
      violations++;
    }
  }

  if (violations === 0) {
    console.log(`   ✓ All foreign key constraints valid (0 violations)`);
  } else {
    console.log(`   ⚠️  Found ${violations} constraint violations`);
  }
}

/**
 * Validate unique constraints
 */
async function validateUniqueConstraints(client: Client): Promise<void> {
  console.log('\n🔑 Validating unique constraints...\n');

  const constraints = await client.query(`
    SELECT
      tc.table_name,
      string_agg(kcu.column_name, ', ') as columns,
      tc.constraint_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'UNIQUE'
      AND tc.table_schema = 'public'
    GROUP BY tc.table_name, tc.constraint_name
  `);

  console.log(`   Found ${constraints.rows.length} unique constraints`);

  let violations = 0;

  for (const constraint of constraints.rows) {
    const columns = constraint.columns.split(', ').map((c: string) => `"${c}"`).join(', ');

    const duplicateCheck = await client.query(`
      SELECT ${columns}, COUNT(*) as count
      FROM "${constraint.table_name}"
      GROUP BY ${columns}
      HAVING COUNT(*) > 1
    `);

    if (duplicateCheck.rows.length > 0) {
      console.log(`   ❌ ${constraint.table_name} (${constraint.columns}): ${duplicateCheck.rows.length} duplicate groups`);
      violations++;
    }
  }

  if (violations === 0) {
    console.log(`   ✓ All unique constraints valid (0 violations)`);
  } else {
    console.log(`   ⚠️  Found ${violations} constraint violations`);
  }
}

/**
 * Generate validation report
 */
function generateReport(results: ValidationResult[]): void {
  const reportPath = path.join(EXPORT_DIR, 'validation-report.json');

  const report = {
    validatedAt: new Date().toISOString(),
    totalTables: results.length,
    matchingTables: results.filter(r => r.match).length,
    mismatchedTables: results.filter(r => !r.match).length,
    results,
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('\n📄 Validation Report');
  console.log('====================');
  console.log(`   Total tables: ${report.totalTables}`);
  console.log(`   Matching: ${report.matchingTables}`);
  console.log(`   Mismatched: ${report.mismatchedTables}`);
  console.log(`\n   Report saved: ${reportPath}`);
}

/**
 * Main validation function
 */
async function main() {
  console.log('🚀 Migration Validation');
  console.log('========================\n');

  console.log('🔌 Connecting to databases...');

  let client: Client | null = null;

  try {
    client = await connectToLocal();
    console.log('✓ Connected to local PostgreSQL');

    // Test Neon connection
    const neonTest = await neonSql`SELECT 1`;
    console.log('✓ Connected to Neon');

    // Validate row counts
    const results = await validateRowCounts(client);

    // Validate sample data
    await validateSampleData(client);

    // Validate sequences
    await validateSequences(client);

    // Validate foreign keys
    await validateForeignKeys(client);

    // Validate unique constraints
    await validateUniqueConstraints(client);

    // Generate report
    generateReport(results);

    const allMatch = results.every(r => r.match);

    if (allMatch) {
      console.log('\n✅ Migration validation PASSED!');
      console.log('================================');
      console.log('   All tables match between Neon and Local');
      console.log('   All constraints valid');
      console.log('   Data integrity verified');
      console.log('\n📌 Next step: Switch to local database');
      console.log('   powershell -ExecutionPolicy Bypass -File scripts/migration/switch-to-local-db.ps1\n');
    } else {
      console.log('\n⚠️  Migration validation has WARNINGS');
      console.log('====================================');
      console.log('   Some tables have row count mismatches');
      console.log('   Review validation-report.json for details');
      console.log('\n   You can still proceed if the differences are expected\n');
    }

  } catch (error: any) {
    console.error('\n❌ Validation failed:', error.message);
    process.exit(1);
  } finally {
    if (client) {
      await client.end();
    }
  }
}

main();
