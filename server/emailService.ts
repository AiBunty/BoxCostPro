/**
 * Email Notification Service
 *
 * Handles all email notifications for BoxCostPro
 * Supports multiple providers: SendGrid, AWS SES, Nodemailer (SMTP)
 *
 * Environment Variables Required:
 * - EMAIL_PROVIDER: 'sendgrid' | 'ses' | 'smtp'
 * - SENDGRID_API_KEY: (if using SendGrid)
 * - AWS_SES_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY: (if using SES)
 * - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS: (if using SMTP)
 * - FROM_EMAIL: Sender email address
 * - FROM_NAME: Sender name (default: BoxCostPro)
 */

import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface UserData {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string;
}

class EmailService {
  private transporter: any;
  private provider: string;
  private fromEmail: string;
  private fromName: string;
  private appUrl: string;

  constructor() {
    this.provider = process.env.EMAIL_PROVIDER || 'smtp';
    this.fromEmail = process.env.FROM_EMAIL || 'noreply@boxcostpro.com';
    this.fromName = process.env.FROM_NAME || 'BoxCostPro';
    this.appUrl = process.env.APP_URL || 'http://localhost:5000';

    this.initializeTransporter();
  }

  private initializeTransporter() {
    switch (this.provider) {
      case 'sendgrid':
        // SendGrid integration
        // Requires: npm install @sendgrid/mail
        console.log('[Email] Using SendGrid provider');
        break;

      case 'ses':
        // AWS SES integration
        // Requires: npm install @aws-sdk/client-ses
        console.log('[Email] Using AWS SES provider');
        break;

      case 'smtp':
      default:
        // Nodemailer SMTP (most flexible, works with Gmail, Outlook, etc.)
        console.log('[Email] Using SMTP provider');
        this.transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });
        break;
    }
  }

  /**
   * Send a generic email
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      if (!this.transporter) {
        console.error('[Email] Transporter not initialized. Please configure email settings.');
        return false;
      }

      const mailOptions = {
        from: `${this.fromName} <${this.fromEmail}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || this.stripHtml(options.html),
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('[Email] Sent successfully:', info.messageId);
      return true;
    } catch (error) {
      console.error('[Email] Failed to send:', error);
      return false;
    }
  }

  /**
   * Send approval email to user
   */
  async sendApprovalEmail(userData: UserData): Promise<boolean> {
    const fullName = [userData.firstName, userData.lastName].filter(Boolean).join(' ') || 'User';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 28px; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .card { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .success-icon { font-size: 48px; text-align: center; margin: 20px 0; }
    .feature-list { list-style: none; padding: 0; }
    .feature-list li { padding: 8px 0; padding-left: 24px; position: relative; }
    .feature-list li:before { content: "✅"; position: absolute; left: 0; }
    .button { display: inline-block; background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
    .button:hover { background: #5568d3; }
    .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Account Approved!</h1>
    </div>
    <div class="content">
      <div class="card">
        <div class="success-icon">🎊</div>
        <p style="font-size: 18px; font-weight: 600; text-align: center; color: #10b981;">
          Congratulations, ${fullName}!
        </p>
        <p style="text-align: center;">
          Great news! Your BoxCostPro account has been approved and is now fully activated.
        </p>
      </div>

      <div class="card">
        <h2 style="color: #667eea; margin-top: 0;">You Now Have Full Access To:</h2>
        <ul class="feature-list">
          <li><strong>Box Costing Calculator</strong> - Calculate costs for RSC boxes and flat sheets</li>
          <li><strong>Quote Management</strong> - Create, edit, and track quotations</li>
          <li><strong>Customer Profiles</strong> - Manage party details and history</li>
          <li><strong>Report Generation</strong> - Download and share professional quotes</li>
          <li><strong>WhatsApp & Email</strong> - Send quotes directly to customers</li>
          <li><strong>Master Settings</strong> - Configure paper pricing and GST rates</li>
        </ul>
      </div>

      <div style="text-align: center;">
        <a href="${this.appUrl}/create-quote" class="button">
          Start Creating Quotes →
        </a>
      </div>

      <div class="card" style="background: #fef3c7; border-left: 4px solid #f59e0b;">
        <h3 style="margin-top: 0; color: #92400e;">🚀 Quick Start Tips</h3>
        <ol style="margin: 0; padding-left: 20px;">
          <li>Set up your paper pricing in <strong>Masters → Paper Pricing</strong></li>
          <li>Configure your GST rate in <strong>Masters → Tax & GST</strong></li>
          <li>Add customer profiles in <strong>Masters → Party Profiles</strong></li>
          <li>Create your first quote in <strong>Calculator</strong></li>
        </ol>
      </div>

      <div class="card">
        <p style="margin: 0; color: #6b7280;">
          Need help getting started? Check our <a href="${this.appUrl}/docs" style="color: #667eea;">documentation</a>
          or contact our support team at <a href="mailto:support@boxcostpro.com" style="color: #667eea;">support@boxcostpro.com</a>
        </p>
      </div>

      <div class="footer">
        <p>
          <strong>BoxCostPro</strong> - Your Digital Sales Representative<br>
          Not just a costing tool, but a complete solution for corrugated box manufacturers.
        </p>
        <p style="font-size: 12px; color: #9ca3af;">
          This is an automated email. Please do not reply directly to this message.
        </p>
      </div>
    </div>
  </div>
</body>
</html>
    `;

    return this.sendEmail({
      to: userData.email,
      subject: '🎉 Your BoxCostPro Account is Approved!',
      html,
    });
  }

  /**
   * Send rejection email to user
   */
  async sendRejectionEmail(userData: UserData, reason: string): Promise<boolean> {
    const fullName = [userData.firstName, userData.lastName].filter(Boolean).join(' ') || 'User';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 28px; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .card { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .warning-icon { font-size: 48px; text-align: center; margin: 20px 0; }
    .reason-box { background: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; border-radius: 4px; margin: 20px 0; }
    .reason-box p { margin: 0; color: #991b1b; }
    .steps { list-style: decimal; padding-left: 20px; color: #374151; }
    .steps li { padding: 6px 0; }
    .button { display: inline-block; background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
    .button:hover { background: #5568d3; }
    .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚠️ Action Required</h1>
    </div>
    <div class="content">
      <div class="card">
        <div class="warning-icon">📋</div>
        <p style="font-size: 18px; font-weight: 600; text-align: center; color: #ef4444;">
          Account Verification Needs Attention
        </p>
        <p style="text-align: center; color: #6b7280;">
          Hi ${fullName}, your BoxCostPro account verification requires some updates.
        </p>
      </div>

      <div class="card">
        <h2 style="color: #ef4444; margin-top: 0;">Reason for Review:</h2>
        <div class="reason-box">
          <p><strong>${reason}</strong></p>
        </div>
      </div>

      <div class="card">
        <h3 style="color: #667eea; margin-top: 0;">What to Do Next:</h3>
        <ol class="steps">
          <li>Log in to your BoxCostPro account</li>
          <li>Review the reason mentioned above carefully</li>
          <li>Navigate to your onboarding page</li>
          <li>Fix the issues in your profile or settings</li>
          <li>Resubmit your profile for verification</li>
        </ol>
      </div>

      <div style="text-align: center;">
        <a href="${this.appUrl}/onboarding" class="button">
          Fix Issues & Resubmit →
        </a>
      </div>

      <div class="card" style="background: #dbeafe; border-left: 4px solid #3b82f6;">
        <h3 style="margin-top: 0; color: #1e40af;">💡 Need Help?</h3>
        <p style="margin: 0; color: #1e3a8a;">
          If you have questions about the reason for rejection or need assistance fixing the issues,
          please contact our support team:
        </p>
        <p style="margin: 10px 0 0 0;">
          📧 Email: <a href="mailto:support@boxcostpro.com" style="color: #3b82f6; text-decoration: none;">support@boxcostpro.com</a><br>
          📱 WhatsApp: <a href="https://wa.me/919876543210" style="color: #3b82f6; text-decoration: none;">+91 98765 43210</a>
        </p>
      </div>

      <div class="footer">
        <p>
          <strong>BoxCostPro</strong> - Your Digital Sales Representative
        </p>
        <p style="font-size: 12px; color: #9ca3af;">
          This is an automated email. For support, please use the contact details above.
        </p>
      </div>
    </div>
  </div>
</body>
</html>
    `;

    return this.sendEmail({
      to: userData.email,
      subject: '⚠️ Action Required: BoxCostPro Account Verification',
      html,
    });
  }

  /**
   * Send welcome email to new user
   */
  async sendWelcomeEmail(userData: UserData): Promise<boolean> {
    const fullName = [userData.firstName, userData.lastName].filter(Boolean).join(' ') || 'User';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 28px; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .card { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .button { display: inline-block; background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
    .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>👋 Welcome to BoxCostPro!</h1>
    </div>
    <div class="content">
      <div class="card">
        <p style="font-size: 18px; font-weight: 600;">Hi ${fullName},</p>
        <p>Welcome to BoxCostPro! We're excited to have you on board.</p>
        <p>To get started, please complete your onboarding by setting up your business profile, paper pricing, and other essential settings.</p>
        <div style="text-align: center;">
          <a href="${this.appUrl}/onboarding" class="button">
            Complete Onboarding →
          </a>
        </div>
      </div>
      <div class="footer">
        <p><strong>BoxCostPro</strong> - Your Digital Sales Representative</p>
      </div>
    </div>
  </div>
</body>
</html>
    `;

    return this.sendEmail({
      to: userData.email,
      subject: '👋 Welcome to BoxCostPro - Complete Your Setup',
      html,
    });
  }

  /**
   * Strip HTML tags for plain text version
   */
  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }
}

// Export singleton instance
export const emailService = new EmailService();
