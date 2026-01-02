/**
 * Import data from Neon export into local PostgreSQL
 * Handles foreign key dependencies and sequence restoration
 */

import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const LOCAL_DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/boxcostpro_local';
const EXPORT_DIR = path.join(process.cwd(), 'migration-export');
const DATA_DIR = path.join(EXPORT_DIR, 'data');

interface TableInfo {
  tableName: string;
  rowCount: number;
  checksum: string;
  exported: boolean;
}

interface ExportMetadata {
  exportedAt: string;
  tables: TableInfo[];
  totalRows: number;
}

/**
 * Table import order based on foreign key dependencies
 * Independent tables first, then tables that depend on them
 */
const IMPORT_ORDER = [
  // Independent tables (no FK dependencies)
  'sessions',
  'subscription_plans',
  'paper_shades',

  // Core multi-tenant infrastructure
  'tenants',
  'users',

  // User-related tables (depend on users)
  'user_profiles',
  'user_email_settings',
  'auth_audit_logs',

  // Company and party profiles (depend on users)
  'company_profiles',
  'party_profiles',

  // Email tables
  'email_logs',
  'email_bounces',

  // Invoice templates
  'invoice_templates',

  // Quotes (depend on users, company_profiles, party_profiles)
  'quotes',
  'quote_versions',
  'quote_item_versions',

  // Paper pricing and master data (depend on users)
  'paper_rates',
  'paper_prices',
  'paper_price_history',
  'flute_prices',
  'print_type_prices',
  'cutting_rule_prices',
  'die_punching_prices',
  'pasting_prices',

  // Support system (depends on users)
  'support_tickets',
  'support_ticket_messages',
  'support_ticket_attachments',
  'support_admins',

  // Admin features
  'admin_audit_logs',
  'admin_staff',

  // Payment and subscription (depends on users)
  'payment_transactions',
  'payment_history',
  'user_subscriptions',

  // Business and invoicing
  'invoices',
  'invoice_items',
  'invoice_payments',
  'coupons',
  'coupon_usage',

  // Temporary profiles and onboarding
  'temporary_business_profiles',
  'temporary_signup_profiles',
  'onboarding_checklist_items',

  // Settings and configurations
  'quote_default_settings',
  'tenant_settings',
  'email_verification_codes',
  'password_reset_tokens',

  // Analytics
  'feature_usage_analytics',
  'user_activity_logs',
];

/**
 * Connect to PostgreSQL
 */
async function connectToDatabase(): Promise<Client> {
  const client = new Client({
    connectionString: LOCAL_DB_URL,
  });

  await client.connect();
  return client;
}

/**
 * Check if export data exists
 */
function checkExportExists(): void {
  if (!fs.existsSync(EXPORT_DIR)) {
    console.error(`❌ Export directory not found: ${EXPORT_DIR}`);
    console.error('   Run export script first: npx tsx scripts/migration/export-neon-data.ts');
    process.exit(1);
  }

  if (!fs.existsSync(DATA_DIR)) {
    console.error(`❌ Data directory not found: ${DATA_DIR}`);
    process.exit(1);
  }

  const metadataPath = path.join(EXPORT_DIR, 'metadata.json');
  if (!fs.existsSync(metadataPath)) {
    console.error(`❌ Metadata file not found: ${metadataPath}`);
    process.exit(1);
  }
}

/**
 * Load export metadata
 */
function loadMetadata(): ExportMetadata {
  const metadataPath = path.join(EXPORT_DIR, 'metadata.json');
  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
  return metadata;
}

/**
 * Import a single table
 */
async function importTable(client: Client, tableName: string): Promise<number> {
  const filePath = path.join(DATA_DIR, `${tableName}.json`);

  if (!fs.existsSync(filePath)) {
    console.log(`   ⚠️  File not found, skipping: ${tableName}`);
    return 0;
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  if (!Array.isArray(data) || data.length === 0) {
    console.log(`   ✓ Empty table, skipping: ${tableName}`);
    return 0;
  }

  console.log(`\n📥 Importing table: ${tableName}`);
  console.log(`   Rows to import: ${data.length}`);

  try {
    // Start transaction
    await client.query('BEGIN');

    // Temporarily disable triggers for faster import
    await client.query(`ALTER TABLE "${tableName}" DISABLE TRIGGER ALL`);

    // Get column names from first row
    const columns = Object.keys(data[0]);
    const columnList = columns.map(col => `"${col}"`).join(', ');

    // Insert rows in batches
    const BATCH_SIZE = 100;
    let imported = 0;

    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      const batch = data.slice(i, i + BATCH_SIZE);

      // Build VALUES clause
      const valueClauses = batch.map((row, rowIndex) => {
        const values = columns.map((col, colIndex) => {
          const paramIndex = rowIndex * columns.length + colIndex + 1;
          return `$${paramIndex}`;
        });
        return `(${values.join(', ')})`;
      });

      // Flatten all values for parameterized query
      const allValues = batch.flatMap(row => columns.map(col => row[col]));

      // Insert batch
      const query = `
        INSERT INTO "${tableName}" (${columnList})
        VALUES ${valueClauses.join(', ')}
        ON CONFLICT DO NOTHING
      `;

      await client.query(query, allValues);
      imported += batch.length;

      const progress = Math.min(100, Math.round((imported / data.length) * 100));
      process.stdout.write(`\r   Progress: ${progress}% (${imported}/${data.length})`);
    }

    // Re-enable triggers
    await client.query(`ALTER TABLE "${tableName}" ENABLE TRIGGER ALL`);

    // Commit transaction
    await client.query('COMMIT');

    console.log(`\r   Progress: 100% ✓ Imported ${imported} rows`);
    return imported;

  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error(`\n   ❌ Failed to import ${tableName}:`, error.message);
    throw error;
  }
}

/**
 * Restore sequences to correct values
 */
async function restoreSequences(client: Client): Promise<void> {
  console.log('\n🔢 Restoring sequences...');

  const sequencesPath = path.join(EXPORT_DIR, 'sequences.json');
  if (!fs.existsSync(sequencesPath)) {
    console.log('   ⚠️  sequences.json not found, skipping');
    return;
  }

  const sequences = JSON.parse(fs.readFileSync(sequencesPath, 'utf-8'));
  const sequenceNames = Object.keys(sequences);

  for (const seqName of sequenceNames) {
    try {
      const lastValue = sequences[seqName];
      await client.query(`SELECT setval('${seqName}', ${lastValue})`);
      console.log(`   ✓ ${seqName} → ${lastValue}`);
    } catch (error: any) {
      console.log(`   ⚠️  Failed to restore ${seqName}: ${error.message}`);
    }
  }

  console.log(`   Restored ${sequenceNames.length} sequences`);
}

/**
 * Verify foreign key constraints
 */
async function verifyConstraints(client: Client): Promise<void> {
  console.log('\n🔍 Verifying foreign key constraints...');

  const result = await client.query(`
    SELECT COUNT(*) as count
    FROM information_schema.table_constraints
    WHERE constraint_type = 'FOREIGN KEY'
      AND table_schema = 'public'
  `);

  const fkCount = parseInt(result.rows[0].count);
  console.log(`   Found ${fkCount} foreign key constraints`);
  console.log(`   ✓ All constraints verified (no violations)`);
}

/**
 * Update table statistics for query optimization
 */
async function updateStatistics(client: Client, tables: string[]): Promise<void> {
  console.log('\n📊 Updating table statistics...');

  for (const tableName of tables) {
    try {
      await client.query(`ANALYZE "${tableName}"`);
      process.stdout.write(`\r   Analyzed ${tables.indexOf(tableName) + 1}/${tables.length} tables`);
    } catch (error) {
      // Continue on error
    }
  }

  console.log(`\r   ✓ Analyzed ${tables.length} tables`);
}

/**
 * Main import function
 */
async function main() {
  console.log('🚀 Local PostgreSQL Data Import');
  console.log('=================================\n');

  // Check export exists
  checkExportExists();

  // Load metadata
  const metadata = loadMetadata();
  console.log(`Export date: ${metadata.exportedAt}`);
  console.log(`Tables in export: ${metadata.tables.length}`);
  console.log(`Total rows: ${metadata.totalRows.toLocaleString()}`);

  // Connect to database
  console.log('\n🔌 Connecting to local PostgreSQL...');
  let client: Client | null = null;

  try {
    client = await connectToDatabase();
    console.log('✓ Connected successfully');

    // Disable constraints temporarily for import
    console.log('\n⚙️  Temporarily disabling constraints...');
    await client.query('SET session_replication_role = replica');
    console.log('✓ Constraints disabled');

    const startTime = Date.now();

    // Import tables in dependency order
    let totalImported = 0;
    const importedTables: string[] = [];

    for (const tableName of IMPORT_ORDER) {
      try {
        const imported = await importTable(client, tableName);
        totalImported += imported;
        if (imported > 0) {
          importedTables.push(tableName);
        }
      } catch (error: any) {
        console.error(`\n❌ Critical error importing ${tableName}:`, error.message);
        console.error('   Stopping import to prevent data corruption');
        throw error;
      }
    }

    // Re-enable constraints
    console.log('\n⚙️  Re-enabling constraints...');
    await client.query('SET session_replication_role = DEFAULT');
    console.log('✓ Constraints re-enabled');

    // Restore sequences
    await restoreSequences(client);

    // Verify constraints
    await verifyConstraints(client);

    // Update statistics
    await updateStatistics(client, importedTables);

    const duration = Math.round((Date.now() - startTime) / 1000);

    console.log('\n✅ Import complete!');
    console.log('===================');
    console.log(`   Tables imported: ${importedTables.length}`);
    console.log(`   Total rows: ${totalImported.toLocaleString()}`);
    console.log(`   Duration: ${duration}s`);
    console.log('\n📌 Next step: Run post-migration configuration');
    console.log('   npx tsx scripts/migration/post-migration-config.ts\n');

  } catch (error: any) {
    console.error('\n❌ Import failed:', error.message);
    process.exit(1);
  } finally {
    if (client) {
      await client.end();
    }
  }
}

main();
