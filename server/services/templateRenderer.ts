/**
 * Template Rendering Service
 * Handles dynamic rendering of invoices, quotations, and other templates
 * with conditional column visibility based on user selections
 */

import Handlebars from 'handlebars';
import { readFileSync } from 'fs';
import { join } from 'path';

// Register custom Handlebars helpers
Handlebars.registerHelper('formatCurrency', (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount).replace('₹', '₹ ');
});

Handlebars.registerHelper('formatNumber', (num: number, decimals = 2) => {
  return Number(num).toFixed(decimals);
});

Handlebars.registerHelper('eq', (a: any, b: any) => a === b);
Handlebars.registerHelper('ne', (a: any, b: any) => a !== b);
Handlebars.registerHelper('gt', (a: number, b: number) => a > b);
Handlebars.registerHelper('lt', (a: number, b: number) => a < b);
Handlebars.registerHelper('and', (...args) => {
  args.pop(); // Remove Handlebars options object
  return args.every(Boolean);
});
Handlebars.registerHelper('or', (...args) => {
  args.pop(); // Remove Handlebars options object
  return args.some(Boolean);
});

// Number to words conversion for amount
Handlebars.registerHelper('amountInWords', (amount: number) => {
  return numberToWords(amount);
});

function numberToWords(num: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  if (num === 0) return 'Zero';
  
  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;
  const hundred = Math.floor(num / 100);
  num %= 100;
  const ten = Math.floor(num / 10);
  const one = num % 10;
  
  let words = '';
  
  if (crore > 0) words += numberToWords(crore) + ' Crore ';
  if (lakh > 0) words += numberToWords(lakh) + ' Lakh ';
  if (thousand > 0) words += numberToWords(thousand) + ' Thousand ';
  if (hundred > 0) words += ones[hundred] + ' Hundred ';
  
  if (ten >= 2) {
    words += tens[ten] + ' ';
    if (one > 0) words += ones[one];
  } else if (ten * 10 + one > 0) {
    words += ones[ten * 10 + one];
  }
  
  return words.trim();
}

export interface QuotationItem {
  sno: number;
  box_type: string;
  description?: string;
  length?: number;
  width?: number;
  height?: number;
  dimension_unit?: string;
  ply?: number;
  paper_spec?: string;
  gsm?: number;
  print_type?: string;
  print_colors?: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
}

export interface TemplateColumnVisibility {
  show_column_size?: boolean;
  show_column_ply?: boolean;
  show_column_paper?: boolean;
  show_column_gsm?: boolean;
  show_column_print?: boolean;
}

export interface TemplateSectionVisibility {
  show_paper_details?: boolean;
  show_printing_details?: boolean;
  show_die_details?: boolean;
  show_cost_breakdown?: boolean;
  show_gst?: boolean;
}

export interface RenderOptions extends TemplateColumnVisibility, TemplateSectionVisibility {
  template_id?: string;
  template_type: 'invoice' | 'quotation' | 'receipt';
}

/**
 * Analyzes items to determine which columns should be visible
 * A column is shown only if at least one item has a value for that field
 */
export function analyzeColumnVisibility(items: QuotationItem[]): TemplateColumnVisibility {
  const visibility: TemplateColumnVisibility = {
    show_column_size: false,
    show_column_ply: false,
    show_column_paper: false,
    show_column_gsm: false,
    show_column_print: false
  };
  
  for (const item of items) {
    if (item.length && item.width && item.height) {
      visibility.show_column_size = true;
    }
    if (item.ply && item.ply > 0) {
      visibility.show_column_ply = true;
    }
    if (item.paper_spec && item.paper_spec.trim() !== '') {
      visibility.show_column_paper = true;
    }
    if (item.gsm && item.gsm > 0) {
      visibility.show_column_gsm = true;
    }
    if (item.print_type && item.print_type.trim() !== '') {
      visibility.show_column_print = true;
    }
  }
  
  return visibility;
}

/**
 * Filters items to only include selected ones
 * Removes any item that the user has unchecked
 */
export function filterSelectedItems(
  items: QuotationItem[],
  selectedIds: number[]
): QuotationItem[] {
  return items
    .filter(item => selectedIds.includes(item.sno))
    .map((item, index) => ({
      ...item,
      sno: index + 1 // Renumber after filtering
    }));
}

/**
 * Calculates totals from items
 */
export function calculateTotals(
  items: QuotationItem[],
  options: {
    discount_percent?: number;
    is_igst?: boolean;
    gst_rate?: number;
    transport_charges?: number;
  } = {}
) {
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const discount_amount = options.discount_percent 
    ? subtotal * (options.discount_percent / 100) 
    : 0;
  const taxable_amount = subtotal - discount_amount;
  
  const gst_rate = options.gst_rate || 18;
  const total_gst = taxable_amount * (gst_rate / 100);
  
  let cgst_amount = 0, sgst_amount = 0, igst_amount = 0;
  if (options.is_igst) {
    igst_amount = total_gst;
  } else {
    cgst_amount = total_gst / 2;
    sgst_amount = total_gst / 2;
  }
  
  const transport = options.transport_charges || 0;
  const grand_total = taxable_amount + total_gst + transport;
  
  return {
    subtotal: subtotal.toFixed(2),
    discount_amount: discount_amount > 0 ? discount_amount.toFixed(2) : null,
    discount_percent: options.discount_percent,
    taxable_amount: taxable_amount.toFixed(2),
    cgst_rate: gst_rate / 2,
    cgst_amount: cgst_amount.toFixed(2),
    sgst_rate: gst_rate / 2,
    sgst_amount: sgst_amount.toFixed(2),
    igst_rate: gst_rate,
    igst_amount: igst_amount.toFixed(2),
    is_igst: options.is_igst,
    transport_charges: transport > 0 ? transport.toFixed(2) : null,
    grand_total: grand_total.toFixed(2),
    amount_in_words: numberToWords(Math.round(grand_total))
  };
}

/**
 * Gets template HTML from database or file system
 */
export async function getTemplateHtml(
  templateId: string,
  templateType: 'invoice' | 'quotation' | 'whatsapp' | 'email',
  db?: any
): Promise<string> {
  // Try to get from database first (for user-customized templates)
  if (db) {
    try {
      const tableName = `${templateType}_templates`;
      const result = await db.query(`
        SELECT html_content FROM ${tableName}
        WHERE id = $1 AND is_active = true
      `, [templateId]);
      
      if (result.rows.length > 0) {
        return result.rows[0].html_content;
      }
    } catch (error) {
      console.warn(`Template not found in DB, falling back to file system: ${templateId}`);
    }
  }
  
  // Fall back to file system
  const templatePath = join(
    process.cwd(),
    'server',
    'templates',
    `${templateType}s`,
    `${templateId}.html`
  );
  
  return readFileSync(templatePath, 'utf-8');
}

/**
 * Main render function - renders template with data and conditional visibility
 */
export async function renderTemplate(
  templateHtml: string,
  data: Record<string, any>,
  options: RenderOptions
): Promise<string> {
  // Merge visibility flags into data
  const renderData = {
    ...data,
    ...options,
    // Add computed visibility from items if not explicitly set
    ...(data.items ? analyzeColumnVisibility(data.items) : {})
  };
  
  // Override with explicit user selections if provided
  if (options.show_column_size !== undefined) renderData.show_column_size = options.show_column_size;
  if (options.show_column_ply !== undefined) renderData.show_column_ply = options.show_column_ply;
  if (options.show_column_paper !== undefined) renderData.show_column_paper = options.show_column_paper;
  if (options.show_column_gsm !== undefined) renderData.show_column_gsm = options.show_column_gsm;
  if (options.show_column_print !== undefined) renderData.show_column_print = options.show_column_print;
  
  // Compile and render template
  const template = Handlebars.compile(templateHtml);
  return template(renderData);
}

/**
 * Full rendering pipeline with item filtering and calculation
 */
export async function renderQuotation(
  templateId: string,
  allItems: QuotationItem[],
  selectedItemIds: number[],
  partyData: Record<string, any>,
  options: {
    visibility?: Partial<TemplateColumnVisibility & TemplateSectionVisibility>;
    discount_percent?: number;
    is_igst?: boolean;
    gst_rate?: number;
    transport_charges?: number;
    db?: any;
  } = {}
): Promise<string> {
  // Filter to only selected items
  const items = filterSelectedItems(allItems, selectedItemIds);
  
  if (items.length === 0) {
    throw new Error('No items selected for quotation');
  }
  
  // Calculate totals
  const totals = calculateTotals(items, {
    discount_percent: options.discount_percent,
    is_igst: options.is_igst,
    gst_rate: options.gst_rate,
    transport_charges: options.transport_charges
  });
  
  // Auto-detect column visibility based on selected items
  const autoVisibility = analyzeColumnVisibility(items);
  
  // Merge auto-detected with user overrides
  const visibility = {
    ...autoVisibility,
    ...(options.visibility || {})
  };
  
  // Get template HTML
  const templateHtml = await getTemplateHtml(templateId, 'quotation', options.db);
  
  // Render with all data
  return renderTemplate(templateHtml, {
    items: items.map(item => ({
      ...item,
      rate: item.rate.toFixed(2),
      amount: item.amount.toFixed(2)
    })),
    ...partyData,
    ...totals
  }, {
    template_type: 'quotation',
    ...visibility
  });
}

/**
 * Render invoice with similar logic
 */
export async function renderInvoice(
  templateId: string,
  invoiceData: Record<string, any>,
  options: {
    visibility?: Partial<TemplateSectionVisibility>;
    db?: any;
  } = {}
): Promise<string> {
  const templateHtml = await getTemplateHtml(templateId, 'invoice', options.db);
  
  return renderTemplate(templateHtml, invoiceData, {
    template_type: 'invoice',
    ...(options.visibility || {})
  });
}

/**
 * Validate template HTML for required placeholders
 */
export function validateTemplateHtml(
  html: string,
  requiredPlaceholders: string[]
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  
  for (const placeholder of requiredPlaceholders) {
    const regex = new RegExp(`{{\\s*${placeholder}\\s*}}`, 'g');
    if (!regex.test(html)) {
      missing.push(placeholder);
    }
  }
  
  return {
    valid: missing.length === 0,
    missing
  };
}

/**
 * Extract all placeholders from a template
 */
export function extractPlaceholders(html: string): string[] {
  const regex = /{{([^#/][^}]*)}}/g;
  const placeholders = new Set<string>();
  let match;
  
  while ((match = regex.exec(html)) !== null) {
    const placeholder = match[1].trim();
    // Ignore helper calls
    if (!placeholder.includes(' ')) {
      placeholders.add(placeholder);
    }
  }
  
  return Array.from(placeholders);
}

export default {
  renderTemplate,
  renderQuotation,
  renderInvoice,
  analyzeColumnVisibility,
  filterSelectedItems,
  calculateTotals,
  getTemplateHtml,
  validateTemplateHtml,
  extractPlaceholders,
  numberToWords
};
