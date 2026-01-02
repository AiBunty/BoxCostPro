/**
 * Export all data from Neon PostgreSQL to local JSON files
 * This script extracts all table data, sequences, and constraints for migration
 */

import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

const NEON_DATABASE_URL = process.env.DATABASE_URL;
const EXPORT_DIR = path.join(process.cwd(), 'migration-export');
const DATA_DIR = path.join(EXPORT_DIR, 'data');
const BATCH_SIZE = 1000;

if (!NEON_DATABASE_URL) {
  console.error('❌ DATABASE_URL not set in environment');
  process.exit(1);
}

const sql = neon(NEON_DATABASE_URL);

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
  databaseUrl: string;
}

/**
 * Get all table names from the database
 */
async function getAllTables(): Promise<string[]> {
  const result = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;

  return result.map((row: any) => row.table_name);
}

/**
 * Get row count for a table
 */
async function getRowCount(tableName: string): Promise<number> {
  const result = await sql`
    SELECT COUNT(*) as count
    FROM ${sql(tableName)}
  `;

  return parseInt(result[0].count);
}

/**
 * Export table data in batches
 */
async function exportTable(tableName: string): Promise<TableInfo> {
  console.log(`\n📊 Exporting table: ${tableName}`);

  const rowCount = await getRowCount(tableName);
  console.log(`   Rows: ${rowCount}`);

  if (rowCount === 0) {
    const tableInfo: TableInfo = {
      tableName,
      rowCount: 0,
      checksum: '',
      exported: true
    };

    // Save empty array
    const filePath = path.join(DATA_DIR, `${tableName}.json`);
    fs.writeFileSync(filePath, JSON.stringify([], null, 2));

    return tableInfo;
  }

  // Export in batches
  const allRows: any[] = [];
  let offset = 0;

  while (offset < rowCount) {
    const batchRows = await sql`
      SELECT * FROM ${sql(tableName)}
      ORDER BY 1
      LIMIT ${BATCH_SIZE}
      OFFSET ${offset}
    `;

    allRows.push(...batchRows);
    offset += BATCH_SIZE;

    const progress = Math.min(100, Math.round((offset / rowCount) * 100));
    process.stdout.write(`\r   Progress: ${progress}%`);
  }

  console.log(`\r   Progress: 100% ✓`);

  // Calculate checksum
  const dataString = JSON.stringify(allRows);
  const checksum = createHash('md5').update(dataString).digest('hex');

  // Save to file
  const filePath = path.join(DATA_DIR, `${tableName}.json`);
  fs.writeFileSync(filePath, JSON.stringify(allRows, null, 2));

  console.log(`   Saved: ${filePath}`);
  console.log(`   Checksum: ${checksum}`);

  return {
    tableName,
    rowCount: allRows.length,
    checksum,
    exported: true
  };
}

/**
 * Export all sequence current values
 */
async function exportSequences(): Promise<void> {
  console.log('\n🔢 Exporting sequences...');

  const sequences = await sql`
    SELECT sequence_name, last_value
    FROM information_schema.sequences
    WHERE sequence_schema = 'public'
  `;

  const sequenceValues: Record<string, number> = {};

  for (const seq of sequences as any[]) {
    const result = await sql`SELECT last_value FROM ${sql(seq.sequence_name)}`;
    sequenceValues[seq.sequence_name] = parseInt(result[0].last_value);
  }

  const filePath = path.join(EXPORT_DIR, 'sequences.json');
  fs.writeFileSync(filePath, JSON.stringify(sequenceValues, null, 2));

  console.log(`   Saved ${Object.keys(sequenceValues).length} sequences`);
  console.log(`   File: ${filePath}`);
}

/**
 * Export foreign key constraints
 */
async function exportConstraints(): Promise<void> {
  console.log('\n🔗 Exporting foreign key constraints...');

  const constraints = await sql`
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
    ORDER BY tc.table_name, kcu.column_name
  `;

  const filePath = path.join(EXPORT_DIR, 'constraints.json');
  fs.writeFileSync(filePath, JSON.stringify(constraints, null, 2));

  console.log(`   Saved ${constraints.length} foreign keys`);
  console.log(`   File: ${filePath}`);
}

/**
 * Main export function
 */
async function main() {
  console.log('🚀 Neon PostgreSQL Data Export');
  console.log('================================\n');
  console.log(`Export directory: ${EXPORT_DIR}`);

  // Create directories
  if (fs.existsSync(EXPORT_DIR)) {
    console.log('\n⚠️  Export directory already exists. Previous export will be overwritten.');
  }

  fs.mkdirSync(EXPORT_DIR, { recursive: true });
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const startTime = Date.now();

  try {
    // Get all tables
    const tables = await getAllTables();
    console.log(`\n📋 Found ${tables.length} tables to export`);

    // Export each table
    const tableInfos: TableInfo[] = [];
    let totalRows = 0;

    for (const tableName of tables) {
      const tableInfo = await exportTable(tableName);
      tableInfos.push(tableInfo);
      totalRows += tableInfo.rowCount;
    }

    // Export sequences
    await exportSequences();

    // Export constraints
    await exportConstraints();

    // Save metadata
    const metadata: ExportMetadata = {
      exportedAt: new Date().toISOString(),
      tables: tableInfos,
      totalRows,
      databaseUrl: NEON_DATABASE_URL.replace(/:[^:@]+@/, ':***@') // Mask password
    };

    const metadataPath = path.join(EXPORT_DIR, 'metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    const duration = Math.round((Date.now() - startTime) / 1000);

    console.log('\n✅ Export complete!');
    console.log('===================');
    console.log(`   Tables exported: ${tableInfos.length}`);
    console.log(`   Total rows: ${totalRows.toLocaleString()}`);
    console.log(`   Duration: ${duration}s`);
    console.log(`   Location: ${EXPORT_DIR}`);
    console.log('\n📁 Exported files:');
    console.log(`   - metadata.json (export summary)`);
    console.log(`   - sequences.json (sequence values)`);
    console.log(`   - constraints.json (foreign keys)`);
    console.log(`   - data/*.json (${tableInfos.length} table data files)`);

  } catch (error) {
    console.error('\n❌ Export failed:', error);
    process.exit(1);
  }
}

main();
