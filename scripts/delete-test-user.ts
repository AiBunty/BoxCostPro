import { neon } from '@neondatabase/serverless';

const sql = neon('postgresql://neondb_owner:npg_9PQRYKM3gBVH@ep-shiny-hill-ahld3t7l-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require');

async function deleteTestUser() {
  try {
    console.log('🔍 Checking for test user...');
    
    // Check if user exists
    const checkResult = await sql`
      SELECT id, email, first_name, last_name FROM users WHERE email = 'venturapackagers@gmail.com'
    `;
    
    if (checkResult.length === 0) {
      console.log('✓ Test user not found (already deleted or doesn\'t exist)');
      return;
    }
    
    const userId = checkResult[0].id;
    console.log('✓ Found user:', {
      id: userId,
      email: checkResult[0].email,
      name: `${checkResult[0].first_name} ${checkResult[0].last_name}`
    });
    
    // Delete related records first 
    console.log('\n🗑️  Deleting related records...');
    
    // Delete with parameterized queries
    await sql`DELETE FROM company_profiles WHERE user_id = ${userId}`;
    console.log('  ✓ Deleted company_profiles');
    
    await sql`DELETE FROM user_setup WHERE user_id = ${userId}`;
    console.log('  ✓ Deleted user_setup');
    
    await sql`DELETE FROM onboarding_status WHERE user_id = ${userId}`;
    console.log('  ✓ Deleted onboarding_status');
    
    await sql`DELETE FROM admin_actions WHERE target_user_id = ${userId} OR admin_user_id = ${userId}`;
    console.log('  ✓ Deleted admin_actions');
    
    await sql`DELETE FROM business_defaults WHERE user_id = ${userId}`;
    console.log('  ✓ Deleted business_defaults');
    
    await sql`DELETE FROM quotes WHERE user_id = ${userId}`;
    console.log('  ✓ Deleted quotes');
    
    await sql`DELETE FROM party_profiles WHERE user_id = ${userId}`;
    console.log('  ✓ Deleted party_profiles');
    
    await sql`DELETE FROM flute_settings WHERE user_id = ${userId}`;
    console.log('  ✓ Deleted flute_settings');
    
    await sql`DELETE FROM fluting_settings WHERE user_id = ${userId}`;
    console.log('  ✓ Deleted fluting_settings');
    
    await sql`DELETE FROM paper_setup WHERE user_id = ${userId}`;
    console.log('  ✓ Deleted paper_setup');
    
    await sql`DELETE FROM user_email_settings WHERE user_id = ${userId}`;
    console.log('  ✓ Deleted user_email_settings');
    
    // Now delete the user
    console.log('\n👤 Deleting user...');
    const userResult = await sql`DELETE FROM users WHERE id = ${userId} RETURNING id, email`;
    console.log('✓ Deleted user:', userResult[0]);
    
    // Verify
    console.log('\n✅ Verification:');
    const verify = await sql`SELECT COUNT(*) as count FROM users WHERE email = 'venturapackagers@gmail.com'`;
    console.log('  Remaining users with this email:', verify[0].count, '(should be 0)');
    
    console.log('\n🎉 Test user successfully deleted!');
    
  } catch (error: any) {
