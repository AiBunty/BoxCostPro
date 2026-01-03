/**
 * PDF Generation Service
 * Handles conversion of HTML templates to PDF with retry logic
 * Supports multiple rendering engines: Puppeteer, Playwright, wkhtmltopdf
 */

import { randomUUID } from 'crypto';

// Configuration for PDF generation
export interface PdfConfig {
  engine: 'puppeteer' | 'playwright' | 'wkhtmltopdf';
  format: 'A4' | 'A5' | 'Letter' | 'Legal';
  orientation: 'portrait' | 'landscape';
  margin: {
    top: string;
    bottom: string;
    left: string;
    right: string;
  };
  printBackground: boolean;
  displayHeaderFooter: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
}

export interface PdfGenerationResult {
  success: boolean;
  pdf_buffer?: Buffer;
  file_path?: string;
  generation_time_ms: number;
  engine_used: string;
  error?: string;
  retry_count: number;
}

export interface PdfGenerationLog {
  id: string;
  document_type: 'invoice' | 'quotation' | 'receipt' | 'other';
  document_id: string;
  template_id: string;
  tenant_id: string;
  status: 'pending' | 'success' | 'failed';
  engine_used: string;
  generation_time_ms: number;
  file_size_bytes?: number;
  retry_count: number;
  error_message?: string;
  created_at: Date;
}

// Default configuration
const DEFAULT_CONFIG: PdfConfig = {
  engine: 'puppeteer',
  format: 'A4',
  orientation: 'portrait',
  margin: {
    top: '10mm',
    bottom: '10mm',
    left: '10mm',
    right: '10mm'
  },
  printBackground: true,
  displayHeaderFooter: false
};

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff in ms

/**
 * Sleep function for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate PDF using Puppeteer
 */
async function generateWithPuppeteer(
  html: string,
  config: PdfConfig
): Promise<Buffer> {
  // Dynamic import for optional dependency
  const puppeteer = await import('puppeteer');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Set content
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: config.format,
      landscape: config.orientation === 'landscape',
      printBackground: config.printBackground,
      margin: config.margin,
      displayHeaderFooter: config.displayHeaderFooter,
      headerTemplate: config.headerTemplate,
      footerTemplate: config.footerTemplate
    });
    
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

/**
 * Generate PDF using Playwright
 */
async function generateWithPlaywright(
  html: string,
  config: PdfConfig
): Promise<Buffer> {
  // Dynamic import for optional dependency
  const { chromium } = await import('playwright');
  
  const browser = await chromium.launch({ headless: true });
  
  try {
    const page = await browser.newPage();
    
    // Set content
    await page.setContent(html, { waitUntil: 'networkidle' });
    
    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: config.format,
      landscape: config.orientation === 'landscape',
      printBackground: config.printBackground,
      margin: config.margin,
      displayHeaderFooter: config.displayHeaderFooter,
      headerTemplate: config.headerTemplate,
      footerTemplate: config.footerTemplate
    });
    
    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

/**
 * Generate PDF using wkhtmltopdf (CLI tool)
 */
async function generateWithWkhtmltopdf(
  html: string,
  config: PdfConfig
): Promise<Buffer> {
  const { spawn } = await import('child_process');
  const { writeFileSync, readFileSync, unlinkSync } = await import('fs');
  const { tmpdir } = await import('os');
  const { join } = await import('path');
  
  const tempHtmlPath = join(tmpdir(), `temp_${randomUUID()}.html`);
  const tempPdfPath = join(tmpdir(), `temp_${randomUUID()}.pdf`);
  
  try {
    // Write HTML to temp file
    writeFileSync(tempHtmlPath, html, 'utf-8');
    
    // Build wkhtmltopdf arguments
    const args = [
      '--page-size', config.format,
      '--orientation', config.orientation === 'landscape' ? 'Landscape' : 'Portrait',
      '--margin-top', config.margin.top,
      '--margin-bottom', config.margin.bottom,
      '--margin-left', config.margin.left,
      '--margin-right', config.margin.right,
      '--enable-local-file-access',
      tempHtmlPath,
      tempPdfPath
    ];
    
    if (config.printBackground) {
      args.unshift('--background');
    }
    
    // Run wkhtmltopdf
    await new Promise<void>((resolve, reject) => {
      const proc = spawn('wkhtmltopdf', args);
      let stderr = '';
      
      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`wkhtmltopdf exited with code ${code}: ${stderr}`));
        }
      });
      
      proc.on('error', reject);
    });
    
    // Read generated PDF
    return readFileSync(tempPdfPath);
  } finally {
    // Cleanup temp files
    try { unlinkSync(tempHtmlPath); } catch {}
    try { unlinkSync(tempPdfPath); } catch {}
  }
}

/**
 * Main PDF generation function with retry logic
 */
export async function generatePdf(
  html: string,
  config: Partial<PdfConfig> = {},
  logToDb?: (log: PdfGenerationLog) => Promise<void>,
  logContext?: { document_type: 'invoice' | 'quotation' | 'receipt' | 'other'; document_id: string; template_id: string; tenant_id: string }
): Promise<PdfGenerationResult> {
  const fullConfig: PdfConfig = { ...DEFAULT_CONFIG, ...config };
  const engines = [fullConfig.engine];
  
  // Add fallback engines
  if (fullConfig.engine === 'puppeteer') {
    engines.push('playwright', 'wkhtmltopdf');
  } else if (fullConfig.engine === 'playwright') {
    engines.push('puppeteer', 'wkhtmltopdf');
  } else {
    engines.push('puppeteer', 'playwright');
  }
  
  let lastError: Error | null = null;
  let totalRetries = 0;
  
  for (const engine of engines) {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const startTime = Date.now();
      
      try {
        let pdfBuffer: Buffer;
        
        switch (engine) {
          case 'puppeteer':
            pdfBuffer = await generateWithPuppeteer(html, fullConfig);
            break;
          case 'playwright':
            pdfBuffer = await generateWithPlaywright(html, fullConfig);
            break;
          case 'wkhtmltopdf':
            pdfBuffer = await generateWithWkhtmltopdf(html, fullConfig);
            break;
          default:
            throw new Error(`Unknown PDF engine: ${engine}`);
        }
        
        const generationTime = Date.now() - startTime;
        
        // Log success
        if (logToDb && logContext) {
          await logToDb({
            id: randomUUID(),
            ...logContext,
            status: 'success',
            engine_used: engine,
            generation_time_ms: generationTime,
            file_size_bytes: pdfBuffer.length,
            retry_count: totalRetries,
            created_at: new Date()
          });
        }
        
        return {
          success: true,
          pdf_buffer: pdfBuffer,
          generation_time_ms: generationTime,
          engine_used: engine,
          retry_count: totalRetries
        };
        
      } catch (error) {
        lastError = error as Error;
        totalRetries++;
        
        console.error(`PDF generation failed with ${engine} (attempt ${attempt + 1}):`, error);
        
        // Wait before retry (exponential backoff)
        if (attempt < MAX_RETRIES - 1) {
          await sleep(RETRY_DELAYS[attempt]);
        }
      }
    }
  }
  
  // All engines and retries failed
  const errorMessage = lastError?.message || 'Unknown error';
  
  // Log failure
  if (logToDb && logContext) {
    await logToDb({
      id: randomUUID(),
      ...logContext,
      status: 'failed',
      engine_used: engines.join(','),
      generation_time_ms: 0,
      retry_count: totalRetries,
      error_message: errorMessage,
      created_at: new Date()
    });
  }
  
  return {
    success: false,
    generation_time_ms: 0,
    engine_used: engines.join(','),
    error: errorMessage,
    retry_count: totalRetries
  };
}

/**
 * Save PDF to file system
 */
export async function savePdfToFile(
  pdfBuffer: Buffer,
  filePath: string
): Promise<void> {
  const { writeFile, mkdir } = await import('fs/promises');
  const { dirname } = await import('path');
  
  // Ensure directory exists
  await mkdir(dirname(filePath), { recursive: true });
  
  // Write file
  await writeFile(filePath, pdfBuffer);
}

/**
 * Get PDF file path for a document
 */
export function getPdfFilePath(
  documentType: 'invoice' | 'quotation' | 'receipt',
  documentId: string,
  tenantId: string
): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  
  return `uploads/pdfs/${tenantId}/${documentType}s/${year}/${month}/${documentId}.pdf`;
}

/**
 * Generate and save PDF
 */
export async function generateAndSavePdf(
  html: string,
  documentType: 'invoice' | 'quotation' | 'receipt',
  documentId: string,
  templateId: string,
  tenantId: string,
  config: Partial<PdfConfig> = {},
  logToDb?: (log: PdfGenerationLog) => Promise<void>
): Promise<PdfGenerationResult & { file_path?: string }> {
  const result = await generatePdf(html, config, logToDb, {
    document_type: documentType,
    document_id: documentId,
    template_id: templateId,
    tenant_id: tenantId
  });
  
  if (result.success && result.pdf_buffer) {
    const filePath = getPdfFilePath(documentType, documentId, tenantId);
    await savePdfToFile(result.pdf_buffer, filePath);
    return { ...result, file_path: filePath };
  }
  
  return result;
}

/**
 * Batch generate PDFs
 */
export async function batchGeneratePdfs(
  items: Array<{
    html: string;
    documentType: 'invoice' | 'quotation' | 'receipt';
    documentId: string;
    templateId: string;
    tenantId: string;
  }>,
  config: Partial<PdfConfig> = {},
  logToDb?: (log: PdfGenerationLog) => Promise<void>,
  concurrency = 3
): Promise<Array<PdfGenerationResult & { document_id: string }>> {
  const results: Array<PdfGenerationResult & { document_id: string }> = [];
  
  // Process in batches to limit concurrency
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    
    const batchResults = await Promise.all(
      batch.map(async (item) => {
        const result = await generateAndSavePdf(
          item.html,
          item.documentType,
          item.documentId,
          item.templateId,
          item.tenantId,
          config,
          logToDb
        );
        return { ...result, document_id: item.documentId };
      })
    );
    
    results.push(...batchResults);
  }
  
  return results;
}

export default {
  generatePdf,
  savePdfToFile,
  getPdfFilePath,
  generateAndSavePdf,
  batchGeneratePdfs
};
