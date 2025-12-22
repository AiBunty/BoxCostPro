/**
 * Validation Middleware for Quote Sending
 * Ensures all required data is present before sending via WhatsApp/Email
 */

import { Request, Response, NextFunction } from 'express';

export interface BusinessProfile {
  businessName?: string;
  companyName?: string;
  ownerName?: string;
  businessPhone?: string;
  phone?: string;
  businessEmail?: string;
  email?: string;
  gstNo?: string;
  website?: string;
  mapLink?: string;
  address?: string;
  logoUrl?: string;
}

export interface ShowColumnsConfig {
  boxSize?: boolean;
  board?: boolean;
  flute?: boolean;
  paper?: boolean;
  printing?: boolean;
  lamination?: boolean;
  varnish?: boolean;
  weight?: boolean;
}

export interface QuoteItem {
  id?: string;
  itemName?: string;
  boxName?: string;
  qty?: number;
  [key: string]: any;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validate business profile has all mandatory fields
 */
export function validateBusinessProfile(profile: BusinessProfile | null): ValidationResult {
  const errors: string[] = [];

  if (!profile) {
    return { isValid: false, errors: ['Business Profile not found'] };
  }

  const businessName = profile.businessName || profile.companyName;
  if (!businessName) {
    errors.push('Business Name is required');
  }

  if (!profile.ownerName) {
    errors.push('Owner Name is required');
  }

  const phone = profile.businessPhone || profile.phone;
  if (!phone) {
    errors.push('Business Phone is required');
  }

  const email = profile.businessEmail || profile.email;
  if (!email) {
    errors.push('Business Email is required');
  }

  if (!profile.gstNo) {
    errors.push('GST No is required');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate quote has items
 */
export function validateQuoteItems(items: QuoteItem[] | null | undefined): ValidationResult {
  if (!items || items.length === 0) {
    return { isValid: false, errors: ['No items in quote'] };
  }

  return { isValid: true, errors: [] };
}

/**
 * Validate Show Columns configuration exists
 */
export function validateShowColumns(showColumns: ShowColumnsConfig | null | undefined): ValidationResult {
  if (!showColumns) {
    return { isValid: false, errors: ['Show Columns configuration missing'] };
  }

  return { isValid: true, errors: [] };
}

/**
 * Combined validation for send operations
 */
export function validateBeforeSendData(
  businessProfile: BusinessProfile | null,
  items: QuoteItem[] | null | undefined,
  showColumns: ShowColumnsConfig | null | undefined
): ValidationResult {
  const allErrors: string[] = [];

  const profileValidation = validateBusinessProfile(businessProfile);
  if (!profileValidation.isValid) {
    allErrors.push(...profileValidation.errors);
  }

  const itemsValidation = validateQuoteItems(items);
  if (!itemsValidation.isValid) {
    allErrors.push(...itemsValidation.errors);
  }

  const columnsValidation = validateShowColumns(showColumns);
  if (!columnsValidation.isValid) {
    allErrors.push(...columnsValidation.errors);
  }

  return {
    isValid: allErrors.length === 0,
    errors: allErrors
  };
}

/**
 * Express middleware for validating send requests
 * Attach to Send WhatsApp API and Send Email API
 */
export function validateBeforeSend(req: Request, res: Response, next: NextFunction) {
  const { businessProfile, items, showColumns } = req.body;

  if (!businessProfile?.businessName && !businessProfile?.companyName) {
    return res.status(400).json({ error: 'Business Name missing' });
  }

  if (!businessProfile?.ownerName) {
    return res.status(400).json({ error: 'Owner Name missing' });
  }

  if (!businessProfile?.businessPhone && !businessProfile?.phone) {
    return res.status(400).json({ error: 'Business Phone missing' });
  }

  if (!businessProfile?.businessEmail && !businessProfile?.email) {
    return res.status(400).json({ error: 'Business Email missing' });
  }

  if (!businessProfile?.gstNo) {
    return res.status(400).json({ error: 'GST No missing' });
  }

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'No items in quote' });
  }

  if (!showColumns) {
    return res.status(400).json({ error: 'Show Columns configuration missing' });
  }

  next();
}

/**
 * Get list of missing mandatory fields for frontend display
 */
export function getMissingMandatoryFields(profile: BusinessProfile | null): string[] {
  const missing: string[] = [];

  if (!profile) {
    return ['Business Profile'];
  }

  const businessName = profile.businessName || profile.companyName;
  if (!businessName) missing.push('Business Name');
  if (!profile.ownerName) missing.push('Owner Name');
  
  const phone = profile.businessPhone || profile.phone;
  if (!phone) missing.push('Business Phone');
  
  const email = profile.businessEmail || profile.email;
  if (!email) missing.push('Business Email');
  
  if (!profile.gstNo) missing.push('GST No');

  return missing;
}
