#!/usr/bin/env tsx
/**
 * Quick script to query user setup status
 */

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function queryUsers() {
  try {
    console.log('📊 Querying user setup status...\n');

    const users = await sql`
      SELECT *
      FROM users
      ORDER BY created_at DESC
      LIMIT 10
    `;

    if (users.length === 0) {
      console.log('ℹ️  No users found in database');
      return;
    }

    console.log(`Found ${users.length} users:\n`);

    users.forEach((user: any) => {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(JSON.stringify(user, null, 2));
      console.log();
    });

  } catch (error) {
    console.error('❌ Query failed:', error);
    process.exit(1);
  }
}

queryUsers();
