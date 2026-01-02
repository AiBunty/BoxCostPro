/**
 * SMTP Service - Handles email configuration testing and validation
 *
 * CRITICAL: This service implements strict input sanitization and error handling
 * to prevent HTTP 500 errors from reaching production.
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface SMTPConfig {
  provider: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUsername: string;
  smtpPassword: string;
  emailAddress: string;
}

export interface SMTPTestResult {
  success: boolean;
  code?: string;
  message: string;
  details?: string;
}

/**
 * Sanitize and validate SMTP credentials
 * Returns sanitized config or throws validation error
 */
export function sanitizeAndValidateSMTPConfig(config: SMTPConfig): SMTPConfig {
  // Trim whitespace from all string fields
  const sanitized = {
    ...config,
    smtpUsername: config.smtpUsername?.trim() || '',
    smtpPassword: config.smtpPassword?.replace(/\s+/g, '') || '', // Remove ALL spaces (important for App Passwords)
    emailAddress: config.emailAddress?.trim() || '',
    smtpHost: config.smtpHost?.trim() || '',
  };

  // Validate required fields
  if (!sanitized.provider) {
    throw createSMTPError('MISSING_PROVIDER', 'Email provider is required', sanitized.provider);
  }

  if (!sanitized.emailAddress) {
    throw createSMTPError('MISSING_EMAIL', 'Email address is required', sanitized.provider);
  }

  if (!sanitized.smtpHost) {
    throw createSMTPError('MISSING_SMTP_HOST', 'SMTP host is required', sanitized.provider);
  }

  if (!sanitized.smtpUsername) {
    throw createSMTPError('MISSING_USERNAME', 'SMTP username is required', sanitized.provider);
  }

  if (!sanitized.smtpPassword) {
    throw createSMTPError('MISSING_PASSWORD', 'SMTP password is required', sanitized.provider);
  }

  // Gmail-specific validation
  if (sanitized.provider === 'gmail') {
    // App passwords are typically 16 characters (without spaces)
    if (sanitized.smtpPassword.length < 16) {
      throw createSMTPError(
        'GMAIL_INVALID_APP_PASSWORD',
        'Gmail App Password must be at least 16 characters. Normal Gmail passwords will not work with SMTP. Please generate an App Password from Google Account Security settings.',
        sanitized.provider
      );
    }

    // Enforce correct Gmail SMTP configuration
    sanitized.smtpHost = 'smtp.gmail.com';
    sanitized.smtpPort = 587;
    sanitized.smtpSecure = false; // CRITICAL: Use STARTTLS, not SSL
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(sanitized.emailAddress)) {
    throw createSMTPError('INVALID_EMAIL_FORMAT', 'Invalid email address format', sanitized.provider);
  }

  return sanitized;
}

/**
 * Test SMTP configuration by verifying connection and sending test email
 */
export async function testSMTPConfiguration(config: SMTPConfig): Promise<SMTPTestResult> {
  let transporter: Transporter | null = null;

  try {
    // Sanitize and validate input
    const sanitizedConfig = sanitizeAndValidateSMTPConfig(config);

    // Create SMTP transporter with strict configuration
    const transportConfig: any = {
      host: sanitizedConfig.smtpHost,
      port: sanitizedConfig.smtpPort,
      secure: sanitizedConfig.smtpSecure, // true for 465, false for 587
      auth: {
        user: sanitizedConfig.smtpUsername,
        pass: sanitizedConfig.smtpPassword,
      },
      tls: {
        rejectUnauthorized: false, // Allow self-signed certs in dev
      },
      logger: false, // Disable logging to prevent password leaks
      debug: false,
    };

    // Gmail-specific configuration
    if (sanitizedConfig.provider === 'gmail') {
      transportConfig.requireTLS = true; // Force TLS for Gmail
      transportConfig.tls = {
        ciphers: 'SSLv3',
        rejectUnauthorized: false,
      };
    }

    console.log(`[SMTP Test] Testing ${sanitizedConfig.provider} configuration for ${sanitizedConfig.emailAddress}`);

    transporter = nodemailer.createTransport(transportConfig);

    // Step 1: Verify connection and authentication
    try {
      await transporter.verify();
      console.log(`[SMTP Test] ✓ Connection verified for ${sanitizedConfig.provider}`);
    } catch (verifyError: any) {
      console.error(`[SMTP Test] ✗ Verification failed:`, verifyError.message);
      return mapSMTPErrorToResult(verifyError, sanitizedConfig.provider);
    }

    // Step 2: Send test email
    try {
      const testEmailResult = await transporter.sendMail({
        from: `"${sanitizedConfig.emailAddress}" <${sanitizedConfig.emailAddress}>`,
        to: sanitizedConfig.emailAddress, // Send to self
        subject: 'BoxCostPro Email Configuration Test',
        text: `Your email configuration for ${sanitizedConfig.provider} is working correctly!\n\nProvider: ${sanitizedConfig.provider}\nEmail: ${sanitizedConfig.emailAddress}\nSMTP Host: ${sanitizedConfig.smtpHost}\nPort: ${sanitizedConfig.smtpPort}\n\nYou can now send quotes from BoxCostPro using this email address.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #22c55e;">✓ Email Configuration Successful</h2>
            <p>Your email configuration for <strong>${sanitizedConfig.provider}</strong> is working correctly!</p>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr style="background: #f3f4f6;">
                <td style="padding: 10px; border: 1px solid #e5e7eb;"><strong>Provider</strong></td>
                <td style="padding: 10px; border: 1px solid #e5e7eb;">${sanitizedConfig.provider}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #e5e7eb;"><strong>Email</strong></td>
                <td style="padding: 10px; border: 1px solid #e5e7eb;">${sanitizedConfig.emailAddress}</td>
              </tr>
              <tr style="background: #f3f4f6;">
                <td style="padding: 10px; border: 1px solid #e5e7eb;"><strong>SMTP Host</strong></td>
                <td style="padding: 10px; border: 1px solid #e5e7eb;">${sanitizedConfig.smtpHost}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #e5e7eb;"><strong>Port</strong></td>
                <td style="padding: 10px; border: 1px solid #e5e7eb;">${sanitizedConfig.smtpPort}</td>
              </tr>
            </table>
            <p style="color: #22c55e;">You can now send quotes from BoxCostPro using this email address.</p>
          </div>
        `,
      });

      console.log(`[SMTP Test] ✓ Test email sent successfully. Message ID: ${testEmailResult.messageId}`);

      return {
        success: true,
        message: 'Email configuration verified successfully! A test email has been sent to your inbox.',
      };
    } catch (sendError: any) {
      console.error(`[SMTP Test] ✗ Send failed:`, sendError.message);
      return mapSMTPErrorToResult(sendError, sanitizedConfig.provider);
    }
  } catch (error: any) {
    // Handle validation errors
    if (error.isSmtpError) {
      return {
        success: false,
        code: error.code,
        message: error.message,
      };
    }

    // Handle unexpected errors
    console.error('[SMTP Test] ✗ Unexpected error:', error);
    return {
      success: false,
      code: 'SMTP_UNKNOWN_ERROR',
      message: `Failed to test email configuration: ${error.message || 'Unknown error'}`,
      details: error.stack,
    };
  } finally {
    // Clean up transporter
    if (transporter) {
      transporter.close();
    }
  }
}

/**
 * Map SMTP errors to user-friendly error messages
 */
function mapSMTPErrorToResult(error: any, provider: string): SMTPTestResult {
  const errorMessage = error.message || '';
  const errorCode = error.code || '';
  const errorResponse = error.response || '';

  console.log(`[SMTP Error Mapper] Provider: ${provider}, Code: ${errorCode}, Message: ${errorMessage}`);

  // ========== GMAIL-SPECIFIC ERRORS ==========
  if (provider === 'gmail') {
    // Invalid credentials / App Password
    if (
      errorMessage.includes('535') ||
      errorMessage.includes('Username and Password not accepted') ||
      errorMessage.includes('Invalid credentials') ||
      errorResponse.includes('535-5.7.8')
    ) {
      return {
        success: false,
        code: 'GMAIL_AUTH_FAILED',
        message: 'Google rejected your login credentials. You must use an App Password, NOT your regular Gmail password. Go to Google Account → Security → 2-Step Verification → App Passwords to generate one.',
      };
    }

    // Less secure apps
    if (errorMessage.includes('Less secure') || errorMessage.includes('less secure app')) {
      return {
        success: false,
        code: 'GMAIL_LESS_SECURE_APP',
        message: 'Gmail requires an App Password for SMTP access. Enable 2-Step Verification in your Google Account, then generate an App Password under Security settings.',
      };
    }

    // Account disabled or locked
    if (errorMessage.includes('account has been disabled') || errorMessage.includes('locked')) {
      return {
        success: false,
        code: 'GMAIL_ACCOUNT_LOCKED',
        message: 'Your Google account is locked or disabled. Check your Gmail account status and security alerts at myaccount.google.com.',
      };
    }

    // CAPTCHA required
    if (errorMessage.includes('CAPTCHA') || errorMessage.includes('captcha')) {
      return {
        success: false,
        code: 'GMAIL_CAPTCHA_REQUIRED',
        message: 'Google requires CAPTCHA verification. Visit https://accounts.google.com/DisplayUnlockCaptcha and try again.',
      };
    }
  }

  // ========== GENERIC SMTP ERRORS ==========

  // Connection timeout
  if (errorCode === 'ETIMEDOUT' || errorCode === 'ECONNREFUSED') {
    return {
      success: false,
      code: 'SMTP_CONNECTION_TIMEOUT',
      message: `Unable to connect to ${provider} SMTP server at ${error.address || 'unknown host'}. Check your firewall settings, network connection, or verify the SMTP host and port are correct.`,
    };
  }

  // DNS/Host not found
  if (errorCode === 'ENOTFOUND') {
    return {
      success: false,
      code: 'SMTP_HOST_NOT_FOUND',
      message: `Cannot find SMTP server "${error.hostname}". Verify the SMTP host is correct for ${provider}.`,
    };
  }

  // TLS/SSL errors
  if (
    errorMessage.includes('CERT') ||
    errorMessage.includes('certificate') ||
    errorMessage.includes('TLS') ||
    errorMessage.includes('SSL')
  ) {
    return {
      success: false,
      code: 'SMTP_TLS_ERROR',
      message: 'SSL/TLS certificate error. For Gmail, make sure you are using port 587 with STARTTLS (not port 465 with SSL). Check your SMTP server security settings.',
    };
  }

  // Invalid recipient
  if (errorMessage.includes('recipient') || errorCode === '550') {
    return {
      success: false,
      code: 'SMTP_INVALID_RECIPIENT',
      message: 'Test email recipient address is invalid or rejected by the server. Verify the email address is correct.',
    };
  }

  // Generic authentication failure
  if (
    errorMessage.includes('auth') ||
    errorMessage.includes('authentication') ||
    errorMessage.includes('login') ||
    errorCode === '535'
  ) {
    return {
      success: false,
      code: 'SMTP_AUTH_FAILED',
      message: `SMTP authentication failed for ${provider}. Verify your username and password are correct. For Gmail, you must use an App Password (not your regular password).`,
    };
  }

  // Connection error
  if (errorCode === 'ECONNECTION' || errorMessage.includes('connect')) {
    return {
      success: false,
      code: 'SMTP_CONNECTION_ERROR',
      message: `Failed to connect to ${provider} SMTP server. Verify your network connection and that the SMTP host and port are correct.`,
    };
  }

  // Network error
  if (errorCode === 'ENETWORK' || errorMessage.includes('network')) {
    return {
      success: false,
      code: 'SMTP_NETWORK_ERROR',
      message: 'Network error while connecting to SMTP server. Check your internet connection.',
    };
  }

  // Fallback for unknown errors
  return {
    success: false,
    code: 'SMTP_UNKNOWN_ERROR',
    message: `SMTP error: ${errorMessage}. Please verify your SMTP configuration for ${provider}.`,
    details: `Error code: ${errorCode}, Response: ${errorResponse}`,
  };
}

/**
 * Create a structured SMTP error
 */
function createSMTPError(code: string, message: string, provider: string): any {
  const error = new Error(message);
  (error as any).isSmtpError = true;
  (error as any).code = code;
  (error as any).provider = provider;
  return error;
}
