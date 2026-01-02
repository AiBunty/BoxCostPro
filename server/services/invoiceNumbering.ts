/**
 * Invoice Numbering Service
 *
 * Generates sequential invoice numbers following Indian financial year (April 1 - March 31)
 * Format: INV/FY2024-25/0001
 *
 * Example:
 * - Date: January 15, 2025 → Financial Year: 2024-2025 → INV/FY2024-25/0001
 * - Date: April 1, 2025 → Financial Year: 2025-2026 → INV/FY2025-26/0001
 */

import type { IStorage } from '../storage';

/**
 * Generate next sequential invoice number for current financial year
 *
 * @param storage - Storage instance for database queries
 * @returns Invoice number in format INV/FY2024-25/0001
 */
export async function generateInvoiceNumber(storage: IStorage): Promise<string> {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth(); // 0-11 (0=January, 3=April)
  const currentYear = currentDate.getFullYear();

  // Financial year in India: April 1 - March 31
  let fyStart: number, fyEnd: number;
  if (currentMonth >= 3) {
    // April (3) onwards - current FY
    fyStart = currentYear;
    fyEnd = currentYear + 1;
  } else {
    // January to March - previous FY
    fyStart = currentYear - 1;
    fyEnd = currentYear;
  }

  const financialYear = `${fyStart}-${fyEnd}`;

  // Get last invoice number for this financial year
  const lastInvoice = await storage.getLastInvoiceForFY(financialYear);

  let sequenceNumber = 1;
  if (lastInvoice && lastInvoice.invoiceNumber) {
    // Extract sequence number from format INV/FY2024-25/0001
    const match = lastInvoice.invoiceNumber.match(/\/(\d+)$/);
    if (match) {
      sequenceNumber = parseInt(match[1], 10) + 1;
    }
  }

  // Pad sequence with leading zeros (4 digits)
  const paddedSequence = sequenceNumber.toString().padStart(4, '0');

  // Format: INV/FY2024-25/0001
  return `INV/FY${fyStart}-${fyEnd.toString().slice(-2)}/${paddedSequence}`;
}

/**
 * Get current financial year string
 *
 * @returns Financial year in format "2024-2025"
 */
export function getCurrentFinancialYear(): string {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  if (currentMonth >= 3) {
    // April onwards
    return `${currentYear}-${currentYear + 1}`;
  } else {
    // January to March
    return `${currentYear - 1}-${currentYear}`;
  }
}

/**
 * Parse financial year from invoice number
 *
 * @param invoiceNumber - Invoice number in format INV/FY2024-25/0001
 * @returns Financial year string "2024-2025" or null if invalid format
 */
export function parseFinancialYearFromInvoice(invoiceNumber: string): string | null {
  const match = invoiceNumber.match(/FY(\d{4})-(\d{2})/);
  if (!match) return null;

  const startYear = match[1];
  const endYear = `20${match[2]}`; // Convert 25 to 2025

  return `${startYear}-${endYear}`;
}

/**
 * Validate invoice number format
 *
 * @param invoiceNumber - Invoice number to validate
 * @returns True if valid format
 */
export function validateInvoiceNumberFormat(invoiceNumber: string): boolean {
  const regex = /^INV\/FY\d{4}-\d{2}\/\d{4}$/;
  return regex.test(invoiceNumber);
}
