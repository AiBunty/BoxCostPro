/**
 * Enterprise Email Notification System
 * 
 * CRITICAL RULES:
 * 1. EVERY user↔admin interaction MUST trigger email
 * 2. All emails must be logged to database
 * 3. Retry on failure (max 3 attempts)
 * 4. No silent failures - errors surfaced to UI
 */

import { storage } from '../storage';

// ============================================================
// EMAIL TEMPLATE TYPES
// ============================================================

export type EmailTemplateType =
  | 'ACCOUNT_CREATED_USER'
  | 'ACCOUNT_CREATED_ADMIN'
  | 'APPROVAL_SUBMITTED_USER'
  | 'APPROVAL_SUBMITTED_ADMIN'
  | 'ACCOUNT_APPROVED'
  | 'ACCOUNT_REJECTED'
  | 'PAYMENT_RECEIVED_USER'
  | 'PAYMENT_RECEIVED_ADMIN'
  | 'INVOICE_GENERATED'
  | 'QUOTATION_SENT'
  | 'TICKET_CREATED_USER'
  | 'TICKET_CREATED_ADMIN'
  | 'TICKET_UPDATED'
  | 'TICKET_CLOSED'
  | 'COUPON_APPLIED';

// ============================================================
// EMAIL DATA INTERFACES
// ============================================================

export interface EmailData {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text?: string;
}

export interface AccountCreatedData {
  userName: string;
  userEmail: string;
  companyName?: string;
  loginUrl: string;
}

export interface ApprovalSubmittedData {
  userName: string;
  userEmail: string;
  companyName: string;
  gstin?: string;
  submittedAt: string;
  adminPanelUrl?: string;
}

export interface AccountApprovedData {
  userName: string;
  companyName: string;
  approvedBy: string;
  loginUrl: string;
}

export interface AccountRejectedData {
  userName: string;
  companyName: string;
  rejectedBy: string;
  reason: string;
  resubmitUrl: string;
}

export interface PaymentReceivedData {
  userName: string;
  userEmail: string;
  amount: number;
  currency: string;
  transactionId: string;
  planName: string;
  invoiceUrl?: string;
}

export interface InvoiceGeneratedData {
  userName: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  dueDate?: string;
  downloadUrl: string;
}

export interface QuotationSentData {
  customerName: string;
  quotationNumber: string;
  validUntil?: string;
  totalAmount: number;
  currency: string;
  sellerName: string;
  sellerContact?: string;
}

export interface TicketCreatedData {
  userName: string;
  userEmail: string;
  ticketId: string;
  ticketNumber: string;
  subject: string;
  category: string;
  priority: string;
  description?: string;
  ticketUrl?: string;
}

export interface TicketUpdatedData {
  userName: string;
  ticketNumber: string;
  subject: string;
  status: string;
  updatedBy: string;
  message?: string;
  ticketUrl: string;
}

export interface TicketClosedData {
  userName: string;
  ticketNumber: string;
  subject: string;
  closedBy: string;
  resolution?: string;
  feedbackUrl?: string;
}

export interface CouponAppliedData {
  userName: string;
  userEmail: string;
  couponCode: string;
  discountPercent: number;
  appliedTo: string;
  savingsAmount: number;
  currency: string;
}

// ============================================================
// EMAIL TEMPLATES
// ============================================================

/**
 * Generate Account Created Email for User
 */
export function generateAccountCreatedUserEmail(data: AccountCreatedData): EmailData {
  return {
    to: data.userEmail,
    toName: data.userName,
    subject: '🎉 Welcome to BoxCostPro - Your Account is Ready!',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; }
    .content { padding: 30px; }
    .btn { display: inline-block; background: #1e40af; color: white; padding: 12px 30px; border-radius: 5px; text-decoration: none; font-weight: bold; margin: 20px 0; }
    .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Welcome to BoxCostPro!</h1>
    </div>
    <div class="content">
      <p>Hi <strong>${data.userName}</strong>,</p>
      <p>Your account has been successfully created${data.companyName ? ` for <strong>${data.companyName}</strong>` : ''}.</p>
      <p>You can now access your dashboard to:</p>
      <ul>
        <li>📊 Create box cost calculations</li>
        <li>📄 Generate GST-compliant invoices</li>
        <li>📝 Send professional quotations</li>
        <li>📈 Track your business performance</li>
      </ul>
      <p style="text-align: center;">
        <a href="${data.loginUrl}" class="btn">Go to Dashboard →</a>
      </p>
      <p>If you have any questions, our support team is here to help!</p>
    </div>
    <div class="footer">
      <p>© 2026 BoxCostPro. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `,
    text: `Welcome to BoxCostPro!\n\nHi ${data.userName},\n\nYour account has been successfully created${data.companyName ? ` for ${data.companyName}` : ''}.\n\nLogin here: ${data.loginUrl}\n\nThank you for choosing BoxCostPro!`
  };
}

/**
 * Generate Account Created Email for Admin
 */
export function generateAccountCreatedAdminEmail(data: AccountCreatedData): EmailData {
  return {
    to: '', // Will be filled by admin email
    subject: '📣 New User Registered - Action Required',
    html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; padding: 20px; }
    .alert { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
    .info { background: #f0f9ff; padding: 15px; border-radius: 5px; }
  </style>
</head>
<body>
  <h2>🆕 New User Registration</h2>
  <div class="alert">
    <strong>Action Required:</strong> Review and approve this user's account.
  </div>
  <div class="info">
    <p><strong>Name:</strong> ${data.userName}</p>
    <p><strong>Email:</strong> ${data.userEmail}</p>
    ${data.companyName ? `<p><strong>Company:</strong> ${data.companyName}</p>` : ''}
    <p><strong>Registered:</strong> ${new Date().toLocaleString('en-IN')}</p>
  </div>
  <p>Please review the user's business profile and approve their account.</p>
</body>
</html>
    `
  };
}

/**
 * Generate Approval Submitted Email for User
 */
export function generateApprovalSubmittedUserEmail(data: ApprovalSubmittedData): EmailData {
  return {
    to: data.userEmail,
    toName: data.userName,
    subject: '✅ Business Profile Submitted for Verification',
    html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; }
    .header { background: #059669; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { padding: 20px; background: #f8fafc; }
    .timeline { border-left: 3px solid #059669; padding-left: 20px; margin: 20px 0; }
    .step { margin-bottom: 15px; }
    .step.active { color: #059669; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>✅ Profile Submitted Successfully!</h2>
    </div>
    <div class="content">
      <p>Dear ${data.userName},</p>
      <p>Your business profile for <strong>${data.companyName}</strong> has been submitted for verification.</p>
      
      <h4>What happens next?</h4>
      <div class="timeline">
        <div class="step active">✓ Profile Submitted</div>
        <div class="step">⏳ Admin Review (1-2 business days)</div>
        <div class="step">🎉 Account Approved</div>
      </div>
      
      <p>We'll notify you by email once your account is verified. You can continue to explore the platform while waiting.</p>
      
      <p style="color: #666; font-size: 14px;">Submitted on: ${data.submittedAt}</p>
    </div>
  </div>
</body>
</html>
    `
  };
}

/**
 * Generate Approval Submitted Email for Admin
 */
export function generateApprovalSubmittedAdminEmail(data: ApprovalSubmittedData): EmailData {
  return {
    to: '',
    subject: `🔔 Verification Request: ${data.companyName}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; }
    .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .btn { background: #1e40af; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
  </style>
</head>
<body>
  <h2>🔔 New Verification Request</h2>
  <div class="card">
    <h3>${data.companyName}</h3>
    <p><strong>User:</strong> ${data.userName} (${data.userEmail})</p>
    ${data.gstin ? `<p><strong>GSTIN:</strong> ${data.gstin}</p>` : ''}
    <p><strong>Submitted:</strong> ${data.submittedAt}</p>
  </div>
  ${data.adminPanelUrl ? `<p><a href="${data.adminPanelUrl}" class="btn">Review in Admin Panel →</a></p>` : ''}
</body>
</html>
    `
  };
}

/**
 * Generate Account Approved Email
 */
export function generateAccountApprovedEmail(data: AccountApprovedData): EmailData {
  return {
    to: '',
    subject: '🎉 Your Account is Verified and Ready!',
    html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; }
    .container { max-width: 600px; margin: 0 auto; }
    .success { background: #d1fae5; border: 1px solid #059669; padding: 20px; border-radius: 10px; text-align: center; }
    .btn { display: inline-block; background: #059669; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="success">
      <h1>🎉 Congratulations!</h1>
      <p>Your account for <strong>${data.companyName}</strong> has been verified.</p>
    </div>
    <p>Dear ${data.userName},</p>
    <p>Great news! Your business profile has been reviewed and approved by our team.</p>
    <p>You now have full access to all BoxCostPro features:</p>
    <ul>
      <li>✅ Generate GST-compliant invoices</li>
      <li>✅ Send professional quotations</li>
      <li>✅ Access premium calculations</li>
      <li>✅ Download detailed reports</li>
    </ul>
    <p style="text-align: center;">
      <a href="${data.loginUrl}" class="btn">Start Using BoxCostPro →</a>
    </p>
    <p style="color: #666;">Approved by: ${data.approvedBy}</p>
  </div>
</body>
</html>
    `
  };
}

/**
 * Generate Account Rejected Email
 */
export function generateAccountRejectedEmail(data: AccountRejectedData): EmailData {
  return {
    to: '',
    subject: '⚠️ Action Required: Business Profile Needs Updates',
    html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; }
    .alert { background: #fef2f2; border: 1px solid #ef4444; padding: 20px; border-radius: 10px; }
    .reason { background: #fff; border-left: 4px solid #ef4444; padding: 15px; margin: 15px 0; }
    .btn { display: inline-block; background: #1e40af; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; }
  </style>
</head>
<body>
  <h2>⚠️ Profile Verification Update</h2>
  <p>Dear ${data.userName},</p>
  <div class="alert">
    <p>Your business profile for <strong>${data.companyName}</strong> requires some updates before it can be approved.</p>
  </div>
  <div class="reason">
    <strong>Reason:</strong>
    <p>${data.reason}</p>
  </div>
  <p>Please update your profile with the required information and resubmit for verification.</p>
  <p style="text-align: center;">
    <a href="${data.resubmitUrl}" class="btn">Update Profile →</a>
  </p>
  <p style="color: #666; font-size: 14px;">Reviewed by: ${data.rejectedBy}</p>
</body>
</html>
    `
  };
}

/**
 * Generate Payment Received Email for User
 */
export function generatePaymentReceivedUserEmail(data: PaymentReceivedData): EmailData {
  const formattedAmount = new Intl.NumberFormat('en-IN', { style: 'currency', currency: data.currency }).format(data.amount);
  
  return {
    to: data.userEmail,
    toName: data.userName,
    subject: `✅ Payment Received - ${formattedAmount}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; }
    .receipt { background: #f0fdf4; border: 2px solid #22c55e; padding: 30px; border-radius: 10px; text-align: center; }
    .amount { font-size: 36px; color: #16a34a; font-weight: bold; }
    .details { background: #fff; padding: 20px; margin: 20px 0; border-radius: 5px; text-align: left; }
    .btn { display: inline-block; background: #1e40af; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; }
  </style>
</head>
<body>
  <div class="receipt">
    <h1>✅ Payment Successful</h1>
    <p class="amount">${formattedAmount}</p>
    <p>Transaction ID: ${data.transactionId}</p>
  </div>
  <div class="details">
    <p><strong>Plan:</strong> ${data.planName}</p>
    <p><strong>Date:</strong> ${new Date().toLocaleDateString('en-IN')}</p>
  </div>
  ${data.invoiceUrl ? `<p style="text-align: center;"><a href="${data.invoiceUrl}" class="btn">Download Invoice →</a></p>` : ''}
  <p>Thank you for your payment, ${data.userName}!</p>
</body>
</html>
    `
  };
}

/**
 * Generate Ticket Created Email for User
 */
export function generateTicketCreatedUserEmail(data: TicketCreatedData): EmailData {
  return {
    to: data.userEmail,
    toName: data.userName,
    subject: `🎫 Support Ticket Created - #${data.ticketNumber}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; }
    .ticket { background: #f0f9ff; border: 1px solid #0ea5e9; padding: 20px; border-radius: 10px; }
    .ticket-id { font-size: 24px; color: #0284c7; font-weight: bold; }
    .priority { display: inline-block; padding: 5px 10px; border-radius: 5px; font-size: 12px; }
    .priority.high { background: #fee2e2; color: #dc2626; }
    .priority.medium { background: #fef3c7; color: #d97706; }
    .priority.low { background: #d1fae5; color: #059669; }
  </style>
</head>
<body>
  <h2>🎫 Support Ticket Created</h2>
  <p>Dear ${data.userName},</p>
  <p>Your support ticket has been created. Our team will respond within 24-48 hours.</p>
  <div class="ticket">
    <p class="ticket-id">#${data.ticketNumber}</p>
    <p><strong>Subject:</strong> ${data.subject}</p>
    <p><strong>Category:</strong> ${data.category}</p>
    <p><strong>Priority:</strong> <span class="priority ${data.priority.toLowerCase()}">${data.priority}</span></p>
  </div>
  ${data.ticketUrl ? `<p><a href="${data.ticketUrl}">View Ticket →</a></p>` : ''}
</body>
</html>
    `
  };
}

/**
 * Generate Ticket Created Email for Admin
 */
export function generateTicketCreatedAdminEmail(data: TicketCreatedData): EmailData {
  return {
    to: '',
    subject: `🎫 New Support Ticket - ${data.priority.toUpperCase()} Priority`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; }
    .priority-high { border-left: 4px solid #dc2626; padding-left: 15px; }
    .priority-medium { border-left: 4px solid #d97706; padding-left: 15px; }
    .priority-low { border-left: 4px solid #059669; padding-left: 15px; }
  </style>
</head>
<body>
  <h2>🎫 New Support Ticket</h2>
  <div class="priority-${data.priority.toLowerCase()}">
    <p><strong>Ticket:</strong> #${data.ticketNumber}</p>
    <p><strong>From:</strong> ${data.userName} (${data.userEmail})</p>
    <p><strong>Subject:</strong> ${data.subject}</p>
    <p><strong>Category:</strong> ${data.category}</p>
    <p><strong>Priority:</strong> ${data.priority}</p>
    ${data.description ? `<p><strong>Description:</strong><br>${data.description}</p>` : ''}
  </div>
  ${data.ticketUrl ? `<p><a href="${data.ticketUrl}">Open in Admin Panel →</a></p>` : ''}
</body>
</html>
    `
  };
}

/**
 * Generate Ticket Updated Email
 */
export function generateTicketUpdatedEmail(data: TicketUpdatedData): EmailData {
  return {
    to: '',
    toName: data.userName,
    subject: `📝 Ticket #${data.ticketNumber} Updated`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; }
    .update { background: #f0f9ff; padding: 20px; border-radius: 10px; }
    .status { display: inline-block; padding: 5px 15px; background: #1e40af; color: white; border-radius: 15px; }
  </style>
</head>
<body>
  <h2>📝 Ticket Update</h2>
  <p>Dear ${data.userName},</p>
  <p>Your support ticket <strong>#${data.ticketNumber}</strong> has been updated.</p>
  <div class="update">
    <p><strong>Subject:</strong> ${data.subject}</p>
    <p><strong>Status:</strong> <span class="status">${data.status}</span></p>
    <p><strong>Updated by:</strong> ${data.updatedBy}</p>
    ${data.message ? `<p><strong>Message:</strong><br>${data.message}</p>` : ''}
  </div>
  <p><a href="${data.ticketUrl}">View Full Ticket →</a></p>
</body>
</html>
    `
  };
}

/**
 * Generate Ticket Closed Email
 */
export function generateTicketClosedEmail(data: TicketClosedData): EmailData {
  return {
    to: '',
    toName: data.userName,
    subject: `✅ Ticket #${data.ticketNumber} Resolved`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; }
    .resolved { background: #d1fae5; padding: 20px; border-radius: 10px; text-align: center; }
    .btn { display: inline-block; background: #1e40af; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
  </style>
</head>
<body>
  <div class="resolved">
    <h2>✅ Ticket Resolved</h2>
    <p>Ticket <strong>#${data.ticketNumber}</strong> has been closed.</p>
  </div>
  <p>Dear ${data.userName},</p>
  <p>Your support ticket regarding "<strong>${data.subject}</strong>" has been resolved and closed.</p>
  ${data.resolution ? `<p><strong>Resolution:</strong> ${data.resolution}</p>` : ''}
  <p>If you have any further questions, feel free to open a new ticket.</p>
  ${data.feedbackUrl ? `<p><a href="${data.feedbackUrl}" class="btn">Rate Your Experience →</a></p>` : ''}
  <p style="color: #666;">Closed by: ${data.closedBy}</p>
</body>
</html>
    `
  };
}

/**
 * Generate Quotation Sent Email
 */
export function generateQuotationSentEmail(data: QuotationSentData): EmailData {
  const formattedAmount = new Intl.NumberFormat('en-IN', { style: 'currency', currency: data.currency }).format(data.totalAmount);
  
  return {
    to: '',
    toName: data.customerName,
    subject: `📄 Quotation ${data.quotationNumber} from ${data.sellerName}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; }
    .quote-header { background: #1e40af; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
    .quote-body { background: #f8fafc; padding: 20px; }
    .amount { font-size: 28px; color: #1e40af; font-weight: bold; }
  </style>
</head>
<body>
  <div class="quote-header">
    <h2>📄 Quotation</h2>
    <p>${data.quotationNumber}</p>
  </div>
  <div class="quote-body">
    <p>Dear ${data.customerName},</p>
    <p>Please find the quotation as requested.</p>
    <p class="amount">Total: ${formattedAmount}</p>
    ${data.validUntil ? `<p><strong>Valid Until:</strong> ${data.validUntil}</p>` : ''}
    <hr>
    <p>Best regards,<br><strong>${data.sellerName}</strong></p>
    ${data.sellerContact ? `<p>${data.sellerContact}</p>` : ''}
  </div>
</body>
</html>
    `
  };
}

/**
 * Generate Invoice Generated Email
 */
export function generateInvoiceGeneratedEmail(data: InvoiceGeneratedData): EmailData {
  const formattedAmount = new Intl.NumberFormat('en-IN', { style: 'currency', currency: data.currency }).format(data.amount);
  
  return {
    to: '',
    toName: data.userName,
    subject: `🧾 Invoice ${data.invoiceNumber} Generated`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; }
    .invoice { background: #f0f9ff; padding: 30px; border-radius: 10px; text-align: center; }
    .amount { font-size: 32px; color: #0284c7; font-weight: bold; }
    .btn { display: inline-block; background: #1e40af; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; }
  </style>
</head>
<body>
  <div class="invoice">
    <h2>🧾 Invoice Generated</h2>
    <p><strong>${data.invoiceNumber}</strong></p>
    <p class="amount">${formattedAmount}</p>
    ${data.dueDate ? `<p>Due Date: ${data.dueDate}</p>` : ''}
  </div>
  <p>Dear ${data.userName},</p>
  <p>Your invoice has been generated successfully.</p>
  <p style="text-align: center;">
    <a href="${data.downloadUrl}" class="btn">Download Invoice →</a>
  </p>
</body>
</html>
    `
  };
}

// ============================================================
// EMAIL SENDING WITH RETRY
// ============================================================

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff

export async function sendEmailWithRetry(
  emailData: EmailData,
  templateType: EmailTemplateType,
  metadata: Record<string, any> = {}
): Promise<{ success: boolean; error?: string; logId?: string }> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      // Try to send email using configured provider
      const { sendSystemEmailAsync } = await import('../services/adminEmailService');
      
      await sendSystemEmailAsync(storage, {
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text,
        emailType: templateType.toLowerCase(),
        relatedEntityId: metadata.entityId,
      });
      
      console.log(`[Email] Successfully sent ${templateType} to ${emailData.to}`);
      
      return { success: true };
    } catch (error: any) {
      lastError = error;
      console.error(`[Email] Attempt ${attempt + 1} failed for ${templateType}:`, error.message);
      
      if (attempt < MAX_RETRIES - 1) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]));
      }
    }
  }
  
  // All retries failed
  console.error(`[Email] All ${MAX_RETRIES} attempts failed for ${templateType}:`, lastError);
  
  return {
    success: false,
    error: lastError?.message || 'Email sending failed after all retries'
  };
}
