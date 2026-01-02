/**
 * Seed Invoice Templates
 * Creates 4 professional GST invoice templates
 */

import { storage } from '../server/storage';

async function seedInvoiceTemplates() {
  console.log('🌱 Seeding invoice templates...\n');

  const templates = [
    {
      name: 'Classic GST Invoice',
      description: 'Traditional invoice with table layout, black text, and professional borders',
      layout: 'classic',
      primaryColor: '#000000',
      secondaryColor: '#666666',
      fontFamily: 'Helvetica',
      showLogo: true,
      logoPosition: 'left',
      showWatermark: false,
      footerNote: 'This is a system-generated invoice. No signature required.',
      showSupportEmail: true,
      supportEmail: 'support@boxcostpro.com',
      htmlTemplate: getClassicTemplate(),
      cssStyles: '',
      isDefault: true,
      isActive: true,
    },
    {
      name: 'Modern SaaS Invoice',
      description: 'Clean design with gradient header, rounded sections, and highlighted totals',
      layout: 'modern',
      primaryColor: '#667eea',
      secondaryColor: '#764ba2',
      fontFamily: 'Helvetica',
      showLogo: true,
      logoPosition: 'left',
      showWatermark: false,
      footerNote: 'Thank you for your business!',
      showSupportEmail: true,
      supportEmail: 'support@boxcostpro.com',
      htmlTemplate: getModernTemplate(),
      cssStyles: '',
      isDefault: false,
      isActive: true,
    },
    {
      name: 'Minimal Professional',
      description: 'Typography-focused design with minimal borders, ideal for accounting',
      layout: 'minimal',
      primaryColor: '#333333',
      secondaryColor: '#666666',
      fontFamily: 'Georgia',
      showLogo: false,
      logoPosition: 'left',
      showWatermark: false,
      footerNote: 'Payment due upon receipt.',
      showSupportEmail: false,
      supportEmail: '',
      htmlTemplate: getMinimalTemplate(),
      cssStyles: '',
      isDefault: false,
      isActive: true,
    },
    {
      name: 'Brand-Focused',
      description: 'Bold design with brand colors, logo watermark, and prominent totals',
      layout: 'brand',
      primaryColor: '#3B82F6',
      secondaryColor: '#1E40AF',
      fontFamily: 'Arial',
      showLogo: true,
      logoPosition: 'center',
      showWatermark: true,
      watermarkText: 'INVOICE',
      footerNote: 'Powered by BoxCostPro',
      showSupportEmail: true,
      supportEmail: 'support@boxcostpro.com',
      htmlTemplate: getBrandTemplate(),
      cssStyles: '',
      isDefault: false,
      isActive: true,
    },
  ];

  for (const template of templates) {
    try {
      const created = await storage.createInvoiceTemplate(template);
      console.log(`✅ Created template: ${template.name} (ID: ${created.id})`);
    } catch (error: any) {
      // Check if it's a duplicate error
      if (error.message && error.message.includes('unique') || error.message.includes('duplicate')) {
        console.log(`⏭️  Template "${template.name}" already exists, skipping...`);
      } else {
        console.error(`❌ Failed to create template "${template.name}":`, error.message);
      }
    }
  }

  console.log('\n🎉 Invoice templates seeded successfully!');
}

function getClassicTemplate(): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice {{invoiceNumber}}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica', Arial, sans-serif; padding: 20mm; font-size: 11pt; }
    .header { border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
    .company-name { font-size: 20pt; font-weight: bold; }
    .invoice-title { text-align: center; font-size: 18pt; font-weight: bold; margin: 20px 0; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { border: 1px solid #000; padding: 8px; text-align: left; }
    th { background: #f0f0f0; font-weight: bold; }
    .text-right { text-align: right; }
    .totals-row { background: #f9f9f9; font-weight: bold; }
    .grand-total { background: #e0e0e0; font-size: 12pt; }
    .footer { margin-top: 30px; border-top: 1px solid #ccc; padding-top: 10px; text-align: center; font-size: 9pt; color: #666; }
  </style>
</head>
<body>
  <div class="header">
    <div class="company-name">{{seller.companyName}}</div>
    <div>{{seller.address}}</div>
    <div>GSTIN: {{seller.gstin}}</div>
    <div>State: {{seller.state}}</div>
  </div>

  <div class="invoice-title">TAX INVOICE</div>

  <table>
    <tr>
      <th width="50%">Invoice Number</th>
      <td width="50%">{{invoiceNumber}}</td>
    </tr>
    <tr>
      <th>Invoice Date</th>
      <td>{{invoiceDate}}</td>
    </tr>
  </table>

  <table>
    <tr>
      <th colspan="2">Bill To</th>
    </tr>
    <tr>
      <td colspan="2">
        <strong>{{buyer.companyName}}</strong><br>
        {{buyer.address}}<br>
        GSTIN: {{buyer.gstin}}<br>
        State: {{buyer.state}}<br>
        Email: {{buyer.email}}<br>
        Phone: {{buyer.phone}}
      </td>
    </tr>
  </table>

  <table>
    <thead>
      <tr>
        <th width="5%">#</th>
        <th width="40%">Description</th>
        <th width="15%">HSN/SAC</th>
        <th width="10%" class="text-right">Qty</th>
        <th width="15%" class="text-right">Unit Price</th>
        <th width="15%" class="text-right">Amount</th>
      </tr>
    </thead>
    <tbody>
      {{lineItemsRows}}
    </tbody>
  </table>

  <table>
    <tr>
      <td class="text-right"><strong>Subtotal</strong></td>
      <td width="20%" class="text-right">₹{{pricing.subtotal}}</td>
    </tr>
    {{discountRow}}
    <tr>
      <td class="text-right"><strong>Taxable Value</strong></td>
      <td class="text-right">₹{{pricing.taxableValue}}</td>
    </tr>
    {{gstRows}}
    <tr class="grand-total">
      <td class="text-right"><strong>Grand Total</strong></td>
      <td class="text-right"><strong>₹{{pricing.grandTotal}}</strong></td>
    </tr>
  </table>

  <p style="margin-top: 15px;"><strong>Payment Reference:</strong> {{paymentReference}}</p>

  <div class="footer">
    {{template.footerNote}}
  </div>
</body>
</html>`;
}

function getModernTemplate(): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice {{invoiceNumber}}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica', Arial, sans-serif; padding: 0; font-size: 10pt; background: #f5f5f5; }
    .invoice-container { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 800px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; }
    .company-name { font-size: 22pt; font-weight: bold; margin-bottom: 10px; }
    .invoice-title { font-size: 16pt; opacity: 0.9; }
    .content { padding: 30px; }
    .info-section { background: #f9f9f9; border-radius: 6px; padding: 15px; margin-bottom: 20px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { background: #667eea; color: white; padding: 12px; text-align: left; }
    td { padding: 10px; border-bottom: 1px solid #e0e0e0; }
    .text-right { text-align: right; }
    .totals-section { background: #f0f0f0; border-radius: 6px; padding: 15px; margin-top: 20px; }
    .grand-total { font-size: 16pt; font-weight: bold; color: #667eea; margin-top: 10px; padding-top: 10px; border-top: 2px solid #667eea; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 9pt; border-top: 1px solid #e0e0e0; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="header">
      <div class="company-name">{{seller.companyName}}</div>
      <div class="invoice-title">TAX INVOICE</div>
      <div style="margin-top: 10px;">Invoice #{{invoiceNumber}}</div>
    </div>

    <div class="content">
      <div class="info-grid">
        <div class="info-section">
          <strong>From:</strong><br>
          {{seller.companyName}}<br>
          {{seller.address}}<br>
          GSTIN: {{seller.gstin}}<br>
          State: {{seller.state}}
        </div>

        <div class="info-section">
          <strong>Bill To:</strong><br>
          {{buyer.companyName}}<br>
          {{buyer.address}}<br>
          GSTIN: {{buyer.gstin}}<br>
          State: {{buyer.state}}<br>
          Email: {{buyer.email}}
        </div>
      </div>

      <div class="info-section">
        <strong>Invoice Date:</strong> {{invoiceDate}}
      </div>

      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>HSN/SAC</th>
            <th class="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {{lineItemsRows}}
        </tbody>
      </table>

      <div class="totals-section">
        <div style="display: flex; justify-content: space-between; margin: 5px 0;">
          <span>Subtotal:</span>
          <span>₹{{pricing.subtotal}}</span>
        </div>
        {{discountRow}}
        <div style="display: flex; justify-content: space-between; margin: 5px 0;">
          <span>Taxable Value:</span>
          <span>₹{{pricing.taxableValue}}</span>
        </div>
        {{gstRows}}

        <div class="grand-total" style="display: flex; justify-content: space-between;">
          <span>Grand Total:</span>
          <span>₹{{pricing.grandTotal}}</span>
        </div>
      </div>

      <p style="margin-top: 15px; font-size: 9pt; color: #666;">
        Payment Reference: {{paymentReference}}
      </p>
    </div>

    <div class="footer">
      {{template.footerNote}}
    </div>
  </div>
</body>
</html>`;
}

function getMinimalTemplate(): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice {{invoiceNumber}}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Georgia', serif; padding: 25mm; font-size: 11pt; line-height: 1.6; }
    .header { margin-bottom: 40px; }
    .company-name { font-size: 24pt; font-weight: normal; margin-bottom: 5px; }
    .invoice-title { font-size: 14pt; font-weight: normal; color: #666; margin-top: 30px; }
    .divider { border-top: 1px solid #333; margin: 20px 0; }
    .section { margin-bottom: 30px; }
    .section-title { font-weight: bold; margin-bottom: 10px; }
    table { width: 100%; margin: 20px 0; }
    th { text-align: left; padding: 10px 0; border-bottom: 2px solid #333; font-weight: bold; }
    td { padding: 10px 0; border-bottom: 1px solid #ddd; }
    .text-right { text-align: right; }
    .totals { margin-top: 30px; float: right; width: 40%; }
    .totals-row { display: flex; justify-content: space-between; padding: 5px 0; }
    .grand-total { border-top: 2px solid #333; margin-top: 10px; padding-top: 10px; font-size: 14pt; font-weight: bold; }
    .footer { clear: both; margin-top: 60px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; font-size: 9pt; color: #666; }
  </style>
</head>
<body>
  <div class="header">
    <div class="company-name">{{seller.companyName}}</div>
    <div>{{seller.address}}</div>
    <div>GSTIN: {{seller.gstin}} | State: {{seller.state}}</div>

    <div class="invoice-title">Tax Invoice</div>
  </div>

  <div class="section">
    <div><strong>Invoice Number:</strong> {{invoiceNumber}}</div>
    <div><strong>Date:</strong> {{invoiceDate}}</div>
  </div>

  <div class="divider"></div>

  <div class="section">
    <div class="section-title">Billed To</div>
    <div>{{buyer.companyName}}</div>
    <div>{{buyer.address}}</div>
    <div>GSTIN: {{buyer.gstin}} | State: {{buyer.state}}</div>
    <div>Email: {{buyer.email}} | Phone: {{buyer.phone}}</div>
  </div>

  <div class="divider"></div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th>HSN/SAC</th>
        <th class="text-right">Amount</th>
      </tr>
    </thead>
    <tbody>
      {{lineItemsRows}}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-row">
      <span>Subtotal</span>
      <span>₹{{pricing.subtotal}}</span>
    </div>
    {{discountRow}}
    <div class="totals-row">
      <span>Taxable Value</span>
      <span>₹{{pricing.taxableValue}}</span>
    </div>
    {{gstRows}}
    <div class="totals-row grand-total">
      <span>Grand Total</span>
      <span>₹{{pricing.grandTotal}}</span>
    </div>
  </div>

  <div class="footer">
    <p>Payment Reference: {{paymentReference}}</p>
    <p style="margin-top: 10px;">{{template.footerNote}}</p>
  </div>
</body>
</html>`;
}

function getBrandTemplate(): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice {{invoiceNumber}}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Arial', sans-serif; padding: 0; font-size: 10pt; }
    .header { background: {{template.primaryColor}}; color: white; padding: 40px 30px; position: relative; }
    .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); opacity: 0.1; font-size: 80pt; font-weight: bold; }
    .company-name { font-size: 28pt; font-weight: bold; margin-bottom: 10px; }
    .invoice-title { font-size: 18pt; }
    .content { padding: 30px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
    .info-box { background: #f9f9f9; padding: 15px; border-left: 4px solid {{template.primaryColor}}; }
    .info-label { font-weight: bold; color: {{template.primaryColor}}; margin-bottom: 5px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { background: {{template.primaryColor}}; color: white; padding: 12px; text-align: left; }
    td { padding: 10px; border-bottom: 1px solid #e0e0e0; }
    .text-right { text-align: right; }
    .totals-box { background: #f0f0f0; border: 2px solid {{template.primaryColor}}; border-radius: 8px; padding: 20px; margin-top: 20px; width: 50%; float: right; }
    .totals-row { display: flex; justify-content: space-between; margin: 8px 0; }
    .grand-total { background: {{template.primaryColor}}; color: white; padding: 15px; margin: -20px -20px 0 -20px; border-radius: 6px 6px 0 0; font-size: 14pt; font-weight: bold; }
    .footer { clear: both; background: {{template.secondaryColor}}; color: white; padding: 20px; text-align: center; margin-top: 40px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="watermark">INVOICE</div>
    <div class="company-name">{{seller.companyName}}</div>
    <div class="invoice-title">Tax Invoice #{{invoiceNumber}}</div>
  </div>

  <div class="content">
    <div class="info-grid">
      <div class="info-box">
        <div class="info-label">From</div>
        <div>{{seller.companyName}}</div>
        <div>{{seller.address}}</div>
        <div>GSTIN: {{seller.gstin}}</div>
        <div>State: {{seller.state}}</div>
      </div>

      <div class="info-box">
        <div class="info-label">Bill To</div>
        <div><strong>{{buyer.companyName}}</strong></div>
        <div>{{buyer.address}}</div>
        <div>GSTIN: {{buyer.gstin}}</div>
        <div>State: {{buyer.state}}</div>
      </div>

      <div class="info-box">
        <div class="info-label">Invoice Date</div>
        <div>{{invoiceDate}}</div>
      </div>

      <div class="info-box">
        <div class="info-label">Contact</div>
        <div>Email: {{buyer.email}}</div>
        <div>Phone: {{buyer.phone}}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th width="50%">Description</th>
          <th width="20%">HSN/SAC</th>
          <th width="30%" class="text-right">Amount</th>
        </tr>
      </thead>
      <tbody>
        {{lineItemsRows}}
      </tbody>
    </table>

    <div class="totals-box">
      <div class="grand-total">
        <div style="display: flex; justify-content: space-between;">
          <span>Grand Total</span>
          <span>₹{{pricing.grandTotal}}</span>
        </div>
      </div>

      <div style="padding-top: 15px;">
        <div class="totals-row">
          <span>Subtotal:</span>
          <span>₹{{pricing.subtotal}}</span>
        </div>
        {{discountRow}}
        <div class="totals-row">
          <span>Taxable Value:</span>
          <span>₹{{pricing.taxableValue}}</span>
        </div>
        {{gstRows}}
      </div>

      <p style="margin-top: 15px; font-size: 9pt; color: #666;">
        Payment Ref: {{paymentReference}}
      </p>
    </div>
  </div>

  <div class="footer">
    {{template.footerNote}}
  </div>
</body>
</html>`;
}

// Run the seeding script
seedInvoiceTemplates()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error seeding templates:', error);
    process.exit(1);
  });
