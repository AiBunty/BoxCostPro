import pg from 'pg';

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  await client.connect();
  
  console.log('=== Users with email aibuntysystems@gmail.com ===');
  const result = await client.query(`
    SELECT id, email, role, clerk_user_id, created_at 
    FROM users 
    WHERE email = 'aibuntysystems@gmail.com' 
    ORDER BY created_at
  `);
  console.log(result.rows);
  
  // If there are duplicates, delete the ones with 'user' role (keep super_admin)
  if (result.rows.length > 1) {
    console.log('\n=== Found duplicates! Cleaning up... ===');
    const superAdmin = result.rows.find((r: any) => r.role === 'super_admin');
    const duplicates = result.rows.filter((r: any) => r.role !== 'super_admin');
    
    for (const dup of duplicates) {
      console.log(`Deleting duplicate user: ${dup.id} (role: ${dup.role})`);
      
      // Delete related records first
      await client.query(`DELETE FROM user_profiles WHERE user_id = $1`, [dup.id]);
      await client.query(`DELETE FROM onboarding_progress WHERE user_id = $1`, [dup.id]);
      await client.query(`DELETE FROM users WHERE id = $1`, [dup.id]);
    }
    
    console.log('Cleanup complete!');
    
    // Ensure the super_admin has the clerk_user_id
    if (superAdmin && !superAdmin.clerk_user_id) {
      const clerkId = duplicates.find((d: any) => d.clerk_user_id)?.clerk_user_id;
      if (clerkId) {
        console.log(`Updating super_admin with clerk_user_id: ${clerkId}`);
        await client.query(`UPDATE users SET clerk_user_id = $1 WHERE id = $2`, [clerkId, superAdmin.id]);
      }
    }
  }
  
  await client.end();
}

main().catch(console.error);
