/**
 * Admin Email Service
 * Handles system-wide email configuration and sending
 * with SMTP provider presets
 */

import nodemailer from 'nodemailer';
import { encrypt, decrypt } from '../utils/encryption';
import type { Storage } from '../storage';

// SMTP Provider Presets
export const SMTP_PRESETS = {
  gmail: {
    host: 'smtp.gmail.com',
    port: 587,
    encryption: 'TLS' as const,
    requiresAppPassword: true,
    setupInstructions: 'Use App Password from Google Account settings',
  },
  zoho: {
    host: 'smtp.zoho.com',
    port: 587,
    encryption: 'TLS' as const,
    requiresAppPassword: false,
    setupInstructions: 'Use your regular Zoho Mail password',
  },
  outlook: {
    host: 'smtp.office365.com',
    port: 587,
    encryption: 'TLS' as const,
    requiresAppPassword: false,
    setupInstructions: 'Use your Microsoft 365 password',
  },
  yahoo: {
    host: 'smtp.mail.yahoo.com',
    port: 587,
    encryption: 'TLS' as const,
    requiresAppPassword: true,
    setupInstructions: 'Generate App Password from Yahoo Account Security',
  },
  ses: {
    host: 'email-smtp.us-east-1.amazonaws.com', // Default region
    port: 587,
    encryption: 'TLS' as const,
    requiresAppPassword: false,
    setupInstructions: 'Use SMTP credentials from AWS SES Console',
  },
  custom: {
    host: '',
    port: 587,
    encryption: 'TLS' as const,
    requiresAppPassword: false,
    setupInstructions: 'Enter your custom SMTP server details',
  },
} as const;

/**
 * Encrypt password for storage (using centralized encryption)
 */
export function encryptPassword(password: string): string {
  return encrypt(password);
}

/**
 * Decrypt password for use (using centralized encryption)
 */
export function decryptPassword(encryptedPassword: string): string {
  return decrypt(encryptedPassword);
}

/**
 * Map SMTP errors to user-friendly messages
 */
function handleSMTPError(error: any, provider: string): { success: false; error: string; code: string } {
  const errorMessage = error.message || '';
  const errorCode = error.code || '';

  // Gmail/Google Workspace specific errors
  if (provider === 'gmail') {
    // Authentication failed
    if (errorMessage.includes('535') || errorMessage.includes('Username and Password not accepted')) {
      return {
        success: false,
        code: 'GMAIL_AUTH_FAILED',
        error: 'Google rejected login. Use an App Password, not your Gmail password. Enable 2-Step Verification in your Google Account, then generate an App Password under Security settings.',
      };
    }

    // Less secure apps
    if (errorMessage.includes('Less secure') || errorMessage.includes('less secure app')) {
      return {
        success: false,
        code: 'GMAIL_LESS_SECURE_APP',
        error: 'Gmail requires an App Password. Enable 2-Step Verification and generate an App Password from your Google Account Security settings.',
      };
    }

    // Account disabled or locked
    if (errorMessage.includes('account has been disabled') || errorMessage.includes('locked')) {
      return {
        success: false,
        code: 'GMAIL_ACCOUNT_LOCKED',
        error: 'Your Google account is locked or disabled. Check your Gmail account status and security alerts.',
      };
    }
  }

  // Connection timeout (all providers)
  if (errorCode === 'ETIMEDOUT' || errorCode === 'ECONNREFUSED') {
    return {
      success: false,
      code: 'SMTP_CONNECTION_TIMEOUT',
      error: `Unable to connect to ${provider} SMTP server. Check your firewall, network connection, or verify the SMTP host and port are correct.`,
    };
  }

  // TLS/SSL errors
  if (errorMessage.includes('CERT') || errorMessage.includes('certificate')) {
    return {
      success: false,
      code: 'SMTP_TLS_ERROR',
      error: 'SSL/TLS certificate error. Try using TLS encryption instead of SSL, or verify your SMTP server supports secure connections.',
    };
  }

  // Invalid recipient
  if (errorMessage.includes('recipient') || errorCode === '550') {
    return {
      success: false,
      code: 'SMTP_INVALID_RECIPIENT',
      error: 'Test email recipient address is invalid. Verify the email address is correct.',
    };
  }

  // Generic auth failure
  if (errorMessage.includes('auth') || errorMessage.includes('authentication')) {
    return {
      success: false,
      code: 'SMTP_AUTH_FAILED',
      error: `SMTP authentication failed. Verify your username and password are correct. Provider: ${provider}`,
    };
  }

  // Generic connection error
  if (errorCode === 'ECONNECTION' || errorMessage.includes('connect')) {
    return {
      success: false,
      code: 'SMTP_CONNECTION_ERROR',
      error: `Failed to connect to SMTP server. Verify host (${errorMessage.includes('ENOTFOUND') ? 'hostname may be incorrect' : 'network issue'}).`,
    };
  }

  // Fallback
  return {
    success: false,
    code: 'SMTP_UNKNOWN_ERROR',
    error: `SMTP error: ${errorMessage}. Please verify your SMTP configuration.`,
  };
}

/**
 * Test email configuration with detailed error handling
 */
export async function testEmailConfiguration(config: {
  provider: string;
  smtpHost: string;
  smtpPort: number;
  encryption: string;
  smtpUsername: string;
  smtpPassword: string;
  fromEmail: string;
  fromName: string;
  testRecipient: string;
}): Promise<{ success: boolean; error?: string; code?: string }> {
  try {
    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.encryption === 'SSL', // true for SSL, false for TLS
      auth: {
        user: config.smtpUsername,
        pass: config.smtpPassword,
      },
      tls: {
        rejectUnauthorized: config.encryption === 'TLS',
      },
    });

    // Verify connection
    try {
      await transporter.verify();
    } catch (verifyError: any) {
      console.error('[SMTP Test] Verify failed:', verifyError);
      return handleSMTPError(verifyError, config.provider);
    }

    // Send test email
    try {
      await transporter.sendMail({
        from: `"${config.fromName}" <${config.fromEmail}>`,
        to: config.testRecipient,
        subject: 'BoxCostPro Email Configuration Test',
        html: `
          <h2>Email Configuration Test Successful</h2>
          <p>This test email confirms that your SMTP configuration is working correctly.</p>
          <table style="border-collapse: collapse; margin: 20px 0;">
            <tr><td style="padding: 5px;"><strong>Provider:</strong></td><td style="padding: 5px;">${config.provider}</td></tr>
            <tr><td style="padding: 5px;"><strong>From:</strong></td><td style="padding: 5px;">${config.fromName} (${config.fromEmail})</td></tr>
            <tr><td style="padding: 5px;"><strong>SMTP Host:</strong></td><td style="padding: 5px;">${config.smtpHost}</td></tr>
            <tr><td style="padding: 5px;"><strong>Port:</strong></td><td style="padding: 5px;">${config.smtpPort}</td></tr>
            <tr><td style="padding: 5px;"><strong>Encryption:</strong></td><td style="padding: 5px;">${config.encryption}</td></tr>
          </table>
          <p style="color: green; font-weight: bold;">✓ Configuration verified successfully!</p>
        `,
        text: `Email Configuration Test Successful\n\nProvider: ${config.provider}\nFrom: ${config.fromName} (${config.fromEmail})\nSMTP Host: ${config.smtpHost}\nPort: ${config.smtpPort}\nEncryption: ${config.encryption}\n\n✓ Configuration verified successfully!`,
      });

      return { success: true };
    } catch (sendError: any) {
      console.error('[SMTP Test] Send failed:', sendError);
      return handleSMTPError(sendError, config.provider);
    }
  } catch (error: any) {
    console.error('[SMTP Test] Unexpected error:', error);
    return handleSMTPError(error, config.provider);
  }
}

/**
 * Send system email using active configuration
 */
export async function sendSystemEmail(
  storage: Storage,
  params: {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
    emailType?: string;
    relatedEntityType?: string;
    relatedEntityId?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    // Try to get active email configuration from email_providers table (primary source)
    let emailProvider: any | undefined;
    if (typeof (storage as any).getActiveEmailProviders === 'function') {
      const providers = await (storage as any).getActiveEmailProviders();
      emailProvider = providers?.[0]; // pick highest priority active provider
    }

    // Fallback 1: Get from admin_email_settings table (legacy)
    let emailConfig: any = null;
    if (!emailProvider && typeof storage.getActiveAdminEmailSettings === 'function') {
      emailConfig = await storage.getActiveAdminEmailSettings();
    }
    
    // Fallback 2: Use environment variables if neither table has config
    if (!emailProvider && !emailConfig) {
      console.warn('[Email Service] No email provider found in database. Attempting fallback from environment variables...');
      
      // Check if we have fallback credentials in environment
      if (process.env.SMTP_HOST && process.env.SMTP_USERNAME && process.env.SMTP_PASSWORD) {
        console.log('[Email Service] Using fallback SMTP configuration from environment variables');
        emailConfig = {
          id: 'fallback-env',
          smtpProvider: 'custom',
          fromName: process.env.FROM_NAME || 'BoxCostPro',
          fromEmail: process.env.FROM_EMAIL || 'noreply@boxcostpro.com',
          smtpHost: process.env.SMTP_HOST!,
          smtpPort: parseInt(process.env.SMTP_PORT || '587'),
          encryption: (process.env.SMTP_ENCRYPTION || 'TLS') as 'TLS' | 'SSL' | 'NONE',
          smtpUsername: process.env.SMTP_USERNAME!,
          smtpPasswordEncrypted: process.env.SMTP_PASSWORD!,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastTestedAt: null,
          testStatus: null,
          createdBy: null,
        };
      } else {
        throw new Error('No active email provider configured. Please set up email in Admin Panel or configure SMTP_* environment variables.');
      }
    }

    // Decrypt password with validation
    let password: string;
    let fromEmail: string;
    let fromName: string;
    let smtpHost: string;
    let smtpPort: number;
    let smtpUsername: string;
    let encryption: string;
    
    try {
      if (emailProvider) {
        // Using email_providers table
        console.log('[Email Service] Using email provider from email_providers table');
        smtpHost = emailProvider.smtp_host!;
        smtpPort = emailProvider.smtp_port!;
        smtpUsername = emailProvider.smtp_username!;
        encryption = emailProvider.smtp_encryption || 'TLS';
        fromEmail = emailProvider.from_email;
        fromName = emailProvider.from_name;
        
        // Decrypt password
        password = decryptPassword(emailProvider.smtp_password_encrypted!);
        console.log('[Email Service] Password decrypted from email_providers');
      } else {
        // Using admin_email_settings or fallback
        smtpHost = emailConfig.smtpHost;
        smtpPort = emailConfig.smtpPort;
        smtpUsername = emailConfig.smtpUsername;
        encryption = emailConfig.encryption;
        fromEmail = emailConfig.fromEmail;
        fromName = emailConfig.fromName;
        
        // Handle fallback environment variable passwords (not encrypted)
        if (emailConfig.id === 'fallback-env') {
          password = emailConfig.smtpPasswordEncrypted; // Direct password from env, not encrypted
          console.log('[Email Service] Using fallback password (direct from environment)');
        } else {
          password = decryptPassword(emailConfig.smtpPasswordEncrypted);
          console.log('[Email Service] Password decrypted from admin_email_settings');
        }
      }
      
      // Validate password
      if (!password || password.length === 0) {
        const error = new Error('SMTP password is empty or invalid.');
        console.error('[Email Service] Password validation failed:', {
          keyPresent: !!(process.env.ENCRYPTION_KEY || process.env.SESSION_SECRET),
          keyLength: (process.env.ENCRYPTION_KEY || process.env.SESSION_SECRET)?.length || 0,
        });
        throw error;
      }
    } catch (decryptError: any) {
      console.error('[Email Service] Password handling failed:', decryptError.message);
      throw new Error(`SMTP password handling failed: ${decryptError.message}. Check ENCRYPTION_KEY configuration.`);
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: encryption === 'SSL',
      auth: {
        user: smtpUsername,
        pass: password,
      },
    });

    // Send email
    const recipients = Array.isArray(params.to) ? params.to : [params.to];

    for (const recipient of recipients) {
      try {
        // DEV MODE: Log email instead of sending if using fallback and password is placeholder
        if (emailConfig && emailConfig.id === 'fallback-env' && password === 'your-app-password-here') {
          console.log('[Email Service - DEV MODE] Email would be sent (SMTP not configured):');
          console.log(`  TO: ${recipient}`);
          console.log(`  FROM: ${fromEmail}`);
          console.log(`  SUBJECT: ${params.subject}`);
          console.log(`  BODY:\n${params.html}`);
          console.log('---');

          // Log to database as 'sent' for tracking
          await storage.createEmailLog({
            userId: params.relatedEntityId || 'system',
            recipientEmail: recipient,
            senderEmail: fromEmail,
            provider: 'dev-console',
            subject: params.subject,
            channel: params.emailType || 'system',
            status: 'sent',
            messageId: 'dev-mode-' + Date.now(),
          }).catch(err => console.error('Failed to log email:', err));
          
          continue; // Skip actual SMTP send
        }

        await transporter.sendMail({
          from: `"${fromName}" <${fromEmail}>`,
          to: recipient,
          subject: params.subject,
          html: params.html,
          text: params.text || params.html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
        });

        // Log successful send (using existing emailLogs schema)
        await storage.createEmailLog({
          userId: params.relatedEntityId || 'system', // Use system if no user ID
          recipientEmail: recipient,
          senderEmail: fromEmail,
          provider: 'smtp',
          subject: params.subject,
          channel: params.emailType || 'system',
          status: 'sent',
          messageId: null,
        }).catch(err => console.error('Failed to log email:', err));

      } catch (sendError: any) {
        // Log failed send (using existing emailLogs schema)
        await storage.createEmailLog({
          userId: params.relatedEntityId || 'system',
          recipientEmail: recipient,
          senderEmail: fromEmail,
          provider: 'smtp',
          subject: params.subject,
          channel: params.emailType || 'system',
          status: 'failed',
          failureReason: sendError.message,
          messageId: null,
        }).catch(err => console.error('Failed to log email:', err));

        throw sendError;
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error('Failed to send system email:', error);
    return {
      success: false,
      error: error.message || 'Failed to send email',
    };
  }
}

/**
 * Fire-and-forget email sending (async, doesn't throw)
 */
export async function sendSystemEmailAsync(
  storage: Storage,
  params: Parameters<typeof sendSystemEmail>[1]
): Promise<void> {
  sendSystemEmail(storage, params).catch(error => {
    console.error('Async email send failed (non-blocking):', error);
  });
}

// Lightweight in-memory queue with retry/backoff so calling flows don't block
type QueuedEmail = {
  storage: Storage;
  params: Parameters<typeof sendSystemEmail>[1];
  attempt: number;
};

const emailQueue: QueuedEmail[] = [];
const MAX_EMAIL_ATTEMPTS = 3;
const BASE_RETRY_DELAY_MS = 2000; // 2s, then 4s, then 8s (capped by attempts)
let processingQueue = false;

async function processEmailQueue(): Promise<void> {
  if (processingQueue) return;
  processingQueue = true;

  while (emailQueue.length > 0) {
    const job = emailQueue.shift();
    if (!job) {
      break;
    }

    const result = await sendSystemEmail(job.storage, job.params);

    if (!result.success && job.attempt < MAX_EMAIL_ATTEMPTS) {
      const nextAttempt = job.attempt + 1;
      const delay = BASE_RETRY_DELAY_MS * Math.pow(2, job.attempt - 1);
      setTimeout(() => {
        emailQueue.push({ ...job, attempt: nextAttempt });
        processEmailQueue().catch(err => console.error('[EmailQueue] Unexpected error while retrying:', err));
      }, delay);
    } else if (!result.success) {
      console.error(`[EmailQueue] Giving up after ${job.attempt} attempts for ${job.params.to}: ${result.error}`);
    }
  }

  processingQueue = false;
}

export function enqueueSystemEmailWithRetry(
  storage: Storage,
  params: Parameters<typeof sendSystemEmail>[1],
): void {
  emailQueue.push({ storage, params, attempt: 1 });
  processEmailQueue().catch(err => console.error('[EmailQueue] Unexpected error while processing queue:', err));
}
