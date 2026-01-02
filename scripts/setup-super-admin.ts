/**
 * Setup Super Admin Script
 * Sets aibuntysystems@gmail.com as super_admin and removes from tenant/user tables
 * This user is admin-only, not a tenant user
 */

import pg from 'pg';
const { Pool } = pg;

const SUPER_ADMIN_EMAIL = 'aibuntysystems@gmail.com';

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔧 Setting up Super Admin...\n');

    // 1. Check current state
    console.log('📋 Current state:');
    const userCheck = await pool.query(
      'SELECT id, email, role, clerk_user_id FROM users WHERE email = $1',
      [SUPER_ADMIN_EMAIL]
    );
    console.log('Users:', userCheck.rows);

    const tenantCheck = await pool.query(
      `SELECT t.id, t.business_name, t.owner_user_id 
       FROM tenants t 
       INNER JOIN users u ON t.owner_user_id = u.id 
       WHERE u.email = $1`,
      [SUPER_ADMIN_EMAIL]
    );
    console.log('Tenants:', tenantCheck.rows);

    if (userCheck.rows.length === 0) {
      console.log('\n❌ User not found in database. Please login first to create the user record.');
      return;
    }

    const user = userCheck.rows[0];
    console.log(`\n📊 Current user role: ${user.role}`);

    // 2. Update user to super_admin
    console.log('\n🔄 Updating user to super_admin...');
    await pool.query(
      `UPDATE users 
       SET role = 'super_admin', 
           updated_at = NOW()
       WHERE email = $1`,
      [SUPER_ADMIN_EMAIL]
    );
    console.log('✅ User updated to super_admin');

    // 3. Delete any tenant owned by this user (with cascading cleanup)
    if (tenantCheck.rows.length > 0) {
      console.log('\n🗑️ Removing tenant associations...');
      
      // Get the user id and tenant id
      const userId = userCheck.rows[0].id;
      const tenantId = tenantCheck.rows[0].id;
      
      // Find all tables that reference tenants
      const fkResult = await pool.query(`
        SELECT DISTINCT tc.table_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu 
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_name = 'tenants'
          AND ccu.column_name = 'id'
      `);
      
      console.log('  - Tables referencing tenants:', fkResult.rows.map(r => r.table_name));
      
      // Delete from each table
      for (const row of fkResult.rows) {
        console.log(`  - Deleting from ${row.table_name}...`);
        await pool.query(`DELETE FROM ${row.table_name} WHERE ${row.column_name} = $1`, [tenantId]);
      }
      
      // Finally delete the tenant
      console.log('  - Deleting tenant...');
      await pool.query(
        'DELETE FROM tenants WHERE owner_user_id = $1',
        [userId]
      );
      console.log('✅ Deleted tenant and all related data');
    }

    // 4. Verify final state
    console.log('\n📋 Final state:');
    const finalUser = await pool.query(
      'SELECT id, email, role, clerk_user_id FROM users WHERE email = $1',
      [SUPER_ADMIN_EMAIL]
    );
    console.log('User:', finalUser.rows);

    const finalTenant = await pool.query(
      `SELECT t.id, t.business_name, t.owner_user_id 
       FROM tenants t 
       INNER JOIN users u ON t.owner_user_id = u.id 
       WHERE u.email = $1`,
      [SUPER_ADMIN_EMAIL]
    );
    console.log('Tenants:', finalTenant.rows);

    console.log('\n✅ Super Admin setup complete!');
    console.log(`   Email: ${SUPER_ADMIN_EMAIL}`);
    console.log('   Role: super_admin');
    console.log('   Tenant: None (admin-only user)');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
