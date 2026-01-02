import { db } from "../db";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  console.log("🚀 Starting community templates migration...\n");

  try {
    // Read the SQL file
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, "add-community-templates.sql"),
      "utf-8"
    );

    // Execute the migration
    await db.execute(sql.raw(migrationSQL));
    console.log("✅ Migration SQL executed successfully!\n");

    // Verify the migration
    console.log("🔍 Verifying migration...\n");

    // Check if columns exist on quote_templates
    const quoteTemplateCheck = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'quote_templates' 
        AND column_name IN ('is_system_template', 'is_community_template', 'is_public', 'use_count', 'rating', 'tags');
    `);
    console.log(`✓ quote_templates new columns: ${quoteTemplateCheck.rows.length}/6`);

    // Check if columns exist on invoice_templates
    const invoiceTemplateCheck = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'invoice_templates' 
        AND column_name IN ('user_id', 'is_system_template', 'is_community_template', 'is_public', 'use_count', 'rating', 'tags');
    `);
    console.log(`✓ invoice_templates new columns: ${invoiceTemplateCheck.rows.length}/7`);

    // Check if template_ratings table exists
    const ratingsTableCheck = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'template_ratings'
      ) as exists;
    `);
    console.log(`✓ template_ratings table exists: ${ratingsTableCheck.rows[0]?.exists ? 'Yes' : 'No'}`);

    // Count system templates
    const systemQuoteTemplates = await db.execute(sql`
      SELECT COUNT(*) as count FROM quote_templates WHERE is_system_template = true;
    `);
    console.log(`✓ System quote templates: ${systemQuoteTemplates.rows[0]?.count || 0}`);

    const systemInvoiceTemplates = await db.execute(sql`
      SELECT COUNT(*) as count FROM invoice_templates WHERE is_system_template = true;
    `);
    console.log(`✓ System invoice templates: ${systemInvoiceTemplates.rows[0]?.count || 0}`);

    console.log("\n🎉 Community templates migration completed successfully!");
    console.log("\n📝 Features enabled:");
    console.log("  ✓ No template limits (unlimited user templates)");
    console.log("  ✓ Community template sharing");
    console.log("  ✓ Public template gallery");
    console.log("  ✓ Template ratings and reviews");
    console.log("  ✓ Template usage tracking");
    console.log("  ✓ Template tags for categorization\n");

  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }
}

// Run the migration
runMigration()
  .then(() => {
    console.log("✨ Migration script completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Migration script failed:", error);
    process.exit(1);
  });
