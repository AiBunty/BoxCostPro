/**
 * Signup Email Service
 *
 * Handles email delivery for signup flow:
 * - Welcome email with Clerk magic link
 * - Invoice email with PDF attachment
 */

import { getWelcomeEmailHTML, getWelcomeEmailText, type WelcomeEmailParams } from './emailTemplates/welcomeEmail';
import { getInvoiceEmailHTML, getInvoiceEmailText, type InvoiceEmailParams } from './emailTemplates/invoiceEmail';
import type { IStorage } from '../storage';
import { sendEmail } from './emailService';
import fs from 'fs';

/**
 * Send welcome email with Clerk magic link
 *
 * @param email - Recipient email address
 * @param params - Welcome email parameters
 */
export async function sendWelcomeEmail(
  email: string,
  params: WelcomeEmailParams
): Promise<void> {
  const html = getWelcomeEmailHTML(params);
  const text = getWelcomeEmailText(params);

  await sendEmail({
    to: email,
    subject: 'Welcome to BoxCostPro - Your Account is Ready!',
    html,
    text,
  });

  console.log(`✅ Welcome email sent to ${email}`);
}

/**
 * Send invoice email with PDF attachment
 *
 * @param storage - Storage instance for database queries
 * @param email - Recipient email address
 * @param invoiceId - Invoice ID to send
 */
export async function sendInvoiceEmail(
  storage: IStorage,
  email: string,
  invoiceId: string
): Promise<void> {
  // Fetch invoice data
  const invoice = await storage.getInvoice(invoiceId);
  if (!invoice) {
    throw new Error(`Invoice not found: ${invoiceId}`);
  }

  // Get user details for first name
  const user = await storage.getUserById(invoice.userId);
  if (!user) {
    throw new Error(`User not found: ${invoice.userId}`);
  }

  // Prepare email content
  const params: InvoiceEmailParams = {
    firstName: user.firstName,
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: new Date(invoice.invoiceDate).toLocaleDateString('en-IN'),
    amount: invoice.grandTotal,
    planName: invoice.planName,
  };

  const html = getInvoiceEmailHTML(params);
  const text = getInvoiceEmailText(params);

  // Read PDF file
  if (!invoice.pdfUrl) {
    throw new Error(`Invoice PDF not generated: ${invoiceId}`);
  }

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = fs.readFileSync(invoice.pdfUrl);
  } catch (error) {
    console.error('Failed to read invoice PDF:', error);
    throw new Error(`Failed to read invoice PDF: ${invoice.pdfUrl}`);
  }

  // Send email with PDF attachment using nodemailer directly
  // Note: The sendEmail wrapper doesn't support attachments, so we'll use nodemailer's transporter
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const senderEmail = process.env.EMAIL_FROM || process.env.SMTP_USER || 'noreply@boxcostpro.com';

  await transporter.sendMail({
    from: `"BoxCostPro" <${senderEmail}>`,
    to: email,
    subject: `Your GST Invoice - ${invoice.invoiceNumber}`,
    html,
    text,
    attachments: [
      {
        filename: `${invoice.invoiceNumber.replace(/\//g, '_')}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });

  // Update invoice email status
  await storage.updateInvoice(invoiceId, {
    emailSent: true,
    emailSentAt: new Date(),
  });

  console.log(`✅ Invoice email sent to ${email} (Invoice: ${invoice.invoiceNumber})`);
}

/**
 * Send test welcome email (for debugging)
 *
 * @param email - Test email address
 */
export async function sendTestWelcomeEmail(email: string): Promise<void> {
  const testParams: WelcomeEmailParams = {
    firstName: 'Test User',
    email: email,
    loginLink: 'https://example.com/magic-link-test',
    planName: 'Pro Plan',
  };

  await sendWelcomeEmail(email, testParams);
}

/**
 * Validate email address format
 *
 * @param email - Email address to validate
 * @returns True if valid email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
