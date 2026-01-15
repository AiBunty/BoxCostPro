// Shared GST utilities for both client and server
// Aligns with server/utils/gstValidation.ts (checksum required)

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

function validateGSTINFormat(gstin: string): boolean {
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstinRegex.test(gstin);
}

function validateGSTINChecksum(gstin: string): boolean {
  const charset = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const chars = gstin.toUpperCase().split('');

  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const value = charset.indexOf(chars[i]);
    if (value === -1) return false;
    const weight = (i % 2 === 0) ? 1 : 2;
    let weightedValue = value * weight;
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

export function validateGSTIN(gstin: string | null | undefined): { valid: boolean; error?: string } {
  if (!gstin) {
    return { valid: false, error: 'GSTIN is required' };
  }
  const trimmed = gstin.trim().toUpperCase();
  if (trimmed.length !== 15) {
    return { valid: false, error: 'GSTIN must be exactly 15 characters' };
  }
  if (!validateGSTINFormat(trimmed)) {
    return {
      valid: false,
      error: 'Invalid GSTIN format. Expected: 2-digit state code + 10-char PAN + entity number + Z + check digit',
    };
  }
  const stateCode = trimmed.substring(0, 2);
  if (!GST_STATE_CODES[stateCode]) {
    return { valid: false, error: `Invalid state code: ${stateCode}` };
  }
  if (!validateGSTINChecksum(trimmed)) {
    return { valid: false, error: 'GSTIN checksum validation failed. Please verify the GSTIN.' };
  }
  return { valid: true };
}

export function extractPANFromGST(gstin: string): string {
  return gstin.substring(2, 12).toUpperCase();
}

export function getStateFromGST(gstin: string): { code: string; name: string } | null {
  const code = gstin.substring(0, 2);
  const name = GST_STATE_CODES[code];
  return name ? { code, name } : null;
}

export function getStateName(code: string | undefined): string | undefined {
  if (!code) return undefined;
  return GST_STATE_CODES[code];
}

export { GST_STATE_CODES };
