/**
 * SMTP Provider Validation Utility
 * 
 * Centralized provider-specific SMTP configuration validation
 * for all supported email providers.
 * 
 * CRITICAL: Backend validation - NEVER rely on frontend presets
 */

export type SupportedProvider = 'gmail' | 'zoho' | 'outlook' | 'yahoo' | 'ses' | 'custom';

export interface ProviderPreset {
  host: string;
  port: number;
  secure: boolean; // true = SSL (port 465), false = STARTTLS (port 587)
  requireTLS: boolean;
  encryption: 'TLS' | 'SSL' | 'NONE';
  requiresAppPassword: boolean;
  setupInstructions: string;
  allowCustomHost?: boolean; // For SES and custom
}

/**
 * SMTP Provider Presets (Backend Source of Truth)
 * 
 * All providers use port 587 with STARTTLS (secure=false, requireTLS=true)
 * except SSL configurations which use port 465 (secure=true)
 */
export const PROVIDER_PRESETS: Record<SupportedProvider, ProviderPreset> = {
  gmail: {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    requireTLS: true,
    encryption: 'TLS',
    requiresAppPassword: true,
    setupInstructions: 'Use App Password from Google Account settings (Security > 2-Step Verification > App passwords)',
  },
  zoho: {
    host: 'smtp.zoho.com',
    port: 587,
    secure: false,
    requireTLS: true,
    encryption: 'TLS',
    requiresAppPassword: false,
    setupInstructions: 'Use your regular Zoho Mail password or generate app-specific password',
  },
  outlook: {
    host: 'smtp.office365.com',
    port: 587,
    secure: false,
    requireTLS: true,
    encryption: 'TLS',
    requiresAppPassword: false,
    setupInstructions: 'Use your Microsoft 365 account password. Enable SMTP AUTH if needed.',
  },
  yahoo: {
    host: 'smtp.mail.yahoo.com',
    port: 587,
    secure: false,
    requireTLS: true,
    encryption: 'TLS',
    requiresAppPassword: true,
    setupInstructions: 'Generate App Password from Yahoo Account Security settings',
  },
  ses: {
    host: 'email-smtp.us-east-1.amazonaws.com', // Default region
    port: 587,
    secure: false,
    requireTLS: true,
    encryption: 'TLS',
    requiresAppPassword: false,
    setupInstructions: 'Use SMTP credentials from AWS SES Console. Host format: email-smtp.<region>.amazonaws.com',
    allowCustomHost: true, // Allow different regions
  },
  custom: {
    host: '', // User-provided
    port: 587, // Default suggestion
    secure: false,
    requireTLS: true,
    encryption: 'TLS',
    requiresAppPassword: false,
    setupInstructions: 'Enter your custom SMTP server details. Contact your email provider for correct settings.',
    allowCustomHost: true,
  },
};

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate provider-specific SMTP configuration
 * 
 * Ensures admin-provided settings match provider requirements
 */
export function validateProviderConfig(
  provider: string,
  smtpHost: string,
  smtpPort: number,
  encryption: string
): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  // Check if provider is supported
  if (!PROVIDER_PRESETS[provider as SupportedProvider]) {
    result.valid = false;
    result.errors.push(`Unsupported provider: ${provider}. Supported: gmail, zoho, outlook, yahoo, ses, custom`);
    return result;
  }

  const preset = PROVIDER_PRESETS[provider as SupportedProvider];

  // Validate for non-custom providers (strict validation)
  if (provider !== 'custom' && provider !== 'ses') {
    // Host must match exactly
    if (smtpHost !== preset.host) {
      result.valid = false;
      result.errors.push(`SMTP host must be ${preset.host} for ${provider} (provided: ${smtpHost})`);
    }

    // Port must match exactly
    if (smtpPort !== preset.port) {
      result.valid = false;
      result.errors.push(`Port must be ${preset.port} for ${provider} (provided: ${smtpPort}). Use port 587 with TLS.`);
    }

    // Encryption must match
    if (encryption !== preset.encryption) {
      result.valid = false;
      result.errors.push(`Encryption must be ${preset.encryption} for ${provider} (provided: ${encryption})`);
    }
  }

  // Validate SES (allow different regions)
  if (provider === 'ses') {
    // Host must match pattern: email-smtp.<region>.amazonaws.com
    const sesHostPattern = /^email-smtp\.[a-z0-9-]+\.amazonaws\.com$/;
    if (!sesHostPattern.test(smtpHost)) {
      result.valid = false;
      result.errors.push(`Invalid SES SMTP host format. Expected: email-smtp.<region>.amazonaws.com (provided: ${smtpHost})`);
    }

    // Port should be 587
    if (smtpPort !== 587) {
      result.warnings.push(`SES typically uses port 587. Provided port ${smtpPort} may not work.`);
    }

    // Encryption should be TLS
    if (encryption !== 'TLS') {
      result.valid = false;
      result.errors.push(`SES requires TLS encryption (provided: ${encryption})`);
    }
  }

  // Validate custom SMTP (basic validation)
  if (provider === 'custom') {
    // Host must not be empty
    if (!smtpHost || smtpHost.trim() === '') {
      result.valid = false;
      result.errors.push('SMTP host is required for custom provider');
    }

    // Port must be valid
    if (!smtpPort || smtpPort < 1 || smtpPort > 65535) {
      result.valid = false;
      result.errors.push('Invalid port number. Must be between 1 and 65535');
    }

    // Warn about common misconfigurations
    if (smtpPort === 465 && encryption !== 'SSL') {
      result.warnings.push('Port 465 typically requires SSL encryption, not TLS');
    }

    if (smtpPort === 587 && encryption === 'SSL') {
      result.warnings.push('Port 587 typically uses TLS/STARTTLS, not SSL');
    }

    if (smtpPort === 25) {
      result.warnings.push('Port 25 is often blocked by ISPs and cloud providers. Use 587 or 465 instead.');
    }
  }

  return result;
}

/**
 * Get provider preset by name
 */
export function getProviderPreset(provider: string): ProviderPreset | null {
  return PROVIDER_PRESETS[provider as SupportedProvider] || null;
}

/**
 * Check if provider is supported
 */
export function isProviderSupported(provider: string): boolean {
  return !!PROVIDER_PRESETS[provider as SupportedProvider];
}

/**
 * Get list of all supported providers
 */
export function getSupportedProviders(): SupportedProvider[] {
  return Object.keys(PROVIDER_PRESETS) as SupportedProvider[];
}

/**
 * Validate that SMTP settings can create a nodemailer transporter
 * WITHOUT sending email (connection test only)
 */
export function canCreateTransporter(
  host: string,
  port: number,
  encryption: string,
  username: string,
  password: string
): { valid: boolean; error?: string } {
  try {
    // Basic validation
    if (!host || !port || !username || !password) {
      return { valid: false, error: 'Missing required SMTP credentials' };
    }

    if (password.length === 0) {
      return { valid: false, error: 'SMTP password cannot be empty' };
    }

    // Validate encryption type
    if (!['TLS', 'SSL', 'NONE'].includes(encryption)) {
      return { valid: false, error: 'Invalid encryption type. Must be TLS, SSL, or NONE' };
    }

    return { valid: true };
  } catch (error: any) {
    return { valid: false, error: error.message };
  }
}
