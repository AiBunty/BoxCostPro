/**
 * Template Renderer Utility
 * Core engine for filtering quote items based on Show Columns configuration
 */

export type ShowColumns = {
  boxSize?: boolean;
  board?: boolean;
  flute?: boolean;
  paper?: boolean;
  printing?: boolean;
  lamination?: boolean;
  varnish?: boolean;
  weight?: boolean;
};

export interface QuoteItem {
  itemName?: string;
  boxName?: string;
  boxSize?: string;
  board?: string;
  flute?: string;
  paperSummary?: string;
  printing?: string;
  lamination?: string;
  varnish?: string;
  weight?: number;
  qty?: number;
  rateIncl?: number;
  rateExcl?: number;
  [key: string]: any;
}

export interface FilteredItem {
  index: number;
  itemName: string;
  qty: number;
  rateIncl: number;
  rateExcl: number;
  boxSize?: string;
  board?: string;
  flute?: string;
  paper?: string;
  printing?: string;
  lamination?: string;
  varnish?: string;
  weight?: number;
}

/**
 * Filters quote items based on Show Columns configuration
 * Only includes columns that are enabled in showColumns
 */
export function renderItemsForTemplate(
  items: QuoteItem[],
  showColumns: ShowColumns
): FilteredItem[] {
  return items.map((item, index) => {
    const filtered: FilteredItem = {
      index: index + 1,
      itemName: item.itemName || item.boxName || '',
      qty: item.qty || 0,
      rateIncl: item.rateIncl || 0,
      rateExcl: item.rateExcl || 0,
    };

    if (showColumns.boxSize) filtered.boxSize = item.boxSize;
    if (showColumns.board) filtered.board = item.board;
    if (showColumns.flute) filtered.flute = item.flute;
    if (showColumns.paper) filtered.paper = item.paperSummary;
    if (showColumns.printing) filtered.printing = item.printing;
    if (showColumns.lamination) filtered.lamination = item.lamination;
    if (showColumns.varnish) filtered.varnish = item.varnish;
    if (showColumns.weight) filtered.weight = item.weight;

    return filtered;
  });
}

/**
 * Get column headers based on Show Columns configuration
 * Returns only headers for enabled columns
 */
export function getEnabledColumnHeaders(showColumns: ShowColumns): string[] {
  const headers: string[] = ['#', 'Item'];
  
  if (showColumns.boxSize) headers.push('Box Size');
  if (showColumns.board) headers.push('Board');
  if (showColumns.flute) headers.push('Flute');
  if (showColumns.paper) headers.push('Paper Spec');
  if (showColumns.printing) headers.push('Printing');
  if (showColumns.lamination) headers.push('Lamination');
  if (showColumns.varnish) headers.push('Varnish');
  if (showColumns.weight) headers.push('Weight');
  
  headers.push('Qty', 'Rate');
  
  return headers;
}

/**
 * Format item row for WhatsApp (plain text)
 */
export function formatItemForWhatsApp(
  item: FilteredItem,
  showColumns: ShowColumns
): string {
  const parts: string[] = [`${item.index}. ${item.itemName}`];
  
  if (showColumns.boxSize && item.boxSize) parts.push(`Size: ${item.boxSize}`);
  if (showColumns.board && item.board) parts.push(`Board: ${item.board}`);
  if (showColumns.flute && item.flute) parts.push(`Flute: ${item.flute}`);
  if (showColumns.paper && item.paper) parts.push(`Paper: ${item.paper}`);
  if (showColumns.printing && item.printing) parts.push(`Printing: ${item.printing}`);
  if (showColumns.lamination && item.lamination) parts.push(`Lamination: ${item.lamination}`);
  if (showColumns.varnish && item.varnish) parts.push(`Varnish: ${item.varnish}`);
  if (showColumns.weight && item.weight) parts.push(`Weight: ${item.weight}kg`);
  
  parts.push(`Qty: ${item.qty}`);
  parts.push(`Rate: ₹${item.rateIncl?.toFixed(2) || '0.00'}`);
  
  return parts.join(' | ');
}

/**
 * Generate items list for WhatsApp template
 */
export function generateWhatsAppItemsList(
  items: FilteredItem[],
  showColumns: ShowColumns
): string {
  return items.map(item => formatItemForWhatsApp(item, showColumns)).join('\n');
}
