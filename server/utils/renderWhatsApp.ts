/**
 * WhatsApp Template Renderer
 * Handles placeholder replacement for WhatsApp messages
 */

export interface TemplateData {
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
  ItemsList?: string;
  TotalAmount?: string;
  [key: string]: string | undefined;
}

/**
 * Render WhatsApp template with placeholder replacement
 * Replaces all {{placeholder}} with actual values
 */
export function renderWhatsApp(template: string, data: TemplateData): string {
  let output = template;
  
  Object.keys(data).forEach(key => {
    const value = data[key];
    if (typeof value === 'string' || typeof value === 'number') {
      output = output.replaceAll(`{{${key}}}`, String(value ?? ''));
    }
  });
  
  // Clean up any remaining unreplaced placeholders
  output = output.replace(/\{\{[^}]+\}\}/g, '');
  
  return output.trim();
}

/**
 * Generate WhatsApp URL for sending message
 */
export function generateWhatsAppUrl(phoneNumber: string, message: string): string {
  // Clean phone number - remove spaces, dashes, and ensure proper format
  let cleanPhone = phoneNumber.replace(/[\s\-\(\)]/g, '');
  
  // Add country code if not present (assuming India +91)
  if (!cleanPhone.startsWith('+')) {
    if (cleanPhone.startsWith('91') && cleanPhone.length === 12) {
      cleanPhone = '+' + cleanPhone;
    } else if (cleanPhone.length === 10) {
      cleanPhone = '+91' + cleanPhone;
    }
  }
  
  // Remove the + for wa.me URL
  cleanPhone = cleanPhone.replace('+', '');
  
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
}
