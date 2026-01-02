/**
 * GST Calculation Service
 *
 * Calculates GST (Goods and Services Tax) for Indian SaaS subscriptions
 *
 * Tax Rules:
 * - SaaS services = 18% GST (HSN/SAC: 998314)
 * - Intra-state (same state): CGST 9% + SGST 9% = 18%
 * - Inter-state (different states): IGST 18%
 *
 * Reference: CGST Act 2017, Schedule II
 */

export interface GSTBreakdown {
  subtotal: number;
  discountAmount: number;
  taxableValue: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  totalTax: number;
  grandTotal: number;
}

/**
 * Calculate GST based on seller and buyer states
 *
 * @param subtotal - Base subscription amount before discount
 * @param sellerStateCode - Seller's GST state code (from GSTIN positions 1-2)
 * @param buyerStateCode - Buyer's GST state code (from GSTIN positions 1-2, null if no GSTIN)
 * @param discountAmount - Discount amount (default 0)
 * @returns GST breakdown with all tax components
 *
 * @example
 * // Intra-state transaction (Maharashtra to Maharashtra)
 * calculateGST(999, '27', '27', 0)
 * // Returns: { cgstRate: 9, cgstAmount: 89.91, sgstRate: 9, sgstAmount: 89.91, igstRate: 0, igstAmount: 0, totalTax: 179.82, grandTotal: 1178.82 }
 *
 * @example
 * // Inter-state transaction (Maharashtra to Karnataka)
 * calculateGST(999, '27', '29', 0)
 * // Returns: { cgstRate: 0, cgstAmount: 0, sgstRate: 0, sgstAmount: 0, igstRate: 18, igstAmount: 179.82, totalTax: 179.82, grandTotal: 1178.82 }
 *
 * @example
 * // 100% discount (free subscription via coupon)
 * calculateGST(999, '27', '29', 999)
 * // Returns: { taxableValue: 0, totalTax: 0, grandTotal: 0 }
 */
export function calculateGST(
  subtotal: number,
  sellerStateCode: string,
  buyerStateCode: string | null,
  discountAmount: number = 0
): GSTBreakdown {
  const taxableValue = Math.max(0, subtotal - discountAmount);

  const breakdown: GSTBreakdown = {
    subtotal,
    discountAmount,
    taxableValue,
    cgstRate: 0,
    cgstAmount: 0,
    sgstRate: 0,
    sgstAmount: 0,
    igstRate: 0,
    igstAmount: 0,
    totalTax: 0,
    grandTotal: 0,
  };

  // If taxable value is 0 (100% coupon), GST is 0
  if (taxableValue === 0) {
    return breakdown;
  }

  const GST_RATE = 18; // SaaS services = 18% GST

  // Intra-state transaction (same state) → CGST + SGST
  if (buyerStateCode && sellerStateCode === buyerStateCode) {
    const halfGSTRate = GST_RATE / 2; // 9% each for CGST and SGST
    breakdown.cgstRate = halfGSTRate;
    breakdown.cgstAmount = (taxableValue * halfGSTRate) / 100;
    breakdown.sgstRate = halfGSTRate;
    breakdown.sgstAmount = (taxableValue * halfGSTRate) / 100;
    breakdown.totalTax = breakdown.cgstAmount + breakdown.sgstAmount;
  }
  // Inter-state transaction (different states) → IGST
  else {
    breakdown.igstRate = GST_RATE;
    breakdown.igstAmount = (taxableValue * GST_RATE) / 100;
    breakdown.totalTax = breakdown.igstAmount;
  }

  breakdown.grandTotal = taxableValue + breakdown.totalTax;

  // Round all amounts to 2 decimal places
  Object.keys(breakdown).forEach((key) => {
    const value = breakdown[key as keyof GSTBreakdown];
    if (typeof value === 'number') {
      breakdown[key as keyof GSTBreakdown] = Math.round(value * 100) / 100 as never;
    }
  });

  return breakdown;
}

/**
 * Determine tax type (CGST+SGST vs IGST) based on state codes
 *
 * @param sellerStateCode - Seller's GST state code
 * @param buyerStateCode - Buyer's GST state code (null if no GSTIN)
 * @returns 'intra-state' | 'inter-state'
 */
export function getTaxType(
  sellerStateCode: string,
  buyerStateCode: string | null
): 'intra-state' | 'inter-state' {
  return buyerStateCode && sellerStateCode === buyerStateCode
    ? 'intra-state'
    : 'inter-state';
}

/**
 * Calculate reverse GST (extract base amount from total including GST)
 *
 * @param totalAmount - Amount including GST
 * @param gstRate - GST rate percentage (default 18%)
 * @returns Base amount before GST
 *
 * @example
 * // Total amount ₹1178.82 with 18% GST → Base amount ₹999
 * calculateReverseGST(1178.82, 18) // Returns 999
 */
export function calculateReverseGST(
  totalAmount: number,
  gstRate: number = 18
): number {
  const baseAmount = (totalAmount * 100) / (100 + gstRate);
  return Math.round(baseAmount * 100) / 100;
}

/**
 * Validate GST state code
 *
 * @param stateCode - 2-digit GST state code
 * @returns True if valid state code
 */
export function isValidGSTStateCode(stateCode: string): boolean {
  const validStateCodes = [
    '01', '02', '03', '04', '05', '06', '07', '08', '09', '10',
    '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
    '21', '22', '23', '24', '26', '27', '29', '30', '31', '32',
    '33', '34', '35', '36', '37', '38', '97', '99',
  ];
  return validStateCodes.includes(stateCode);
}
