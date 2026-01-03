import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function checkSchema() {
  // Check subscription_features
  console.log('\n=== subscription_features ===');
  const featuresColumns = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'subscription_features' 
    ORDER BY ordinal_position
  `;
  featuresColumns.forEach(c => console.log(`  ${c.column_name}: ${c.data_type}`));
  
  // Check subscription_coupons
  console.log('\n=== subscription_coupons ===');
  const couponColumns = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'subscription_coupons' 
    ORDER BY ordinal_position
  `;
  couponColumns.forEach(c => console.log(`  ${c.column_name}: ${c.data_type}`));
}

checkSchema().catch(console.error);
