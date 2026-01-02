/**
 * Dynamic Quotation Template Engine
 * 
 * CRITICAL RULES:
 * 1. Only render selected items (is_selected = true)
 * 2. Hide columns if ALL items have that field empty/null
 * 3. Calculate totals ONLY from selected items
 * 4. Support both Email (HTML) and WhatsApp (Text) formats
 */

import Handlebars from 'handlebars';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

export interface QuotationItem {
  id: string;
  is_selected: boolean;
  item_name: string;
  description?: string | null;
  hsn_code?: string | null;
  quantity: number;
  unit: string;
  rate: number;
  discount_percent: number;
  tax_percent: number;
  tax_type: 'CGST_SGST' | 'IGST' | 'NONE';
  amount: number;
}

export interface QuotationData {
  quotation_number: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  customer_address?: string;
  customer_gstin?: string;
  items: QuotationItem[];
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  currency: string;
  valid_until?: string;
  terms_and_conditions?: string;
  notes?: string;
  seller_name: string;
  seller_address: string;
  seller_gstin: string;
  seller_phone?: string;
  seller_email?: string;
}

export interface ColumnVisibility {
  showDescription: boolean;
  showHSN: boolean;
  showDiscount: boolean;
  showTax: boolean;
}

// ============================================================
// HANDLEBARS HELPERS
// ============================================================

// Register custom Handlebars helpers
Handlebars.registerHelper('currency', (amount: number, currency: string = 'INR') => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
  }).format(amount);
});

Handlebars.registerHelper('formatNumber', (num: number) => {
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(num);
});

Handlebars.registerHelper('formatDate', (date: string) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
});

Handlebars.registerHelper('ifSelected', function(this: any, item: QuotationItem, options: Handlebars.HelperOptions) {
  return item.is_selected ? options.fn(this) : '';
});

Handlebars.registerHelper('ifShowColumn', function(this: any, show: boolean, options: Handlebars.HelperOptions) {
  return show ? options.fn(this) : '';
});

Handlebars.registerHelper('numberToWords', (amount: number) => {
  return convertNumberToWords(amount);
});

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Filter only selected items from the quotation
 */
export function getSelectedItems(items: QuotationItem[]): QuotationItem[] {
  return items.filter(item => item.is_selected);
}

/**
 * Determine which columns should be visible based on selected items
 */
export function getColumnVisibility(selectedItems: QuotationItem[]): ColumnVisibility {
  return {
    showDescription: selectedItems.some(item => item.description && item.description.trim() !== ''),
    showHSN: selectedItems.some(item => item.hsn_code && item.hsn_code.trim() !== ''),
    showDiscount: selectedItems.some(item => item.discount_percent > 0),
    showTax: selectedItems.some(item => item.tax_percent > 0),
  };
}

/**
 * Calculate totals from selected items only
 */
export function calculateTotals(selectedItems: QuotationItem[]) {
  const subtotal = selectedItems.reduce((sum, item) => sum + item.amount, 0);
  const discountAmount = selectedItems.reduce((sum, item) => {
    const baseAmount = item.quantity * item.rate;
    return sum + (baseAmount * item.discount_percent / 100);
  }, 0);
  const taxAmount = selectedItems.reduce((sum, item) => {
    const afterDiscount = item.amount;
    return sum + (afterDiscount * item.tax_percent / 100);
  }, 0);
  const totalAmount = subtotal + taxAmount;

  return { subtotal, discountAmount, taxAmount, totalAmount };
}

/**
 * Convert number to words (Indian format)
 */
function convertNumberToWords(amount: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const numToWords = (n: number): string => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + numToWords(n % 100) : '');
    if (n < 100000) return numToWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + numToWords(n % 1000) : '');
    if (n < 10000000) return numToWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + numToWords(n % 100000) : '');
    return numToWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + numToWords(n % 10000000) : '');
  };

  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  
  let result = numToWords(rupees) + ' Rupees';
  if (paise > 0) {
    result += ' and ' + numToWords(paise) + ' Paise';
  }
  result += ' Only';
  
  return result;
}

// ============================================================
// EMAIL QUOTATION TEMPLATE (HTML)
// ============================================================

const EMAIL_QUOTATION_TEMPLATE = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
    .container { max-width: 800px; margin: 0 auto; background: #fff; }
    .header { background: #1e40af; color: white; padding: 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 20px; }
    .section { margin-bottom: 20px; }
    .section-title { font-weight: bold; color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 5px; margin-bottom: 10px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .info-block { background: #f8fafc; padding: 15px; border-radius: 5px; }
    .info-block h4 { margin: 0 0 10px 0; color: #1e40af; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th { background: #1e40af; color: white; padding: 10px; text-align: left; }
    td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
    tr:nth-child(even) { background: #f8fafc; }
    .text-right { text-align: right; }
    .totals { margin-left: auto; width: 300px; }
    .totals td { padding: 8px; }
    .totals .total-row { font-weight: bold; font-size: 18px; background: #1e40af; color: white; }
    .footer { background: #f8fafc; padding: 15px; font-size: 12px; color: #666; margin-top: 20px; }
    .validity { background: #fef3c7; padding: 10px; border-radius: 5px; margin-bottom: 15px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>QUOTATION</h1>
      <p style="margin: 5px 0;">{{quotation_number}}</p>
    </div>
    
    <div class="content">
      {{#if valid_until}}
      <div class="validity">
        <strong>⏰ Valid Until:</strong> {{formatDate valid_until}}
      </div>
      {{/if}}
      
      <div class="grid">
        <div class="info-block">
          <h4>From</h4>
          <strong>{{seller_name}}</strong><br>
          {{seller_address}}<br>
          {{#if seller_gstin}}GSTIN: {{seller_gstin}}<br>{{/if}}
          {{#if seller_phone}}Phone: {{seller_phone}}<br>{{/if}}
          {{#if seller_email}}Email: {{seller_email}}{{/if}}
        </div>
        <div class="info-block">
          <h4>To</h4>
          <strong>{{customer_name}}</strong><br>
          {{#if customer_address}}{{customer_address}}<br>{{/if}}
          {{#if customer_gstin}}GSTIN: {{customer_gstin}}<br>{{/if}}
          {{#if customer_phone}}Phone: {{customer_phone}}<br>{{/if}}
          {{#if customer_email}}Email: {{customer_email}}{{/if}}
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">Items</div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Item</th>
              {{#ifShowColumn columns.showDescription}}<th>Description</th>{{/ifShowColumn}}
              {{#ifShowColumn columns.showHSN}}<th>HSN/SAC</th>{{/ifShowColumn}}
              <th class="text-right">Qty</th>
              <th>Unit</th>
              <th class="text-right">Rate</th>
              {{#ifShowColumn columns.showDiscount}}<th class="text-right">Disc %</th>{{/ifShowColumn}}
              {{#ifShowColumn columns.showTax}}<th class="text-right">Tax %</th>{{/ifShowColumn}}
              <th class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {{#each selectedItems}}
            <tr>
              <td>{{@index}}</td>
              <td>{{item_name}}</td>
              {{#ifShowColumn ../columns.showDescription}}<td>{{description}}</td>{{/ifShowColumn}}
              {{#ifShowColumn ../columns.showHSN}}<td>{{hsn_code}}</td>{{/ifShowColumn}}
              <td class="text-right">{{formatNumber quantity}}</td>
              <td>{{unit}}</td>
              <td class="text-right">{{currency rate ../currency}}</td>
              {{#ifShowColumn ../columns.showDiscount}}<td class="text-right">{{discount_percent}}%</td>{{/ifShowColumn}}
              {{#ifShowColumn ../columns.showTax}}<td class="text-right">{{tax_percent}}%</td>{{/ifShowColumn}}
              <td class="text-right">{{currency amount ../currency}}</td>
            </tr>
            {{/each}}
          </tbody>
        </table>
      </div>
      
      <table class="totals">
        <tr>
          <td>Subtotal</td>
          <td class="text-right">{{currency totals.subtotal currency}}</td>
        </tr>
        {{#if totals.discountAmount}}
        <tr>
          <td>Discount</td>
          <td class="text-right">- {{currency totals.discountAmount currency}}</td>
        </tr>
        {{/if}}
        {{#if totals.taxAmount}}
        <tr>
          <td>Tax</td>
          <td class="text-right">{{currency totals.taxAmount currency}}</td>
        </tr>
        {{/if}}
        <tr class="total-row">
          <td>Total</td>
          <td class="text-right">{{currency totals.totalAmount currency}}</td>
        </tr>
      </table>
      
      <p><em>Amount in words: {{numberToWords totals.totalAmount}}</em></p>
      
      {{#if terms_and_conditions}}
      <div class="section">
        <div class="section-title">Terms & Conditions</div>
        <p>{{terms_and_conditions}}</p>
      </div>
      {{/if}}
      
      {{#if notes}}
      <div class="section">
        <div class="section-title">Notes</div>
        <p>{{notes}}</p>
      </div>
      {{/if}}
    </div>
    
    <div class="footer">
      <p>This is a computer-generated quotation. Thank you for your interest in our products/services.</p>
    </div>
  </div>
</body>
</html>
`;

// ============================================================
// WHATSAPP QUOTATION TEMPLATE (TEXT)
// ============================================================

const WHATSAPP_QUOTATION_TEMPLATE = `
📋 *QUOTATION*
━━━━━━━━━━━━━━━━━━━
📄 *Ref:* {{quotation_number}}
{{#if valid_until}}⏰ *Valid Until:* {{formatDate valid_until}}{{/if}}

👤 *To:* {{customer_name}}
{{#if customer_phone}}📱 {{customer_phone}}{{/if}}
{{#if customer_gstin}}🏢 GSTIN: {{customer_gstin}}{{/if}}

━━━━━━━━━━━━━━━━━━━
📦 *ITEMS*
━━━━━━━━━━━━━━━━━━━
{{#each selectedItems}}
✅ *{{item_name}}*
   {{formatNumber quantity}} {{unit}} × {{currency rate ../currency}}
   {{#if discount_percent}}💰 Discount: {{discount_percent}}%{{/if}}
   *Amount: {{currency amount ../currency}}*
{{/each}}

━━━━━━━━━━━━━━━━━━━
💰 *SUMMARY*
━━━━━━━━━━━━━━━━━━━
Subtotal: {{currency totals.subtotal currency}}
{{#if totals.discountAmount}}Discount: -{{currency totals.discountAmount currency}}{{/if}}
{{#if totals.taxAmount}}Tax: +{{currency totals.taxAmount currency}}{{/if}}
━━━━━━━━━━━━━━━━━━━
*TOTAL: {{currency totals.totalAmount currency}}*
_({{numberToWords totals.totalAmount}})_

{{#if notes}}
📝 *Note:* {{notes}}
{{/if}}

━━━━━━━━━━━━━━━━━━━
From: {{seller_name}}
{{#if seller_phone}}📞 {{seller_phone}}{{/if}}
{{#if seller_gstin}}GSTIN: {{seller_gstin}}{{/if}}

Thank you for your inquiry! 🙏
`;

// ============================================================
// MAIN RENDER FUNCTIONS
// ============================================================

/**
 * Render Email Quotation (HTML)
 */
export function renderEmailQuotation(data: QuotationData): string {
  const selectedItems = getSelectedItems(data.items);
  
  if (selectedItems.length === 0) {
    throw new Error('Cannot generate quotation: No items selected');
  }
  
  const columns = getColumnVisibility(selectedItems);
  const totals = calculateTotals(selectedItems);
  
  const template = Handlebars.compile(EMAIL_QUOTATION_TEMPLATE);
  
  return template({
    ...data,
    selectedItems: selectedItems.map((item, index) => ({ ...item, index: index + 1 })),
    columns,
    totals,
  });
}

/**
 * Render WhatsApp Quotation (Text)
 */
export function renderWhatsAppQuotation(data: QuotationData): string {
  const selectedItems = getSelectedItems(data.items);
  
  if (selectedItems.length === 0) {
    throw new Error('Cannot generate quotation: No items selected');
  }
  
  const totals = calculateTotals(selectedItems);
  
  const template = Handlebars.compile(WHATSAPP_QUOTATION_TEMPLATE);
  
  const result = template({
    ...data,
    selectedItems,
    totals,
  });
  
  // Clean up extra whitespace and empty lines
  return result
    .split('\n')
    .map(line => line.trim())
    .filter(line => line !== '')
    .join('\n');
}

/**
 * Render quotation using a custom template from DB
 */
export function renderCustomQuotation(templateHtml: string, data: QuotationData): string {
  const selectedItems = getSelectedItems(data.items);
  
  if (selectedItems.length === 0) {
    throw new Error('Cannot generate quotation: No items selected');
  }
  
  const columns = getColumnVisibility(selectedItems);
  const totals = calculateTotals(selectedItems);
  
  const template = Handlebars.compile(templateHtml);
  
  return template({
    ...data,
    selectedItems: selectedItems.map((item, index) => ({ ...item, index: index + 1 })),
    columns,
    totals,
  });
}
