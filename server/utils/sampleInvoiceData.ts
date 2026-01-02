/**
 * Sample Invoice Data Generator
 * Generates realistic sample data for invoice template previews
 * GST-compliant format for Indian B2B SaaS invoicing
 */

export interface InvoiceData {
  invoice: {
    number: string;
    date: string;
    financial_year: string;
    generated_at: string;
  };
  seller: {
    company_name: string;
    gstin: string;
    pan: string;
    address: string;
    phone: string;
    email: string;
    website?: string;
  };
  buyer: {
    company_name: string;
    gstin: string;
    address: string;
    phone: string;
    email: string;
    place_of_supply: string;
  };
  items: InvoiceLineItem[];
  totals: {
    subtotal: string;
    cgst: string;
    sgst: string;
    igst: string;
    grand_total: string;
    amount_in_words: string;
  };
  payment?: {
    method: string;
    reference: string;
    date: string;
  };
}

export interface InvoiceLineItem {
  description: string;
  sac_code: string;
  quantity: number;
  rate: string;
  taxable_value: string;
  cgst_rate: number;
  sgst_rate: number;
  igst_rate: number;
  total: string;
}

/**
 * Generate sample invoice data for template preview
 */
export function generateSampleInvoiceData(interState: boolean = false): InvoiceData {
  const subtotal = 50000.00;
  const taxRate = 18; // GST rate for SaaS services

  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  if (interState) {
    // Inter-state: IGST only
    igst = subtotal * (taxRate / 100);
  } else {
    // Intra-state: CGST + SGST
    cgst = subtotal * (taxRate / 200); // 9%
    sgst = subtotal * (taxRate / 200); // 9%
  }

  const grandTotal = subtotal + cgst + sgst + igst;

  return {
    invoice: {
      number: "INV/2024-25/00123",
      date: "15-Jan-2025",
      financial_year: "2024-25",
      generated_at: new Date().toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
    },
    seller: {
      company_name: "BoxCost Technologies Private Limited",
      gstin: "27AABCU9603R1ZX",
      pan: "AABCU9603R",
      address: "123 Business Park, MG Road, Pune, Maharashtra - 411001",
      phone: "+91-20-12345678",
      email: "billing@boxcost.com",
      website: "https://www.boxcost.com",
    },
    buyer: {
      company_name: interState ? "TechCorp Solutions Pvt Ltd" : "Mumbai Enterprises Pvt Ltd",
      gstin: interState ? "09AACCC1234D1Z5" : "27AACCC5678E1Z9",
      address: interState
        ? "456 Tech Tower, Sector 62, Noida, Uttar Pradesh - 201301"
        : "789 Corporate Plaza, Andheri East, Mumbai, Maharashtra - 400059",
      phone: interState ? "+91-120-9876543" : "+91-22-98765432",
      email: interState ? "accounts@techcorp.com" : "billing@mumbaienterprises.com",
      place_of_supply: interState ? "09-Uttar Pradesh" : "27-Maharashtra",
    },
    items: [
      {
        description: "BoxCost Pro - Annual Subscription (Enterprise Plan)",
        sac_code: "998314",
        quantity: 1,
        rate: formatCurrency(40000),
        taxable_value: formatCurrency(40000),
        cgst_rate: interState ? 0 : 9,
        sgst_rate: interState ? 0 : 9,
        igst_rate: interState ? 18 : 0,
        total: formatCurrency(40000 * 1.18),
      },
      {
        description: "Implementation & Onboarding Services",
        sac_code: "998313",
        quantity: 1,
        rate: formatCurrency(10000),
        taxable_value: formatCurrency(10000),
        cgst_rate: interState ? 0 : 9,
        sgst_rate: interState ? 0 : 9,
        igst_rate: interState ? 18 : 0,
        total: formatCurrency(10000 * 1.18),
      },
    ],
    totals: {
      subtotal: formatCurrency(subtotal),
      cgst: formatCurrency(cgst),
      sgst: formatCurrency(sgst),
      igst: formatCurrency(igst),
      grand_total: formatCurrency(grandTotal),
      amount_in_words: convertToWords(grandTotal),
    },
    payment: {
      method: "Online Payment (Razorpay)",
      reference: "pay_NQR7xYz8K9mP3q",
      date: "15-Jan-2025",
    },
  };
}

/**
 * Format number as currency (without ₹ symbol)
 */
function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Convert number to words (Indian numbering system)
 * Example: 59000 -> "Fifty Nine Thousand Only"
 */
export function convertToWords(amount: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

  if (amount === 0) return 'Zero Rupees Only';

  const crore = Math.floor(amount / 10000000);
  amount %= 10000000;

  const lakh = Math.floor(amount / 100000);
  amount %= 100000;

  const thousand = Math.floor(amount / 1000);
  amount %= 1000;

  const hundred = Math.floor(amount / 100);
  amount %= 100;

  const ten = Math.floor(amount / 10);
  const one = Math.floor(amount % 10);

  let words = '';

  if (crore > 0) {
    words += convertToWords(crore) + ' Crore ';
  }

  if (lakh > 0) {
    words += convertToWords(lakh) + ' Lakh ';
  }

  if (thousand > 0) {
    words += convertToWords(thousand) + ' Thousand ';
  }

  if (hundred > 0) {
    words += ones[hundred] + ' Hundred ';
  }

  if (ten === 1) {
    words += teens[one] + ' ';
  } else {
    if (ten > 0) {
      words += tens[ten] + ' ';
    }
    if (one > 0) {
      words += ones[one] + ' ';
    }
  }

  return (words.trim() + ' Rupees Only').replace(/\s+/g, ' ');
}

/**
 * Generate financial year from date
 * Example: 2025-01-15 -> "2024-25"
 */
export function getFinancialYear(date: Date = new Date()): string {
  const month = date.getMonth(); // 0-11
  const year = date.getFullYear();

  if (month < 3) {
    // Jan-Mar: Previous FY
    return `${year - 1}-${String(year).slice(-2)}`;
  } else {
    // Apr-Dec: Current FY
    return `${year}-${String(year + 1).slice(-2)}`;
  }
}

/**
 * Validate GSTIN format
 * Format: 22AAAAA0000A1Z5 (15 characters)
 */
export function validateGSTIN(gstin: string): boolean {
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstinRegex.test(gstin);
}

/**
 * Validate PAN format
 * Format: AAAAA0000A (10 characters)
 */
export function validatePAN(pan: string): boolean {
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  return panRegex.test(pan);
}

/**
 * Validate SAC code for SaaS
 * Valid codes: 998313 (Software development), 998314 (Software hosting)
 */
export function validateSACCode(sac: string): boolean {
  const validSACs = ['998313', '998314'];
  return validSACs.includes(sac);
}

/**
 * Get state code from GSTIN
 * First 2 digits represent state code
 */
export function getStateCodeFromGSTIN(gstin: string): string {
  if (!validateGSTIN(gstin)) {
    throw new Error('Invalid GSTIN format');
  }
  return gstin.substring(0, 2);
}

/**
 * Check if transaction is inter-state
 */
export function isInterStateTransaction(sellerGSTIN: string, buyerGSTIN: string): boolean {
  const sellerState = getStateCodeFromGSTIN(sellerGSTIN);
  const buyerState = getStateCodeFromGSTIN(buyerGSTIN);
  return sellerState !== buyerState;
}

/**
 * Calculate GST breakdown
 */
export function calculateGST(
  taxableAmount: number,
  gstRate: number,
  isInterState: boolean
): { cgst: number; sgst: number; igst: number; total: number } {
  if (isInterState) {
    const igst = (taxableAmount * gstRate) / 100;
    return {
      cgst: 0,
      sgst: 0,
      igst: Number(igst.toFixed(2)),
      total: Number((taxableAmount + igst).toFixed(2)),
    };
  } else {
    const cgst = (taxableAmount * gstRate) / 200;
    const sgst = (taxableAmount * gstRate) / 200;
    return {
      cgst: Number(cgst.toFixed(2)),
      sgst: Number(sgst.toFixed(2)),
      igst: 0,
      total: Number((taxableAmount + cgst + sgst).toFixed(2)),
    };
  }
}
