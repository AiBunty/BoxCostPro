/**
 * Quote to Invoice Data Mapper
 * Transforms quote data into GST-compliant invoice format for PDF generation
 */

import type { Quote, QuoteVersion, QuoteItemVersion, CompanyProfile, PartyProfile } from "@shared/schema";
import type { InvoiceData, InvoiceLineItem } from "./sampleInvoiceData";
import { getCurrentFinancialYear } from "../services/invoiceNumbering";

/**
 * Convert number to Indian words format
 * Example: 59426.73 -> "Fifty Nine Thousand Four Hundred Twenty Six Rupees and Seventy Three Paise Only"
 */
export function convertToWords(amount: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

  function convertLessThanThousand(n: number): string {
    if (n === 0) return '';

    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');

    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + convertLessThanThousand(n % 100) : '');
  }

  function convertIndianNumberSystem(n: number): string {
    if (n === 0) return 'Zero';

    const crore = Math.floor(n / 10000000);
    const lakh = Math.floor((n % 10000000) / 100000);
    const thousand = Math.floor((n % 100000) / 1000);
    const remainder = n % 1000;

    let result = '';

    if (crore > 0) {
      result += convertLessThanThousand(crore) + ' Crore ';
    }
    if (lakh > 0) {
      result += convertLessThanThousand(lakh) + ' Lakh ';
    }
    if (thousand > 0) {
      result += convertLessThanThousand(thousand) + ' Thousand ';
    }
    if (remainder > 0) {
      result += convertLessThanThousand(remainder);
    }

    return result.trim();
  }

  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);

  let words = convertIndianNumberSystem(rupees) + ' Rupee' + (rupees !== 1 ? 's' : '');

  if (paise > 0) {
    words += ' and ' + convertIndianNumberSystem(paise) + ' Paise';
  }

  return words + ' Only';
}

/**
 * Check if transaction is inter-state based on GST state codes
 */
export function isInterStateTransaction(sellerGSTIN: string, buyerGSTIN: string): boolean {
  if (!sellerGSTIN || !buyerGSTIN) return false;

  const sellerStateCode = sellerGSTIN.substring(0, 2);
  const buyerStateCode = buyerGSTIN.substring(0, 2);

  return sellerStateCode !== buyerStateCode;
}

/**
 * Extract state code from GSTIN
 */
export function getStateCodeFromGSTIN(gstin: string): string {
  if (!gstin || gstin.length < 2) return '';
  return gstin.substring(0, 2);
}

/**
 * Get state name from state code
 */
export function getStateNameFromCode(stateCode: string): string {
  const stateMap: Record<string, string> = {
    '01': 'Jammu and Kashmir',
    '02': 'Himachal Pradesh',
    '03': 'Punjab',
    '04': 'Chandigarh',
    '05': 'Uttarakhand',
    '06': 'Haryana',
    '07': 'Delhi',
    '08': 'Rajasthan',
    '09': 'Uttar Pradesh',
    '10': 'Bihar',
    '11': 'Sikkim',
    '12': 'Arunachal Pradesh',
    '13': 'Nagaland',
    '14': 'Manipur',
    '15': 'Mizoram',
    '16': 'Tripura',
    '17': 'Meghalaya',
    '18': 'Assam',
    '19': 'West Bengal',
    '20': 'Jharkhand',
    '21': 'Odisha',
    '22': 'Chhattisgarh',
    '23': 'Madhya Pradesh',
    '24': 'Gujarat',
    '26': 'Dadra and Nagar Haveli and Daman and Diu',
    '27': 'Maharashtra',
    '29': 'Karnataka',
    '30': 'Goa',
    '31': 'Lakshadweep',
    '32': 'Kerala',
    '33': 'Tamil Nadu',
    '34': 'Puducherry',
    '35': 'Andaman and Nicobar Islands',
    '36': 'Telangana',
    '37': 'Andhra Pradesh',
  };

  return stateMap[stateCode] || 'Unknown';
}

/**
 * Format date to DD-MMM-YYYY format (e.g., 31-Dec-2024)
 */
export function formatInvoiceDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  const day = d.getDate().toString().padStart(2, '0');
  const month = d.toLocaleString('en-US', { month: 'short' });
  const year = d.getFullYear();

  return `${day}-${month}-${year}`;
}

/**
 * Format currency for display (e.g., 12345.67 -> "12,345.67")
 */
export function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Calculate GST breakdown based on transaction type
 */
export function calculateGSTBreakdown(
  subtotal: number,
  gstRate: number,
  isInterState: boolean
): {
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
} {
  const gstAmount = subtotal * (gstRate / 100);

  if (isInterState) {
    return {
      cgst: 0,
      sgst: 0,
      igst: gstAmount,
      total: subtotal + gstAmount,
    };
  } else {
    return {
      cgst: gstAmount / 2,
      sgst: gstAmount / 2,
      igst: 0,
      total: subtotal + gstAmount,
    };
  }
}

/**
 * Main function: Map quote data to invoice format
 */
export async function mapQuoteToInvoiceData(
  quote: Quote,
  version: QuoteVersion | null,
  items: QuoteItemVersion[],
  companyProfile: CompanyProfile,
  partyProfile: PartyProfile | null
): Promise<InvoiceData> {
  if (!version) {
    throw new Error('Quote version is required for invoice generation');
  }

  // Determine if inter-state transaction
  const sellerGSTIN = companyProfile.gstin || '';
  const buyerGSTIN = partyProfile?.gstin || '';
  const interState = buyerGSTIN ? isInterStateTransaction(sellerGSTIN, buyerGSTIN) : false;

  // Get state information
  const sellerStateCode = getStateCodeFromGSTIN(sellerGSTIN);
  const buyerStateCode = buyerGSTIN ? getStateCodeFromGSTIN(buyerGSTIN) : '';
  const sellerStateName = getStateNameFromCode(sellerStateCode);
  const buyerStateName = buyerGSTIN ? getStateNameFromCode(buyerStateCode) : '';

  // Calculate GST breakdown
  const gstBreakdown = calculateGSTBreakdown(
    version.subtotal,
    version.gstPercent,
    interState
  );

  // Map quote items to invoice line items
  const invoiceItems: InvoiceLineItem[] = items.map(item => {
    const itemGstRate = version.gstPercent;

    return {
      description: item.productName || 'Box Product',
      sac_code: '996313', // SAC code for packaging materials
      quantity: item.quantity || 1,
      rate: formatCurrency(item.unitPrice || 0),
      taxable_value: formatCurrency(item.total || 0),
      cgst_rate: interState ? 0 : itemGstRate / 2,
      sgst_rate: interState ? 0 : itemGstRate / 2,
      igst_rate: interState ? itemGstRate : 0,
      total: formatCurrency((item.total || 0) * (1 + itemGstRate / 100)),
    };
  });

  // Build invoice data
  const invoiceData: InvoiceData = {
    invoice: {
      number: quote.quoteNo, // You might want to generate a proper invoice number
      date: formatInvoiceDate(new Date()),
      financial_year: getCurrentFinancialYear(),
      generated_at: new Date().toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    },
    seller: {
      company_name: companyProfile.companyName || 'Company Name',
      gstin: sellerGSTIN,
      pan: sellerGSTIN.substring(2, 12), // PAN is characters 3-12 of GSTIN
      address: [
        companyProfile.address,
        companyProfile.city,
        sellerStateName,
        companyProfile.pincode,
      ].filter(Boolean).join(', '),
      phone: companyProfile.mobile || companyProfile.phone || '',
      email: companyProfile.email || '',
      website: companyProfile.website,
    },
    buyer: {
      company_name: partyProfile?.companyName || quote.partyName || quote.customerCompany || 'Customer',
      gstin: buyerGSTIN,
      address: partyProfile?.address || '',
      phone: partyProfile?.mobile || quote.customerMobile || '',
      email: partyProfile?.email || quote.customerEmail || '',
      place_of_supply: buyerStateName || sellerStateName, // Fallback to seller state if buyer state unknown
    },
    items: invoiceItems,
    totals: {
      subtotal: formatCurrency(version.subtotal),
      cgst: formatCurrency(gstBreakdown.cgst),
      sgst: formatCurrency(gstBreakdown.sgst),
      igst: formatCurrency(gstBreakdown.igst),
      grand_total: formatCurrency(gstBreakdown.total),
      amount_in_words: convertToWords(gstBreakdown.total),
    },
  };

  // Add payment terms if available
  if (version.paymentTerms) {
    invoiceData.payment = {
      method: version.paymentType === 'advance' ? 'Advance Payment' :
              version.paymentType === 'credit' ? `Credit (${version.creditDays} days)` :
              'On Delivery',
      reference: quote.quoteNo,
      date: formatInvoiceDate(new Date()),
    };
  }

  return invoiceData;
}

/**
 * Validate that all required data is present for invoice generation
 */
export function validateQuoteForInvoice(
  quote: Quote,
  version: QuoteVersion | null,
  items: QuoteItemVersion[],
  companyProfile: CompanyProfile,
  partyProfile: PartyProfile | null
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate company profile (seller)
  if (!companyProfile.companyName) errors.push('Seller company name is required');
  if (!companyProfile.gstin) errors.push('Seller GSTIN is required');
  if (!companyProfile.address) errors.push('Seller address is required');

  // Validate buyer
  if (!quote.partyName && !partyProfile?.companyName && !quote.customerCompany) {
    errors.push('Buyer company name is required');
  }

  // Validate quote version
  if (!version) {
    errors.push('Quote version is required');
  } else {
    if (items.length === 0) errors.push('At least one line item is required');
    if (!version.subtotal || version.subtotal <= 0) errors.push('Valid subtotal is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
