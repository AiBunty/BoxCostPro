/**
 * Test PDF Invoice Generation
 * Tests all 3 invoice templates with sample GST-compliant data
 */

import { neon } from '@neondatabase/serverless';
import puppeteer from 'puppeteer';
import Handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

// Register Handlebars helpers
Handlebars.registerHelper('add', function(a, b) {
  return Number(a) + Number(b);
});

Handlebars.registerHelper('multiply', function(a, b) {
  return Number(a) * Number(b);
});

Handlebars.registerHelper('formatCurrency', function(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
});

Handlebars.registerHelper('formatNumber', function(num) {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
});

Handlebars.registerHelper('eq', function(a, b) {
  return a === b;
});

// Sample GST-compliant invoice data
const sampleInvoiceData = {
  invoice: {
    number: 'INV-2024-001',
    date: '2024-12-31',
    dueDate: '2025-01-15',
    financialYear: '2024-25',
  },
  seller: {
    company_name: 'TechFlow Solutions Pvt Ltd',
    gstin: '27AABCT1332L1Z5',
    pan: 'AABCT1332L',
    address: 'Plot No. 42, Sector 18',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400705',
    phone: '+91-22-2567-8901',
    email: 'billing@techflow.in',
  },
  buyer: {
    company_name: 'Digital Innovations India Ltd',
    gstin: '29AAACI1332K1ZZ',
    pan: 'AAACI1332K',
    address: 'Tower A, 5th Floor, Tech Park',
    city: 'Bangalore',
    state: 'Karnataka',
    pincode: '560100',
    contact_person: 'Rajesh Kumar',
    phone: '+91-80-4567-8901',
    email: 'accounts@digitalinnovations.com',
  },
  items: [
    {
      description: 'BoxCost Pro - Annual Subscription (1 User)',
      sac_code: '998314',
      quantity: 1,
      unit: 'Year',
      rate: 11999.00,
      amount: 11999.00,
    },
    {
      description: 'BoxCost Pro - Additional User License',
      sac_code: '998314',
      quantity: 2,
      unit: 'User',
      rate: 4999.00,
      amount: 9998.00,
    },
    {
      description: 'Priority Support & Onboarding',
      sac_code: '998313',
      quantity: 1,
      unit: 'Service',
      rate: 5000.00,
      amount: 5000.00,
    },
  ],
  totals: {
    subtotal: 26997.00,
    cgst: 2429.73,
    sgst: 0.00,
    igst: 2429.73,
    total: 29426.73,
    total_in_words: 'Twenty Nine Thousand Four Hundred Twenty Six Rupees and Seventy Three Paise Only',
    gst_rate: 9,
    is_inter_state: true,
  },
  payment: {
    bank_name: 'HDFC Bank',
    account_number: '50200012345678',
    ifsc_code: 'HDFC0001234',
    branch: 'Mumbai BKC',
    upi_id: 'techflow@hdfcbank',
  },
  terms: [
    'Payment due within 15 days from invoice date',
    'Interest @ 18% p.a. will be charged on delayed payments',
    'This is a computer-generated invoice and does not require signature',
    'Subject to Mumbai jurisdiction',
  ],
};

async function testPDFGeneration() {
  console.log('🧪 Testing PDF Invoice Generation\n');

  try {
    // Fetch all templates from database
    const templates = await sql`
      SELECT id, name, template_key, is_default
      FROM invoice_templates
      WHERE status = 'active'
      ORDER BY is_default DESC, name
    `;

    console.log(`📋 Found ${templates.length} active templates:\n`);
    templates.forEach(t => {
      console.log(`   ${t.is_default ? '★' : ' '} ${t.name} (${t.template_key})`);
    });

    console.log('\n🎨 Generating PDFs for each template...\n');

    const outputDir = path.join(__dirname, '../test-output/invoices');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Launch browser once for all PDFs
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    for (const template of templates) {
      console.log(`\n📄 Testing: ${template.name}`);
      console.log(`   Template: ${template.template_key}`);

      // Load HTML template
      const templatePath = path.join(__dirname, `../server/templates/invoices/${template.template_key}.html`);

      if (!fs.existsSync(templatePath)) {
        console.log(`   ⚠️  Template file not found: ${templatePath}`);
        console.log(`   Skipping...`);
        continue;
      }

      const templateHTML = fs.readFileSync(templatePath, 'utf8');

      // Compile with Handlebars
      const compiledTemplate = Handlebars.compile(templateHTML);
      const renderedHTML = compiledTemplate(sampleInvoiceData);

      // Generate PDF
      const page = await browser.newPage();
      await page.setContent(renderedHTML, { waitUntil: 'networkidle0' });

      const pdfPath = path.join(outputDir, `test-${template.template_key}.pdf`);
      await page.pdf({
        path: pdfPath,
        format: 'A4',
        printBackground: true,
        margin: {
          top: '10mm',
          right: '10mm',
          bottom: '10mm',
          left: '10mm',
        },
      });

      await page.close();

      const stats = fs.statSync(pdfPath);
      console.log(`   ✅ PDF generated: ${pdfPath}`);
      console.log(`   📊 File size: ${(stats.size / 1024).toFixed(2)} KB`);
    }

    await browser.close();

    console.log('\n✅ All PDF tests completed successfully!');
    console.log(`\n📁 Output directory: ${outputDir}`);
    console.log('\nNext steps:');
    console.log('  1. Open the PDFs in test-output/invoices/ folder');
    console.log('  2. Verify GST compliance and formatting');
    console.log('  3. Test printing from each PDF');

    process.exit(0);
  } catch (error) {
    console.error('❌ PDF generation test failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testPDFGeneration();
