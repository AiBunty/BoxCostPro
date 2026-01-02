import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool } from '@neondatabase/serverless';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

async function checkUser() {
  try {
    console.log('Checking for user: aibuntysystems@gmail.com');

    // Get all users
    const allUsers = await db.select().from(users);
    console.log('\n=== ALL USERS IN DATABASE ===');
    console.log('Total users:', allUsers.length);
    allUsers.forEach(user => {
      console.log(`- ID: ${user.id}, Email: ${user.email}, Role: ${user.role}, NeonAuthId: ${user.neonAuthUserId || 'null'}`);
    });

    // Check specific user
    const specificUser = await db.select().from(users).where(eq(users.email, 'aibuntysystems@gmail.com'));
    console.log('\n=== SPECIFIC USER CHECK ===');
    if (specificUser.length > 0) {
      console.log('USER FOUND:', JSON.stringify(specificUser[0], null, 2));
    } else {
      console.log('USER NOT FOUND: aibuntysystems@gmail.com does not exist in database');
    }

  } catch (error) {
    console.error('Error checking user:', error);
  } finally {
    await pool.end();
  }
}

checkUser();
