/**
 * Email Sending Service
 * Smart Routing: User OAuth → User SMTP → Error
 * With full delivery logging and bounce detection
 */

import nodemailer from 'nodemailer';
import { storage } from '../storage';
import { decrypt } from '../utils/encryption';
import type { InsertEmailLog, InsertEmailBounce } from '@shared/schema';

// SMTP bounce error codes for detection
const HARD_BOUNCE_CODES = [
  '550', '551', '552', '553', '554', // Permanent failures
  '511', '521', '525', '530', '535', // Authentication/mailbox issues
];

const SOFT_BOUNCE_CODES = [
  '421', '422', '450', '451', '452', // Temporary failures
  '432', '441', '442', // Greylisting, temp unavailable
];

// System-level transporter for fallback/admin emails
const getSystemTransporter = () => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }
  
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

interface SendUserEmailParams extends SendEmailParams {
  userId: string;
  channel?: 'quote' | 'followup' | 'system' | 'confirmation';
  quoteId?: string;
}

interface SendSystemEmailParams extends SendEmailParams {
  userId?: string;
  channel?: 'system' | 'confirmation';
}

interface TransporterResult {
  transporter: nodemailer.Transporter | null;
  fromAddress: string | null;
  provider: string;
  error?: string;
  needsReauth?: boolean;
}

/**
 * Log email attempt asynchronously (non-blocking)
 */
async function logEmailAttempt(params: {
  userId: string;
  recipientEmail: string;
  senderEmail: string;
  provider: string;
  subject: string;
  channel: string;
  status: 'sent' | 'delivered' | 'bounced' | 'failed';
  messageId?: string;
  failureReason?: string;
  quoteId?: string;
}): Promise<string | null> {
  try {
    const log = await storage.createEmailLog({
      userId: params.userId,
      recipientEmail: params.recipientEmail,
      senderEmail: params.senderEmail,
      provider: params.provider,
      subject: params.subject,
      channel: params.channel,
      status: params.status,
      messageId: params.messageId || null,
      failureReason: params.failureReason || null,
      quoteId: params.quoteId || null,
    });
    return log.id;
  } catch (err) {
    console.error('EMAIL_LOG_FAILED:', err);
    return null;
  }
}

/**
 * Detect bounce type from SMTP error
 */
function detectBounceType(errorCode: string | number | undefined, errorMessage: string): 'hard' | 'soft' | null {
  const codeStr = String(errorCode || '');
  
  if (HARD_BOUNCE_CODES.some(code => codeStr.startsWith(code))) {
    return 'hard';
  }
  
  if (SOFT_BOUNCE_CODES.some(code => codeStr.startsWith(code))) {
    return 'soft';
  }
  
  // Check message patterns for bounce indicators
  const hardBouncePatterns = [
    'user unknown', 'user not found', 'mailbox not found',
    'invalid recipient', 'recipient rejected', 'does not exist',
    'no such user', 'address rejected', 'domain not found'
  ];
  
  const softBouncePatterns = [
    'mailbox full', 'over quota', 'temporarily unavailable',
    'try again later', 'service unavailable', 'too many connections'
  ];
  
  const lowerMessage = errorMessage.toLowerCase();
  
  if (hardBouncePatterns.some(p => lowerMessage.includes(p))) {
    return 'hard';
  }
  
  if (softBouncePatterns.some(p => lowerMessage.includes(p))) {
    return 'soft';
  }
  
  return null;
}

/**
 * Log bounce asynchronously
 */
async function logBounce(params: {
  emailLogId: string;
  recipientEmail: string;
  bounceType: 'hard' | 'soft';
  bounceReason: string;
  provider: string;
}): Promise<void> {
  try {
    await storage.createEmailBounce({
      emailLogId: params.emailLogId,
      recipientEmail: params.recipientEmail,
      bounceType: params.bounceType,
      bounceReason: params.bounceReason,
      provider: params.provider,
    });
    console.log('BOUNCE_LOGGED:', { type: params.bounceType, recipient: params.recipientEmail });
  } catch (err) {
    console.error('BOUNCE_LOG_FAILED:', err);
  }
}

/**
 * Create a transporter for a specific user based on their email settings
 */
async function getUserTransporter(userId: string, requireVerified: boolean = true): Promise<TransporterResult> {
  try {
    const settings = await storage.getUserEmailSettings(userId);
    
    if (!settings) {
      return { transporter: null, fromAddress: null, provider: 'none', error: 'No email settings configured' };
    }
    
    if (requireVerified && !settings.isVerified) {
      return { transporter: null, fromAddress: null, provider: settings.provider || 'unknown', error: 'Email settings not verified. Please verify your email configuration in Settings.' };
    }
    
    if (!settings.isActive) {
      return { transporter: null, fromAddress: null, provider: settings.provider || 'unknown', error: 'Email settings are disabled' };
    }
    
    let transportConfig: any;
    let provider = settings.provider || 'smtp';
    
    // OAuth configuration (Google)
    if (settings.oauthProvider === 'google' && settings.oauthAccessTokenEncrypted) {
      const accessToken = decrypt(settings.oauthAccessTokenEncrypted);
      const refreshToken = settings.oauthRefreshTokenEncrypted ? decrypt(settings.oauthRefreshTokenEncrypted) : undefined;
      
      if (!accessToken) {
        return { transporter: null, fromAddress: null, provider: 'google-oauth', error: 'Failed to decrypt OAuth tokens', needsReauth: true };
      }
      
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        return { transporter: null, fromAddress: null, provider: 'google-oauth', error: 'Google OAuth not configured on server' };
      }
      
      provider = 'google-oauth';
      transportConfig = {
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: settings.emailAddress,
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          accessToken,
          refreshToken,
        }
      };
    } 
    // SMTP configuration
    else if (settings.smtpPasswordEncrypted) {
      const password = decrypt(settings.smtpPasswordEncrypted);
      
      if (!password) {
        return { transporter: null, fromAddress: null, provider: 'smtp', error: 'Failed to decrypt SMTP password' };
      }
      
      provider = 'smtp';
      transportConfig = {
        host: settings.smtpHost,
        port: settings.smtpPort || 587,
        secure: settings.smtpSecure || false,
        auth: {
          user: settings.smtpUsername || settings.emailAddress,
          pass: password
        }
      };
    } else {
      return { transporter: null, fromAddress: null, provider: 'unknown', error: 'No valid credentials configured' };
    }
    
    const transporter = nodemailer.createTransport(transportConfig);
    return { transporter, fromAddress: settings.emailAddress, provider };
  } catch (err) {
    console.error('Error creating user transporter:', err);
    return { transporter: null, fromAddress: null, provider: 'unknown', error: String(err) };
  }
}

/**
 * Send email from USER's configured email address (Smart Routing)
 * With full logging and bounce detection
 */
export async function sendUserEmail({ 
  userId, to, subject, html, text, replyTo, 
  channel = 'quote', quoteId 
}: SendUserEmailParams): Promise<{ success: boolean; fromAddress?: string; error?: string; needsReauth?: boolean; logId?: string }> {
  const { transporter, fromAddress, provider, error, needsReauth } = await getUserTransporter(userId, true);
  
  if (!transporter || !fromAddress) {
    // Log failed attempt
    const logId = await logEmailAttempt({
      userId,
      recipientEmail: to,
      senderEmail: 'unknown',
      provider: provider || 'none',
      subject,
      channel,
      status: 'failed',
      failureReason: error || 'No transporter available',
      quoteId,
    });
    
    return { 
      success: false, 
      error: error || 'Email not configured. Please set up your email in Settings → Email.',
      needsReauth,
      logId: logId || undefined
    };
  }
  
  try {
    const mailOptions: nodemailer.SendMailOptions = {
      from: fromAddress,
      to,
      subject,
      html,
    };
    
    if (text) {
      mailOptions.text = text;
    }
    
    if (replyTo) {
      mailOptions.replyTo = replyTo;
    }
    
    const info = await transporter.sendMail(mailOptions);
    console.log('USER_EMAIL_SENT_SUCCESS:', { messageId: info.messageId, to, subject, from: fromAddress });
    
    // Log successful send
    const logId = await logEmailAttempt({
      userId,
      recipientEmail: to,
      senderEmail: fromAddress,
      provider,
      subject,
      channel,
      status: 'sent',
      messageId: info.messageId,
      quoteId,
    });
    
    return { success: true, fromAddress, logId: logId || undefined };
  } catch (err: any) {
    console.error('USER_EMAIL_SEND_FAILED:', err);
    
    // Detect bounce type
    const bounceType = detectBounceType(err.responseCode, err.message || '');
    const status = bounceType ? 'bounced' : 'failed';
    
    // Log the failure
    const logId = await logEmailAttempt({
      userId,
      recipientEmail: to,
      senderEmail: fromAddress,
      provider,
      subject,
      channel,
      status,
      failureReason: err.message || String(err),
      quoteId,
    });
    
    // If it's a bounce, create bounce record
    if (bounceType && logId) {
      await logBounce({
        emailLogId: logId,
        recipientEmail: to,
        bounceType,
        bounceReason: err.message || String(err),
        provider,
      });
    }
    
    // Check for OAuth token expiry or auth errors
    const authErrors = ['invalid_grant', 'Invalid Credentials', 'Unauthorized', 'EAUTH'];
    const isAuthError = err.responseCode === 401 || 
                        err.code === 'EAUTH' ||
                        authErrors.some(e => err.message?.includes(e));
    
    if (isAuthError) {
      return { 
        success: false, 
        error: 'Your email authorization has expired. Please reconnect your email in Settings.',
        needsReauth: true,
        logId: logId || undefined
      };
    }
    
    return { success: false, error: err.message || String(err), logId: logId || undefined };
  }
}

/**
 * Send SYSTEM email (for admin notifications, confirmations, etc.)
 * With optional logging when userId is provided
 */
export async function sendSystemEmail({ 
  to, subject, html, text, replyTo,
  userId, channel = 'system'
}: SendSystemEmailParams): Promise<{ success: boolean; error?: string; logId?: string }> {
  const transporter = getSystemTransporter();
  const senderEmail = process.env.EMAIL_FROM || process.env.SMTP_USER || 'noreply@boxcostpro.com';
  
  if (!transporter) {
    console.warn('SYSTEM_EMAIL_NOT_CONFIGURED: SMTP credentials not set');
    
    // Log failure if userId provided
    if (userId) {
      await logEmailAttempt({
        userId,
        recipientEmail: to,
        senderEmail,
        provider: 'system-smtp',
        subject,
        channel,
        status: 'failed',
        failureReason: 'System email not configured',
      });
    }
    
    return { success: false, error: 'System email service not configured' };
  }

  try {
    const mailOptions: nodemailer.SendMailOptions = {
      from: `"BoxCostPro" <${senderEmail}>`,
      to,
      subject,
      html,
    };

    if (text) {
      mailOptions.text = text;
    }

    if (replyTo) {
      mailOptions.replyTo = replyTo;
    }

    const info = await transporter.sendMail(mailOptions);
    console.log('SYSTEM_EMAIL_SENT_SUCCESS:', { messageId: info.messageId, to, subject });
    
    // Log success if userId provided
    let logId: string | null = null;
    if (userId) {
      logId = await logEmailAttempt({
        userId,
        recipientEmail: to,
        senderEmail,
        provider: 'system-smtp',
        subject,
        channel,
        status: 'sent',
        messageId: info.messageId,
      });
    }
    
    return { success: true, logId: logId || undefined };
  } catch (err: any) {
    console.error('SYSTEM_EMAIL_SEND_FAILED:', err);
    
    // Log failure if userId provided
    if (userId) {
      const bounceType = detectBounceType(err.responseCode, err.message || '');
      await logEmailAttempt({
        userId,
        recipientEmail: to,
        senderEmail,
        provider: 'system-smtp',
        subject,
        channel,
        status: bounceType ? 'bounced' : 'failed',
        failureReason: err.message || String(err),
      });
    }
    
    return { success: false, error: String(err) };
  }
}

/**
 * Send confirmation email when user successfully configures their email
 */
export async function sendEmailConfigurationConfirmation(userId: string, userEmail: string, ownerName: string, providerName: string): Promise<{ success: boolean; error?: string }> {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #16a34a;">Your Email Has Been Successfully Configured</h2>
      
      <p>Hello ${ownerName || 'there'},</p>
      
      <p>Your email address <strong>${userEmail}</strong> has been successfully configured in BoxCostPro.</p>
      
      <p><strong>Provider:</strong> ${providerName}</p>
      
      <p>You can now send quotations and follow-ups directly from your email account. Your customers will receive emails from your own address, making communication more professional and personal.</p>
      
      <p>If you did not perform this action, please contact our support team immediately.</p>
      
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
      
      <p style="color: #6b7280; font-size: 14px;">
        Warm regards,<br>
        <strong>BoxCostPro Team</strong>
      </p>
    </div>
  `;
  
  return sendSystemEmail({
    to: userEmail,
    subject: 'Your Email Has Been Successfully Configured – BoxCostPro',
    html,
    userId,
    channel: 'confirmation',
  });
}

/**
 * Legacy sendEmail function
 */
export async function sendEmail(params: SendEmailParams): Promise<{ success: boolean; error?: string }> {
  return sendSystemEmail(params);
}

/**
 * Check if a user has email configured
 */
export async function isUserEmailConfigured(userId: string): Promise<{ configured: boolean; verified: boolean; provider?: string }> {
  try {
    const settings = await storage.getUserEmailSettings(userId);
    
    if (!settings) {
      return { configured: false, verified: false };
    }
    
    return {
      configured: true,
      verified: settings.isVerified || false,
      provider: settings.provider || undefined
    };
  } catch {
    return { configured: false, verified: false };
  }
}

/**
 * Check if system email is configured
 */
export function isSystemEmailConfigured(): boolean {
  return !!(process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_HOST);
}

/**
 * Verify user's email connection
 */
export async function verifyUserEmailConnection(userId: string): Promise<{ success: boolean; error?: string; needsReauth?: boolean }> {
  const { transporter, error, needsReauth } = await getUserTransporter(userId, false);
  
  if (!transporter) {
    return { success: false, error: error || 'Failed to create transporter', needsReauth };
  }
  
  try {
    await transporter.verify();
    return { success: true };
  } catch (err: any) {
    const authErrors = ['invalid_grant', 'Invalid Credentials', 'Unauthorized', 'EAUTH'];
    const isAuthError = err.code === 'EAUTH' || authErrors.some(e => err.message?.includes(e));
    
    return { 
      success: false, 
      error: err.message || String(err),
      needsReauth: isAuthError
    };
  }
}

/**
 * Get email delivery stats for a user
 */
export async function getEmailDeliveryStats(userId: string, startDate?: Date, endDate?: Date) {
  return storage.getEmailStats(userId, startDate, endDate);
}

/**
 * Get bounced recipients for a user (hard bounces only)
 */
export async function getBouncedRecipients(userId: string): Promise<string[]> {
  return storage.getBouncedRecipients(userId);
}
