/**
 * Email Sending Service
 * Smart Routing: User OAuth → User SMTP → Error
 * Centralized email service for BoxCostPro
 */

import nodemailer from 'nodemailer';
import { storage } from '../storage';
import { decrypt } from '../utils/encryption';

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
}

interface TransporterResult {
  transporter: nodemailer.Transporter | null;
  fromAddress: string | null;
  error?: string;
  needsReauth?: boolean;
}

/**
 * Create a transporter for a specific user based on their email settings
 * @param requireVerified - if true, only returns transporter for verified settings
 */
async function getUserTransporter(userId: string, requireVerified: boolean = true): Promise<TransporterResult> {
  try {
    const settings = await storage.getUserEmailSettings(userId);
    
    if (!settings) {
      return { transporter: null, fromAddress: null, error: 'No email settings configured' };
    }
    
    if (requireVerified && !settings.isVerified) {
      return { transporter: null, fromAddress: null, error: 'Email settings not verified. Please verify your email configuration in Settings.' };
    }
    
    if (!settings.isActive) {
      return { transporter: null, fromAddress: null, error: 'Email settings are disabled' };
    }
    
    let transportConfig: any;
    
    // OAuth configuration (Google)
    // Nodemailer automatically handles token refresh when refresh token is provided
    if (settings.oauthProvider === 'google' && settings.oauthAccessTokenEncrypted) {
      const accessToken = decrypt(settings.oauthAccessTokenEncrypted);
      const refreshToken = settings.oauthRefreshTokenEncrypted ? decrypt(settings.oauthRefreshTokenEncrypted) : undefined;
      
      if (!accessToken) {
        return { transporter: null, fromAddress: null, error: 'Failed to decrypt OAuth tokens', needsReauth: true };
      }
      
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        return { transporter: null, fromAddress: null, error: 'Google OAuth not configured on server' };
      }
      
      // Nodemailer OAuth2 transport - automatically refreshes tokens when refreshToken is provided
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
        return { transporter: null, fromAddress: null, error: 'Failed to decrypt SMTP password' };
      }
      
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
      return { transporter: null, fromAddress: null, error: 'No valid credentials configured' };
    }
    
    const transporter = nodemailer.createTransport(transportConfig);
    return { transporter, fromAddress: settings.emailAddress };
  } catch (err) {
    console.error('Error creating user transporter:', err);
    return { transporter: null, fromAddress: null, error: String(err) };
  }
}

/**
 * Send email from USER's configured email address (Smart Routing)
 * Priority: User OAuth → User SMTP → Error
 * For user-initiated quote emails - no fallback to system email (quotes must come from user's address)
 */
export async function sendUserEmail({ userId, to, subject, html, text, replyTo }: SendUserEmailParams): Promise<{ success: boolean; fromAddress?: string; error?: string; needsReauth?: boolean }> {
  // Get user's transporter (must be verified)
  const { transporter, fromAddress, error, needsReauth } = await getUserTransporter(userId, true);
  
  if (!transporter || !fromAddress) {
    return { 
      success: false, 
      error: error || 'Email not configured. Please set up your email in Settings → Email.',
      needsReauth
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
    return { success: true, fromAddress };
  } catch (err: any) {
    console.error('USER_EMAIL_SEND_FAILED:', err);
    
    // Check for OAuth token expiry or auth errors
    const authErrors = ['invalid_grant', 'Invalid Credentials', 'Unauthorized', 'EAUTH'];
    const isAuthError = err.responseCode === 401 || 
                        err.code === 'EAUTH' ||
                        authErrors.some(e => err.message?.includes(e));
    
    if (isAuthError) {
      return { 
        success: false, 
        error: 'Your email authorization has expired. Please reconnect your email in Settings.',
        needsReauth: true
      };
    }
    
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Send SYSTEM email (for admin notifications, password resets, etc.)
 * Uses system-level SMTP configuration
 */
export async function sendSystemEmail({ to, subject, html, text, replyTo }: SendEmailParams): Promise<{ success: boolean; error?: string }> {
  const transporter = getSystemTransporter();
  
  if (!transporter) {
    console.warn('SYSTEM_EMAIL_NOT_CONFIGURED: SMTP credentials not set');
    return { success: false, error: 'System email service not configured' };
  }

  try {
    const mailOptions: nodemailer.SendMailOptions = {
      from: `"BoxCostPro" <${process.env.EMAIL_FROM || process.env.SMTP_USER}>`,
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
    return { success: true };
  } catch (err) {
    console.error('SYSTEM_EMAIL_SEND_FAILED:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Legacy sendEmail function - use sendSystemEmail for system emails
 * or sendUserEmail for user-initiated emails
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
 * This can be called for unverified settings to test and verify them
 */
export async function verifyUserEmailConnection(userId: string): Promise<{ success: boolean; error?: string; needsReauth?: boolean }> {
  // Allow verification for unverified settings (requireVerified = false)
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
