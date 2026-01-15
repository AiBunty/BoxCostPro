/**
 * GST Validation Utilities for Indian GSTIN
 *
 * GSTIN Format: 15 characters
 * - Positions 1-2: State Code (01-37)
 * - Positions 3-12: PAN (10 chars)
 * - Position 13: Entity Number (1-9, A-Z)
 * - Position 14: 'Z' (default)
 * - Position 15: Check Digit (Mod-36 checksum)
 *
 * Why Validation Matters:
 * - Invalid GSTIN causes invoice rejection by GSTN
 * - Wrong state code leads to incorrect tax classification (IGST vs CGST+SGST)
 * - PAN mismatch blocks ITC (Input Tax Credit) claims
 */

// GST State Code to State Name Mapping (Official GSTN List)
const GST_STATE_CODES: Record<string, string> = {
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
  '38': 'Ladakh',
  '97': 'Other Territory',
  '99': 'Centre Jurisdiction',
};

/**
 * Validate GSTIN format using regex
 * Regex: ^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$
 */
function validateGSTINFormat(gstin: string): boolean {
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstinRegex.test(gstin);
}

/**
 * Validate GSTIN checksum using MOD-36 algorithm
 *
 * Algorithm:
 * 1. Character set: 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ (base-36)
 * 2. For each char in positions 1-14, multiply by alternating weight (2,1,2,1,...)
 * 3. If weight=2 and value≥18, split into quotient+remainder
 * 4. Sum all values, apply mod 36
 * 5. Check digit = (36 - sum) % 36
 *
 * Why This Matters:
 * - Catches 99% of typos and manual entry errors
 * - Prevents fake GSTIN submission
 * - Required by GSTN for IRP (Invoice Registration Portal)
 */
function validateGSTINChecksum(gstin: string): boolean {
  const charset = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const chars = gstin.toUpperCase().split('');

  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const char = chars[i];
    const value = charset.indexOf(char);

    if (value === -1) return false; // Invalid character

    // GSTIN checksum uses alternating weights starting with 1 for the first character
    const weight = (i % 2 === 0) ? 1 : 2;
    let weightedValue = value * weight;

    // If weight=2 and value≥36, split quotient+remainder as per MOD-36 spec
    if (weight === 2 && weightedValue >= 36) {
      const quotient = Math.floor(weightedValue / 36);
      const remainder = weightedValue % 36;
      weightedValue = quotient + remainder;
    }

    sum += weightedValue;
  }

  const calculatedCheckDigit = (36 - (sum % 36)) % 36;
  const actualCheckDigit = charset.indexOf(chars[14]);

  return calculatedCheckDigit === actualCheckDigit;
}

/**
 * Master GSTIN Validation (Regex + Checksum)
 * Returns: { valid: boolean, error?: string }
 */
export function validateGSTIN(gstin: string | null | undefined): { valid: boolean; error?: string } {
  if (!gstin) {
    return { valid: false, error: 'GSTIN is required' };
  }

  const trimmedGSTIN = gstin.trim().toUpperCase();

  // Length check
  if (trimmedGSTIN.length !== 15) {
    return { valid: false, error: 'GSTIN must be exactly 15 characters' };
  }

  // Format check (regex)
  if (!validateGSTINFormat(trimmedGSTIN)) {
    return {
      valid: false,
      error: 'Invalid GSTIN format. Expected: 2-digit state code + 10-char PAN + entity number + Z + check digit'
    };
  }

  // State code check
  const stateCode = trimmedGSTIN.substring(0, 2);
  if (!GST_STATE_CODES[stateCode]) {
    return { valid: false, error: `Invalid state code: ${stateCode}` };
  }

  // Checksum validation
  if (!validateGSTINChecksum(trimmedGSTIN)) {
    return {
      valid: false,
      error: 'GSTIN checksum validation failed. Please verify the GSTIN.',
    };
  }

  return { valid: true };
}

/**
 * Extract PAN from GSTIN (positions 3-12)
 *
 * Why Auto-Derive:
 * - PAN is embedded in GSTIN by design (GSTN rule)
 * - Manual entry creates mismatch risk (invoice rejection)
 * - Read-only field prevents user error
 */
export function extractPANFromGST(gstin: string): string {
  return gstin.substring(2, 12).toUpperCase();
}

/**
 * Extract State from GSTIN (positions 1-2)
 * Returns: { code: string, name: string }
 *
 * Why Auto-Derive:
 * - State determines tax type: Intra-state (CGST+SGST) vs Inter-state (IGST)
 * - Wrong state = wrong tax calculation = invoice rejection
 */
export function getStateFromGST(gstin: string): { code: string; name: string } | null {
  const stateCode = gstin.substring(0, 2);
  const stateName = GST_STATE_CODES[stateCode];

  if (!stateName) return null;

  return { code: stateCode, name: stateName };
}

/**
 * Validate PAN format (optional - for manual entry if GSTIN not provided)
 * Format: 5 letters + 4 digits + 1 letter
 * Example: AAACV3467G
 */
export function validatePAN(pan: string): { valid: boolean; error?: string } {
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

  if (!pan) {
    return { valid: false, error: 'PAN is required' };
  }

  const trimmedPAN = pan.trim().toUpperCase();

  if (trimmedPAN.length !== 10) {
    return { valid: false, error: 'PAN must be exactly 10 characters' };
  }

  if (!panRegex.test(trimmedPAN)) {
    return { valid: false, error: 'Invalid PAN format. Expected: 5 letters + 4 digits + 1 letter' };
  }

  return { valid: true };
}

/**
 * Check if business profile fields should be locked
 *
 * Why Lock Fields:
 * - Indian tax law prohibits retroactive changes to invoice issuer details
 * - Changing GSTIN after invoicing = tax fraud (Section 122 of CGST Act)
 * - Auditors flag mismatched GSTIN/address between invoices and returns
 *
 * Locked Fields:
 * - GSTIN (impacts all tax calculations)
 * - PAN (derived from GSTIN, must match)
 * - State (determines tax jurisdiction)
 * - Company Legal Name (invoice issuer identity)
 * - Registered Address (GSTIN registration address)
 */
export function shouldLockLegalFields(hasFinancialDocs: boolean): boolean {
  return hasFinancialDocs === true;
}

/**
 * Get list of locked field names
 */
export const LOCKED_LEGAL_FIELDS = [
  'gstNo',
  'panNo',
  'stateCode',
  'stateName',
  'companyName',
  'address',
] as const;

export type LockedLegalField = typeof LOCKED_LEGAL_FIELDS[number];
