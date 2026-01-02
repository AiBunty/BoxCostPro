/**
 * Post-Migration Configuration
 * - Promote first user to super_admin
 * - Verify data integrity
 * - Rebuild indexes
 */

import { Client } from 'pg';

const LOCAL_DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/boxcostpro_local';

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
 * Find and promote first user to super_admin
 */
async function promoteFirstUser(client: Client): Promise<void> {
  console.log('\n👑 Promoting first user to super_admin...');

  // Get all users ordered by creation date
  const result = await client.query(`
    SELECT id, email, role, created_at
    FROM users
    ORDER BY created_at ASC
    LIMIT 5
  `);

  if (result.rows.length === 0) {
    console.log('   ⚠️  No users found in database');
    return;
  }

  const firstUser = result.rows[0];

  console.log(`\n   First user found:`);
  console.log(`   ID: ${firstUser.id}`);
  console.log(`   Email: ${firstUser.email}`);
  console.log(`   Current Role: ${firstUser.role}`);
  console.log(`   Created: ${firstUser.created_at}`);

  if (firstUser.role === 'super_admin') {
    console.log('\n   ✓ Already a super_admin, no changes needed');
    return;
  }

  // Update the first user to super_admin
  await client.query(`
    UPDATE users
    SET role = 'super_admin'
    WHERE id = $1
  `, [firstUser.id]);

  console.log('\n   ✓ Successfully promoted to super_admin');

  // Verify the update
  const verification = await client.query(`
    SELECT id, email, role
    FROM users
    WHERE id = $1
  `, [firstUser.id]);

  console.log(`\n   Verification:`);
  console.log(`   Email: ${verification.rows[0].email}`);
  console.log(`   New Role: ${verification.rows[0].role}`);
}

/**
 * Verify foreign key integrity
 */
async function verifyForeignKeys(client: Client): Promise<void> {
  console.log('\n🔍 Verifying foreign key integrity...');

  // Get all foreign key constraints
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
    ORDER BY tc.table_name
  `);

  console.log(`   Found ${constraints.rows.length} foreign key constraints`);

  let violations = 0;

  for (const constraint of constraints.rows) {
    // Check for violations
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
      console.log(`   ❌ Violation in ${constraint.table_name}.${constraint.column_name}: ${violationCount} orphaned rows`);
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
 * Rebuild indexes for optimal performance
 */
async function rebuildIndexes(client: Client): Promise<void> {
  console.log('\n🔨 Rebuilding indexes...');

  // Get all indexes
  const indexes = await client.query(`
    SELECT
      schemaname,
      tablename,
      indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname
  `);

  console.log(`   Found ${indexes.rows.length} indexes`);

  let rebuilt = 0;
  for (const index of indexes.rows) {
    try {
      await client.query(`REINDEX INDEX "${index.indexname}"`);
      rebuilt++;
      process.stdout.write(`\r   Rebuilt ${rebuilt}/${indexes.rows.length} indexes`);
    } catch (error: any) {
      // Some indexes can't be reindexed (primary keys), continue
    }
  }

  console.log(`\r   ✓ Rebuilt ${rebuilt}/${indexes.rows.length} indexes`);
}

/**
 * Update table statistics
 */
async function updateStatistics(client: Client): Promise<void> {
  console.log('\n📊 Updating table statistics...');

  // Get all tables
  const tables = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  for (const table of tables.rows) {
    await client.query(`ANALYZE "${table.table_name}"`);
  }

  console.log(`   ✓ Analyzed ${tables.rows.length} tables`);
}

/**
 * Get database statistics
 */
async function getDatabaseStats(client: Client): Promise<void> {
  console.log('\n📈 Database Statistics:');
  console.log('======================');

  // Get total row counts
  const tables = await client.query(`
    SELECT
      schemaname,
      tablename,
      n_live_tup as row_count
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    ORDER BY n_live_tup DESC
    LIMIT 20
  `);

  console.log('\n   Top 20 Tables by Row Count:');
  for (const table of tables.rows) {
    console.log(`   - ${table.tablename}: ${parseInt(table.row_count).toLocaleString()} rows`);
  }

  // Get database size
  const size = await client.query(`
    SELECT pg_size_pretty(pg_database_size(current_database())) as size
  `);

  console.log(`\n   Database Size: ${size.rows[0].size}`);
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Post-Migration Configuration');
  console.log('================================\n');

  console.log('🔌 Connecting to local PostgreSQL...');

  let client: Client | null = null;

  try {
    client = await connectToDatabase();
    console.log('✓ Connected successfully');

    // Promote first user to super_admin
    await promoteFirstUser(client);

    // Verify foreign key integrity
    await verifyForeignKeys(client);

    // Rebuild indexes
    await rebuildIndexes(client);

    // Update statistics
    await updateStatistics(client);

    // Show database stats
    await getDatabaseStats(client);

    console.log('\n✅ Post-migration configuration complete!');
    console.log('=========================================');
    console.log('\n📌 Next step: Run validation script');
    console.log('   npx tsx scripts/migration/validate-migration.ts\n');

  } catch (error: any) {
    console.error('\n❌ Configuration failed:', error.message);
    process.exit(1);
  } finally {
    if (client) {
      await client.end();
    }
  }
}

main();
