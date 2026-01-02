/**
 * PDF Generation Service
 * 
 * Uses Puppeteer for high-quality PDF rendering
 * with retry logic and error handling
 */

import { withRetry } from './retryUtil';

export interface PdfOptions {
  format?: 'A4' | 'Letter' | 'Legal';
  landscape?: boolean;
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  printBackground?: boolean;
  displayHeaderFooter?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
}

export interface PdfResult {
  success: boolean;
  buffer?: Buffer;
  error?: string;
}

const DEFAULT_OPTIONS: PdfOptions = {
  format: 'A4',
  landscape: false,
  margin: {
    top: '20mm',
    right: '15mm',
    bottom: '20mm',
    left: '15mm',
  },
  printBackground: true,
  displayHeaderFooter: false,
};

// Print-safe CSS to inject into all PDFs
const PRINT_CSS = `
<style>
  @media print {
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      line-height: 1.4;
      color: #000;
    }
    .page-break {
      page-break-after: always;
    }
    .no-print {
      display: none !important;
    }
    table {
      border-collapse: collapse;
      width: 100%;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px;
    }
    img {
      max-width: 100%;
      height: auto;
    }
  }
</style>
`;

/**
 * Generate PDF from HTML content with retry logic
 */
export async function generatePdfFromHtml(
  html: string,
  options: PdfOptions = {}
): Promise<PdfResult> {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  
  const result = await withRetry(
    async () => {
      // Try to use Puppeteer
      try {
        const puppeteer = await import('puppeteer');
        
        const browser = await puppeteer.default.launch({
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
          
          // Inject print-safe CSS and content
          const fullHtml = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              ${PRINT_CSS}
            </head>
            <body>
              ${html}
            </body>
            </html>
          `;
          
          await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
          
          const pdfBuffer = await page.pdf({
            format: mergedOptions.format,
            landscape: mergedOptions.landscape,
            margin: mergedOptions.margin,
            printBackground: mergedOptions.printBackground,
            displayHeaderFooter: mergedOptions.displayHeaderFooter,
            headerTemplate: mergedOptions.headerTemplate,
            footerTemplate: mergedOptions.footerTemplate,
          });
          
          return Buffer.from(pdfBuffer);
        } finally {
          await browser.close();
        }
      } catch (puppeteerError: any) {
        console.warn('[PDF] Puppeteer not available, using fallback:', puppeteerError.message);
        
        // Fallback: Return HTML wrapped for download
        // In production, you might use a cloud PDF service
        throw new Error('PDF generation requires Puppeteer. Install with: npm install puppeteer');
      }
    },
    {
      maxRetries: 3,
      baseDelayMs: 1000,
      onRetry: (attempt, error) => {
        console.log(`[PDF] Retry attempt ${attempt + 1}: ${error.message}`);
      },
    }
  );
  
  if (result.success && result.data) {
    return {
      success: true,
      buffer: result.data,
    };
  }
  
  return {
    success: false,
    error: result.error || 'PDF generation failed',
  };
}

/**
 * Generate Invoice PDF
 */
export async function generateInvoicePdf(
  invoiceHtml: string,
  invoiceNumber: string
): Promise<PdfResult> {
  console.log(`[PDF] Generating invoice PDF for ${invoiceNumber}`);
  
  return generatePdfFromHtml(invoiceHtml, {
    format: 'A4',
    margin: {
      top: '15mm',
      right: '10mm',
      bottom: '15mm',
      left: '10mm',
    },
  });
}

/**
 * Generate Quotation PDF
 */
export async function generateQuotationPdf(
  quotationHtml: string,
  quotationNumber: string
): Promise<PdfResult> {
  console.log(`[PDF] Generating quotation PDF for ${quotationNumber}`);
  
  return generatePdfFromHtml(quotationHtml, {
    format: 'A4',
    margin: {
      top: '15mm',
      right: '10mm',
      bottom: '15mm',
      left: '10mm',
    },
  });
}

/**
 * Generate generic report PDF
 */
export async function generateReportPdf(
  reportHtml: string,
  reportName: string,
  landscape: boolean = false
): Promise<PdfResult> {
  console.log(`[PDF] Generating report PDF: ${reportName}`);
  
  return generatePdfFromHtml(reportHtml, {
    format: 'A4',
    landscape,
    margin: {
      top: '20mm',
      right: '15mm',
      bottom: '20mm',
      left: '15mm',
    },
  });
}
