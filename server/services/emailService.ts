/**
 * Email Sending Service
 * SMTP + AWS SES Ready
 * Centralized email service for BoxCostPro
 */

import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

/**
 * Send email via configured SMTP/SES
 * Failures are logged but do not block the main flow
 */
export async function sendEmail({ to, subject, html, text, replyTo }: SendEmailParams): Promise<{ success: boolean; error?: string }> {
  // Check if SMTP is configured
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('EMAIL_NOT_CONFIGURED: SMTP credentials not set');
    return { success: false, error: 'Email service not configured' };
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
    console.log('EMAIL_SENT_SUCCESS:', { messageId: info.messageId, to, subject });
    return { success: true };
  } catch (err) {
    console.error('EMAIL_SEND_FAILED:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Verify SMTP connection
 */
export async function verifyEmailConnection(): Promise<boolean> {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return false;
  }

  try {
    await transporter.verify();
    console.log('EMAIL_CONNECTION_VERIFIED');
    return true;
  } catch (err) {
    console.error('EMAIL_CONNECTION_FAILED:', err);
    return false;
  }
}

/**
 * Check if email service is configured
 */
export function isEmailConfigured(): boolean {
  return !!(process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_HOST);
}
