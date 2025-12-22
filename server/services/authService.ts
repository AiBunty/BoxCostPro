/**
 * Authentication Service
 * Handles audit logging, admin notifications, and security operations
 */

import { storage } from '../storage';
import { sendSystemEmail } from './emailService';
import type { InsertAuthAuditLog } from '@shared/schema';

// Hardcoded admin email - NEVER expose or make configurable from UI
const ADMIN_NOTIFICATION_EMAIL = 'saas@aibunty.com';
const FROM_EMAIL = 'noreply@paperboxerp.com';
const APP_NAME = 'PaperBox ERP';

// Auth event types
export type AuthAction = 
  | 'LOGIN'
  | 'SIGNUP'
  | 'LOGOUT'
  | 'PASSWORD_RESET_REQUEST'
  | 'PASSWORD_RESET_COMPLETE'
  | 'VERIFY_EMAIL'
  | 'VERIFY_MOBILE'
  | 'ACCOUNT_LOCKED'
  | 'FAILED_LOGIN'
  | 'PROFILE_COMPLETE';

interface AuditLogParams {
  userId?: string;
  email?: string;
  action: AuthAction;
  status?: 'success' | 'failed';
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

/**
 * Log authentication event - fire-and-forget
 */
export function logAuthEventAsync(params: AuditLogParams): void {
  setImmediate(async () => {
    try {
      await storage.createAuthAuditLog({
        userId: params.userId || null,
        email: params.email || null,
        action: params.action,
        status: params.status || 'success',
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
        metadata: params.metadata || {},
      });
    } catch (err) {
      console.error('AUTH_AUDIT_LOG_FAILED:', err);
    }
  });
}

/**
 * Send admin notification email - fire-and-forget
 * Notifies admin on important auth events
 */
export function notifyAdminAsync(params: {
  subject: string;
  eventType: AuthAction;
  userEmail?: string;
  userName?: string;
  mobileNumber?: string;
  signupMethod?: string;
  ipAddress?: string;
  timestamp?: Date;
  additionalInfo?: Record<string, any>;
}): void {
  setImmediate(async () => {
    try {
      const timestamp = params.timestamp || new Date();
      const formattedDate = timestamp.toLocaleString('en-IN', {
        dateStyle: 'full',
        timeStyle: 'medium',
        timeZone: 'Asia/Kolkata'
      });

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #1a56db; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9fafb; }
            .info-row { margin: 10px 0; padding: 10px; background: white; border-radius: 4px; }
            .label { font-weight: bold; color: #4b5563; }
            .value { color: #111827; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>${APP_NAME} - Admin Notification</h2>
            </div>
            <div class="content">
              <h3 style="color: #1a56db;">${params.eventType.replace(/_/g, ' ')}</h3>
              
              ${params.userName ? `
              <div class="info-row">
                <span class="label">User Name:</span>
                <span class="value">${params.userName}</span>
              </div>
              ` : ''}
              
              ${params.userEmail ? `
              <div class="info-row">
                <span class="label">Email:</span>
                <span class="value">${params.userEmail}</span>
              </div>
              ` : ''}
              
              ${params.mobileNumber ? `
              <div class="info-row">
                <span class="label">Mobile Number:</span>
                <span class="value">${params.mobileNumber}</span>
              </div>
              ` : ''}
              
              ${params.signupMethod ? `
              <div class="info-row">
                <span class="label">Signup Method:</span>
                <span class="value">${params.signupMethod}</span>
              </div>
              ` : ''}
              
              <div class="info-row">
                <span class="label">Date & Time:</span>
                <span class="value">${formattedDate}</span>
              </div>
              
              ${params.ipAddress ? `
              <div class="info-row">
                <span class="label">IP Address:</span>
                <span class="value">${params.ipAddress}</span>
              </div>
              ` : ''}
              
              ${params.additionalInfo ? Object.entries(params.additionalInfo).map(([key, value]) => `
              <div class="info-row">
                <span class="label">${key}:</span>
                <span class="value">${value}</span>
              </div>
              `).join('') : ''}
            </div>
            <div class="footer">
              <p>This is an automated notification from ${APP_NAME}</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await sendSystemEmail({
        to: ADMIN_NOTIFICATION_EMAIL,
        subject: `[${APP_NAME}] ${params.subject}`,
        html,
        channel: 'system',
      });
    } catch (err) {
      console.error('ADMIN_NOTIFICATION_FAILED:', err);
    }
  });
}

/**
 * Send welcome email to new user
 */
export async function sendWelcomeEmail(params: {
  email: string;
  userName?: string;
  signupMethod?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #1a56db 0%, #3b82f6 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { padding: 30px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none; }
          .cta-button { display: inline-block; background: #1a56db; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; background: #f9fafb; border-radius: 0 0 8px 8px; }
          .security-note { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 4px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to ${APP_NAME}! 🎉</h1>
          </div>
          <div class="content">
            <h2>Hello${params.userName ? ` ${params.userName}` : ''}!</h2>
            
            <p>Thank you for joining ${APP_NAME}. Your account has been created successfully.</p>
            
            <p>With ${APP_NAME}, you can:</p>
            <ul>
              <li>Calculate accurate box costs instantly</li>
              <li>Generate professional quotes</li>
              <li>Manage your clients efficiently</li>
              <li>Track your business performance</li>
            </ul>
            
            <p style="text-align: center;">
              <a href="${process.env.REPLIT_DEV_DOMAIN ? 'https://' + process.env.REPLIT_DEV_DOMAIN : 'https://paperboxerp.com'}" class="cta-button">
                Get Started Now
              </a>
            </p>
            
            <div class="security-note">
              <strong>Security Note:</strong> If you did not create this account, please ignore this email or contact our support team immediately.
            </div>
          </div>
          <div class="footer">
            <p>Need help? Contact us at support@paperboxerp.com</p>
            <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const result = await sendSystemEmail({
      to: params.email,
      subject: `Welcome to ${APP_NAME}! 🎉`,
      html,
      channel: 'system',
    });

    return result;
  } catch (err: any) {
    console.error('WELCOME_EMAIL_FAILED:', err);
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(params: {
  email: string;
  resetLink: string;
  userName?: string;
  ipAddress?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc2626; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { padding: 30px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none; }
          .cta-button { display: inline-block; background: #dc2626; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
          .warning { background: #fef2f2; border: 1px solid #dc2626; padding: 15px; border-radius: 4px; margin-top: 20px; color: #991b1b; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; background: #f9fafb; border-radius: 0 0 8px 8px; }
          .expiry { color: #dc2626; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Reset Your Password</h1>
          </div>
          <div class="content">
            <h2>Hello${params.userName ? ` ${params.userName}` : ''}!</h2>
            
            <p>We received a request to reset your ${APP_NAME} password.</p>
            
            <p>Click the button below to set a new password:</p>
            
            <p style="text-align: center;">
              <a href="${params.resetLink}" class="cta-button">
                Reset Password
              </a>
            </p>
            
            <p class="expiry">This link expires in 15 minutes.</p>
            
            <div class="warning">
              <strong>⚠️ Security Warning:</strong><br/>
              If you did not request this password reset, please ignore this email. Your password will remain unchanged.
              ${params.ipAddress ? `<br/><br/>Request originated from IP: ${params.ipAddress}` : ''}
            </div>
          </div>
          <div class="footer">
            <p>This email was sent from ${APP_NAME}</p>
            <p>If you need help, contact support@paperboxerp.com</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const result = await sendSystemEmail({
      to: params.email,
      subject: `Reset Your ${APP_NAME} Password`,
      html,
      channel: 'system',
    });

    return result;
  } catch (err: any) {
    console.error('PASSWORD_RESET_EMAIL_FAILED:', err);
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Validate password strength
 * Returns null if valid, or error message if invalid
 */
export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) {
    return 'Password must be at least 8 characters long';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number';
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return 'Password must contain at least one special character';
  }
  return null;
}

/**
 * Check if email is from a disposable domain
 */
const DISPOSABLE_DOMAINS = [
  'tempmail.com', 'throwaway.com', 'mailinator.com', 'guerrillamail.com',
  'yopmail.com', '10minutemail.com', 'fakeinbox.com', 'trashmail.com',
  'temp-mail.org', 'tempail.com', 'dispostable.com', 'sharklasers.com'
];

export function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return DISPOSABLE_DOMAINS.some(d => domain?.includes(d));
}

/**
 * Extract client info from request
 */
export function extractClientInfo(req: any): { ipAddress: string; userAgent: string } {
  const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() 
    || req.headers['x-real-ip'] 
    || req.connection?.remoteAddress 
    || req.socket?.remoteAddress 
    || 'unknown';
  
  const userAgent = req.headers['user-agent'] || 'unknown';
  
  return { ipAddress, userAgent };
}
