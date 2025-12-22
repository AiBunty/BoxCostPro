/**
 * Email Template Renderer
 * Handles placeholder replacement and dynamic column generation for HTML emails
 */

import { ShowColumns, FilteredItem, getEnabledColumnHeaders } from './templateRenderer';

export interface EmailTemplateData {
  BusinessName?: string;
  OwnerName?: string;
  BusinessPhone?: string;
  BusinessEmail?: string;
  GSTNo?: string;
  Website?: string;
  MapLink?: string;
  PartyName?: string;
  QuoteNo?: string;
  QuoteDate?: string;
  Subtotal?: string;
  GST?: string;
  GSTAmount?: string;
  GrandTotal?: string;
  PaymentTerms?: string;
  DeliveryTimeline?: string;
  QuoteLink?: string;
  DynamicHeaders?: string;
  ItemRows?: string;
  [key: string]: string | undefined;
}

/**
 * Render email template with placeholder replacement
 */
export function renderEmailTemplate(templateHtml: string, data: EmailTemplateData): string {
  let html = templateHtml;
  
  Object.keys(data).forEach(key => {
    const value = data[key];
    if (typeof value === 'string' || typeof value === 'number') {
      html = html.replaceAll(`{{${key}}}`, String(value ?? ''));
    }
  });
  
  // Clean up any remaining unreplaced placeholders
  html = html.replace(/\{\{[^}]+\}\}/g, '');
  
  return html;
}

/**
 * Generate dynamic table headers based on Show Columns configuration
 */
export function generateDynamicHeaders(showColumns: ShowColumns): string {
  const headers = getEnabledColumnHeaders(showColumns);
  return headers.map(header => `<th style="padding: 12px 8px; text-align: left; border-bottom: 2px solid #ddd; background-color: #f8f9fa;">${header}</th>`).join('\n');
}

/**
 * Generate a single table row for an item
 */
export function generateItemRow(item: FilteredItem, showColumns: ShowColumns): string {
  const cells: string[] = [];
  const cellStyle = 'padding: 10px 8px; border-bottom: 1px solid #eee;';
  
  cells.push(`<td style="${cellStyle}">${item.index}</td>`);
  cells.push(`<td style="${cellStyle}">${item.itemName}</td>`);
  
  if (showColumns.boxSize) cells.push(`<td style="${cellStyle}">${item.boxSize || '-'}</td>`);
  if (showColumns.board) cells.push(`<td style="${cellStyle}">${item.board || '-'}</td>`);
  if (showColumns.flute) cells.push(`<td style="${cellStyle}">${item.flute || '-'}</td>`);
  if (showColumns.paper) cells.push(`<td style="${cellStyle}">${item.paper || '-'}</td>`);
  if (showColumns.printing) cells.push(`<td style="${cellStyle}">${item.printing || '-'}</td>`);
  if (showColumns.lamination) cells.push(`<td style="${cellStyle}">${item.lamination || '-'}</td>`);
  if (showColumns.varnish) cells.push(`<td style="${cellStyle}">${item.varnish || '-'}</td>`);
  if (showColumns.weight) cells.push(`<td style="${cellStyle}">${item.weight ? `${item.weight} kg` : '-'}</td>`);
  
  cells.push(`<td style="${cellStyle}">${item.qty}</td>`);
  cells.push(`<td style="${cellStyle}">₹${item.rateIncl?.toFixed(2) || '0.00'}</td>`);
  
  return `<tr>${cells.join('')}</tr>`;
}

/**
 * Generate all item rows for the email table
 */
export function generateItemRows(items: FilteredItem[], showColumns: ShowColumns): string {
  return items.map(item => generateItemRow(item, showColumns)).join('\n');
}

/**
 * Generate complete items table HTML
 */
export function generateItemsTable(items: FilteredItem[], showColumns: ShowColumns): string {
  const headers = generateDynamicHeaders(showColumns);
  const rows = generateItemRows(items, showColumns);
  
  return `
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-family: Arial, sans-serif;">
      <thead>
        <tr>
          ${headers}
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

/**
 * Generate professional HTML email template for quotes
 */
export function generateQuoteEmailHtml(data: EmailTemplateData, items: FilteredItem[], showColumns: ShowColumns): string {
  const itemsTable = generateItemsTable(items, showColumns);
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quote - ${data.QuoteNo || ''}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">${data.BusinessName || 'BoxCostPro'}</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0;">${data.BusinessEmail || ''} | ${data.BusinessPhone || ''}</p>
  </div>
  
  <div style="background: #fff; padding: 30px; border: 1px solid #ddd; border-top: none;">
    <p style="font-size: 16px;">Dear <strong>${data.PartyName || 'Customer'}</strong>,</p>
    
    <p>Thank you for your inquiry. Please find below our quotation for your reference:</p>
    
    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <table style="width: 100%;">
        <tr>
          <td><strong>Quote No:</strong> ${data.QuoteNo || ''}</td>
          <td><strong>Date:</strong> ${data.QuoteDate || ''}</td>
        </tr>
      </table>
    </div>
    
    ${itemsTable}
    
    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <table style="width: 100%;">
        <tr>
          <td style="text-align: right; padding: 5px 0;"><strong>Subtotal:</strong></td>
          <td style="text-align: right; padding: 5px 0; width: 150px;">₹${data.Subtotal || '0.00'}</td>
        </tr>
        <tr>
          <td style="text-align: right; padding: 5px 0;"><strong>GST (${data.GST || '18'}%):</strong></td>
          <td style="text-align: right; padding: 5px 0;">₹${data.GSTAmount || '0.00'}</td>
        </tr>
        <tr style="border-top: 2px solid #ddd;">
          <td style="text-align: right; padding: 10px 0;"><strong style="font-size: 18px;">Grand Total:</strong></td>
          <td style="text-align: right; padding: 10px 0;"><strong style="font-size: 18px; color: #667eea;">₹${data.GrandTotal || '0.00'}</strong></td>
        </tr>
      </table>
    </div>
    
    ${data.PaymentTerms ? `<p><strong>Payment Terms:</strong> ${data.PaymentTerms}</p>` : ''}
    ${data.DeliveryTimeline ? `<p><strong>Delivery Timeline:</strong> ${data.DeliveryTimeline}</p>` : ''}
    
    <p>If you have any questions, please feel free to contact us.</p>
    
    <p style="margin-top: 30px;">
      Best regards,<br>
      <strong>${data.OwnerName || ''}</strong><br>
      ${data.BusinessName || ''}<br>
      ${data.BusinessPhone ? `Phone: ${data.BusinessPhone}` : ''}<br>
      ${data.Website ? `Website: ${data.Website}` : ''}
    </p>
  </div>
  
  <div style="background: #333; color: white; padding: 20px; border-radius: 0 0 10px 10px; text-align: center;">
    <p style="margin: 0;">GSTIN: ${data.GSTNo || ''}</p>
    ${data.MapLink ? `<p style="margin: 10px 0 0 0;"><a href="${data.MapLink}" style="color: #667eea;">View Location</a></p>` : ''}
  </div>
</body>
</html>
  `;
}
