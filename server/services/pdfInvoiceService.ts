/**
 * PDF Invoice Generation Service
 * Generates GST-compliant PDF invoices using Puppeteer
 *
 * CRITICAL FEATURES:
 * - Loads HTML templates from filesystem
 * - Injects invoice data using Handlebars
 * - Generates PDF with Puppeteer
 * - Stores PDF immutably
 * - Prevents regeneration
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import Handlebars from 'handlebars';
import type { InvoiceData } from '../utils/sampleInvoiceData';

// Puppeteer will be dynamically imported to avoid bundling issues
let puppeteer: any = null;

/**
 * Initialize Puppeteer (lazy loading)
 */
async function initPuppeteer() {
  if (!puppeteer) {
    puppeteer = await import('puppeteer');
  }
  return puppeteer;
}

/**
 * Register Handlebars helpers
 */
function registerHandlebarsHelpers() {
  // Helper: Add two numbers
  if (!Handlebars.helpers['add']) {
    Handlebars.registerHelper('add', function (a: number, b: number) {
      return a + b;
    });
  }

  // Helper: Format currency
  if (!Handlebars.helpers['currency']) {
    Handlebars.registerHelper('currency', function (amount: number | string) {
      const num = typeof amount === 'string' ? parseFloat(amount.replace(/,/g, '')) : amount;
      return num.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    });
  }
}

// Register helpers on module load
registerHandlebarsHelpers();

/**
 * Load HTML template from filesystem
 */
export async function loadInvoiceTemplate(templateKey: string): Promise<string> {
  const templatePath = join(process.cwd(), 'server', 'templates', 'invoices', `${templateKey}.html`);

  if (!existsSync(templatePath)) {
    throw new Error(`Invoice template not found: ${templateKey}`);
  }

  const htmlContent = await readFile(templatePath, 'utf-8');
  return htmlContent;
}

/**
 * Render invoice HTML with data
 */
export function renderInvoiceHTML(templateHTML: string, invoiceData: InvoiceData): string {
  const template = Handlebars.compile(templateHTML);
  const rendered = template(invoiceData);
  return rendered;
}

/**
 * Generate PDF from HTML using Puppeteer
 */
export async function generatePDFFromHTML(html: string): Promise<Buffer> {
  const pptr = await initPuppeteer();

  const browser = await pptr.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  try {
    const page = await browser.newPage();

    // Set content
    await page.setContent(html, {
      waitUntil: 'networkidle0',
    });

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '10mm',
        right: '10mm',
        bottom: '10mm',
        left: '10mm',
      },
    });

    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

/**
 * Save PDF to filesystem
 * Path structure: invoices/{userId}/{invoiceId}.pdf
 */
export async function savePDFToFile(pdfBuffer: Buffer, userId: string, invoiceId: string): Promise<string> {
  const invoicesDir = join(process.cwd(), 'invoices', userId);

  // Create directory if it doesn't exist
  if (!existsSync(invoicesDir)) {
    await mkdir(invoicesDir, { recursive: true });
  }

  const pdfPath = join(invoicesDir, `${invoiceId}.pdf`);
  await writeFile(pdfPath, pdfBuffer);

  // Return relative path for storage in database
  return `invoices/${userId}/${invoiceId}.pdf`;
}

/**
 * MAIN FUNCTION: Generate Invoice PDF
 *
 * @param invoiceData - Invoice data with all details
 * @param templateKey - Template key (classic-gst, modern-saas, minimal-print)
 * @param userId - User ID for file organization
 * @param invoiceId - Invoice ID (quote ID)
 * @returns PDF file path
 */
export async function generateInvoicePDF(
  invoiceData: InvoiceData,
  templateKey: string,
  userId: string,
  invoiceId: string
): Promise<{ pdfPath: string; pdfBuffer: Buffer }> {
  try {
    console.log(`[PDF Service] Starting PDF generation for invoice ${invoiceId}`);

    // Step 1: Load template
    console.log(`[PDF Service] Loading template: ${templateKey}`);
    const templateHTML = await loadInvoiceTemplate(templateKey);

    // Step 2: Render HTML with data
    console.log(`[PDF Service] Rendering HTML with invoice data`);
    const renderedHTML = renderInvoiceHTML(templateHTML, invoiceData);

    // Step 3: Generate PDF
    console.log(`[PDF Service] Generating PDF with Puppeteer`);
    const pdfBuffer = await generatePDFFromHTML(renderedHTML);

    // Step 4: Save PDF
    console.log(`[PDF Service] Saving PDF to filesystem`);
    const pdfPath = await savePDFToFile(pdfBuffer, userId, invoiceId);

    console.log(`[PDF Service] ✓ PDF generated successfully: ${pdfPath}`);

    return { pdfPath, pdfBuffer };
  } catch (error: any) {
    console.error(`[PDF Service] ✗ PDF generation failed:`, error);
    throw new Error(`Failed to generate invoice PDF: ${error.message}`);
  }
}

/**
 * Generate preview HTML (for admin UI)
 * Does NOT generate PDF, just renders HTML
 */
export async function generateInvoicePreviewHTML(
  invoiceData: InvoiceData,
  templateKey: string
): Promise<string> {
  try {
    const templateHTML = await loadInvoiceTemplate(templateKey);
    const renderedHTML = renderInvoiceHTML(templateHTML, invoiceData);
    return renderedHTML;
  } catch (error: any) {
    console.error(`[PDF Service] Preview generation failed:`, error);
    throw new Error(`Failed to generate invoice preview: ${error.message}`);
  }
}

/**
 * Check if PDF already exists for an invoice
 */
export function isPDFGenerated(userId: string, invoiceId: string): boolean {
  const pdfPath = join(process.cwd(), 'invoices', userId, `${invoiceId}.pdf`);
  return existsSync(pdfPath);
}

/**
 * Read existing PDF file
 */
export async function readPDFFile(pdfPath: string): Promise<Buffer> {
  const fullPath = join(process.cwd(), pdfPath);

  if (!existsSync(fullPath)) {
    throw new Error(`PDF file not found: ${pdfPath}`);
  }

  return await readFile(fullPath);
}

/**
 * Validate invoice data before PDF generation
 */
export function validateInvoiceData(invoiceData: Partial<InvoiceData>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!invoiceData.invoice?.number) errors.push('Invoice number is required');
  if (!invoiceData.invoice?.date) errors.push('Invoice date is required');
  if (!invoiceData.seller?.company_name) errors.push('Seller company name is required');
  if (!invoiceData.seller?.gstin) errors.push('Seller GSTIN is required');
  if (!invoiceData.buyer?.company_name) errors.push('Buyer company name is required');
  if (!invoiceData.items || invoiceData.items.length === 0) errors.push('At least one line item is required');
  if (!invoiceData.totals?.grand_total) errors.push('Grand total is required');

  return {
    valid: errors.length === 0,
    errors,
  };
}
