/**
 * User Email Service - Per-User Email Configuration
 *
 * Allows each user to send emails from their own email address using:
 * 1. Google OAuth (for sending emails, separate from Clerk auth)
 * 2. Custom SMTP configuration
 *
 * This replaces the global emailService for user-specific emails
 */

import nodemailer from 'nodemailer';
import { google } from 'googleapis';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  cc?: string;
  bcc?: string;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
  }>;
}

interface UserEmailConfig {
  userId: string;
  provider: 'google_oauth' | 'smtp';

  // Google OAuth fields
  googleAccessToken?: string;
  googleRefreshToken?: string;
  googleEmail?: string;

  // SMTP fields
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPass?: string;

  // Common fields
  fromEmail: string;
  fromName?: string;

  isActive: boolean;
}

class UserEmailService {
  private oauth2Client: any;

  constructor() {
    // Initialize Google OAuth client for token refresh
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || `${process.env.APP_URL}/api/email/google/callback`
    );
  }

  /**
   * Send email using user's configured email settings
   */
  async sendEmail(userConfig: UserEmailConfig, options: EmailOptions): Promise<boolean> {
    if (!userConfig.isActive) {
      console.error('[UserEmail] Email configuration is not active for user:', userConfig.userId);
      return false;
    }

    try {
      if (userConfig.provider === 'google_oauth') {
        return await this.sendViaGoogleOAuth(userConfig, options);
      } else {
        return await this.sendViaSMTP(userConfig, options);
      }
    } catch (error) {
      console.error('[UserEmail] Failed to send email:', error);
      return false;
    }
  }

  /**
   * Send email via Google OAuth (Gmail API)
   */
  private async sendViaGoogleOAuth(userConfig: UserEmailConfig, options: EmailOptions): Promise<boolean> {
    try {
      // Set credentials
      this.oauth2Client.setCredentials({
        access_token: userConfig.googleAccessToken,
        refresh_token: userConfig.googleRefreshToken,
      });

      // Get fresh access token if needed
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      const accessToken = credentials.access_token;

      // Create transporter with OAuth2
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: userConfig.googleEmail,
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          refreshToken: userConfig.googleRefreshToken,
          accessToken: accessToken,
        },
      });

      const mailOptions = {
        from: userConfig.fromName
          ? `${userConfig.fromName} <${userConfig.fromEmail}>`
          : userConfig.fromEmail,
        to: options.to,
        cc: options.cc,
        bcc: options.bcc,
        subject: options.subject,
        html: options.html,
        text: options.text || this.stripHtml(options.html),
        attachments: options.attachments,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('[UserEmail] Google OAuth email sent:', info.messageId);
      return true;
    } catch (error) {
      console.error('[UserEmail] Google OAuth send failed:', error);
      throw error;
    }
  }

  /**
   * Send email via custom SMTP
   */
  private async sendViaSMTP(userConfig: UserEmailConfig, options: EmailOptions): Promise<boolean> {
    try {
      const transporter = nodemailer.createTransport({
        host: userConfig.smtpHost,
        port: userConfig.smtpPort || 587,
        secure: userConfig.smtpSecure || false,
        auth: {
          user: userConfig.smtpUser,
          pass: userConfig.smtpPass,
        },
      });

      const mailOptions = {
        from: userConfig.fromName
          ? `${userConfig.fromName} <${userConfig.fromEmail}>`
          : userConfig.fromEmail,
        to: options.to,
        cc: options.cc,
        bcc: options.bcc,
        subject: options.subject,
        html: options.html,
        text: options.text || this.stripHtml(options.html),
        attachments: options.attachments,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('[UserEmail] SMTP email sent:', info.messageId);
      return true;
    } catch (error) {
      console.error('[UserEmail] SMTP send failed:', error);
      throw error;
    }
  }

  /**
   * Verify email configuration is working
   */
  async verifyConfiguration(userConfig: UserEmailConfig): Promise<{ success: boolean; error?: string }> {
    try {
      if (userConfig.provider === 'google_oauth') {
        // Verify Google OAuth tokens
        this.oauth2Client.setCredentials({
          access_token: userConfig.googleAccessToken,
          refresh_token: userConfig.googleRefreshToken,
        });

        await this.oauth2Client.refreshAccessToken();
        return { success: true };
      } else {
        // Verify SMTP connection
        const transporter = nodemailer.createTransport({
          host: userConfig.smtpHost,
          port: userConfig.smtpPort || 587,
          secure: userConfig.smtpSecure || false,
          auth: {
            user: userConfig.smtpUser,
            pass: userConfig.smtpPass,
          },
        });

        await transporter.verify();
        return { success: true };
      }
    } catch (error: any) {
      console.error('[UserEmail] Verification failed:', error);
      return {
        success: false,
        error: error.message || 'Configuration verification failed'
      };
    }
  }

  /**
   * Send test email to verify configuration
   */
  async sendTestEmail(userConfig: UserEmailConfig): Promise<boolean> {
    const testEmailOptions: EmailOptions = {
      to: userConfig.fromEmail, // Send to self
      subject: '✅ BoxCostPro Email Configuration Test',
      html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #667eea; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .success { background: #d1fae5; border-left: 4px solid #10b981; padding: 16px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Email Configuration Successful!</h1>
    </div>
    <div class="content">
      <div class="success">
        <p><strong>Great news!</strong> Your email configuration is working perfectly.</p>
      </div>
      <p>Your BoxCostPro account is now configured to send emails from:</p>
      <p><strong>${userConfig.fromEmail}</strong></p>
      <p>You can now:</p>
      <ul>
        <li>Send quote notifications to customers</li>
        <li>Send follow-up reminders</li>
        <li>Receive approval/rejection notifications</li>
      </ul>
      <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
        This is a test email from BoxCostPro. No action required.
      </p>
    </div>
  </div>
</body>
</html>
      `,
    };

    return this.sendEmail(userConfig, testEmailOptions);
  }

  /**
   * Send quote email to customer
   */
  async sendQuoteEmail(
    userConfig: UserEmailConfig,
    options: {
      customerEmail: string;
      customerName?: string;
      quotePdf?: Buffer;
      quoteNumber: string;
      message?: string;
    }
  ): Promise<boolean> {
    const { customerEmail, customerName, quotePdf, quoteNumber, message } = options;

    const emailOptions: EmailOptions = {
      to: customerEmail,
      subject: `Quotation ${quoteNumber} from ${userConfig.fromName || userConfig.fromEmail}`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #667eea; color: white; padding: 20px; text-align: center; }
    .content { background: #fff; padding: 30px; }
    .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Quotation ${quoteNumber}</h1>
    </div>
    <div class="content">
      <p>Dear ${customerName || 'Customer'},</p>
      ${message ? `<p>${message}</p>` : '<p>Please find attached our quotation for your requirements.</p>'}
      <p>Quote Number: <strong>${quoteNumber}</strong></p>
      ${quotePdf ? '<p>The detailed quotation is attached as a PDF.</p>' : ''}
      <p>If you have any questions or would like to discuss this quotation, please feel free to contact us.</p>
      <p>Best regards,<br>${userConfig.fromName || userConfig.fromEmail}</p>
    </div>
  </div>
</body>
</html>
      `,
      attachments: quotePdf ? [{
        filename: `Quote_${quoteNumber}.pdf`,
        content: quotePdf,
      }] : undefined,
    };

    return this.sendEmail(userConfig, emailOptions);
  }

  /**
   * Strip HTML tags for plain text version
   */
  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  /**
   * Get Google OAuth authorization URL
   */
  getGoogleAuthUrl(userId: string): string {
    const scopes = [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/userinfo.email',
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: userId, // Pass userId in state for callback
      prompt: 'consent', // Force consent screen to get refresh token
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async getGoogleTokens(code: string): Promise<{
    accessToken: string;
    refreshToken: string;
    email: string;
  }> {
    const { tokens } = await this.oauth2Client.getToken(code);

    // Get user email
    this.oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
    const { data } = await oauth2.userinfo.get();

    return {
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token!,
      email: data.email!,
    };
  }
}

// Export singleton instance
export const userEmailService = new UserEmailService();

// Export types
export type { UserEmailConfig, EmailOptions };
