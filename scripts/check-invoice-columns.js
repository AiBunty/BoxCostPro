import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

const columns = await sql`
  SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_name = 'invoice_templates'
  ORDER BY ordinal_position
`;

console.log('Invoice Templates Table Structure:\n');
columns.forEach(col => {
  console.log(`  ${col.column_name.padEnd(25)} ${col.data_type.padEnd(20)} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
});

const templates = await sql`SELECT id, name, template_key, is_default, status FROM invoice_templates`;
console.log(`\n${templates.length} templates in database:\n`);
templates.forEach(t => {
  console.log(`  - ${t.name} (${t.template_key}) ${t.is_default ? '[DEFAULT]' : ''} - ${t.status}`);
});
