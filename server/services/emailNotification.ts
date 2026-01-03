/**
 * Email Notification Service
 * Handles sending all system emails with templating, retry logic, and logging
 * Mandatory emails for EVERY user↔admin interaction
 */

import { randomUUID } from 'crypto';

// Email types matching the seeded templates
export type EmailTemplateType = 
  | 'welcome'
  | 'email_verification'
  | 'password_reset'
  | 'quotation_sent'
  | 'invoice_sent'
  | 'payment_received'
  | 'order_confirmed'
  | 'order_shipped'
  | 'support_ticket_created'
  | 'support_ticket_reply'
  | 'support_ticket_closed'
  | 'approval_request'
  | 'approval_granted'
  | 'approval_rejected'
  | 'subscription_renewal'
  | 'usage_warning'
  | 'system_notification';

export interface EmailRecipient {
  email: string;
  name?: string;
  type: 'to' | 'cc' | 'bcc';
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
  path?: string;
}

export interface EmailSendRequest {
  template_type: EmailTemplateType;
  recipients: EmailRecipient[];
  subject_variables?: Record<string, string>;
  body_variables: Record<string, any>;
  attachments?: EmailAttachment[];
  tenant_id: string;
  reference_type?: string;
  reference_id?: string;
  priority?: 'high' | 'normal' | 'low';
  scheduled_at?: Date;
}

export interface EmailSendResult {
  success: boolean;
  email_id: string;
  message_id?: string;
  sent_at?: Date;
  error?: string;
  retry_count: number;
  provider_used?: string;
}

export interface EmailLog {
  id: string;
  tenant_id: string;
  template_type: EmailTemplateType;
  recipient_emails: string[];
  subject: string;
  status: 'pending' | 'sent' | 'failed' | 'bounced';
  message_id?: string;
  provider_used?: string;
  retry_count: number;
  error_message?: string;
  reference_type?: string;
  reference_id?: string;
  created_at: Date;
  sent_at?: Date;
}

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff

/**
 * Get email template from database
 */
async function getEmailTemplate(
  templateType: EmailTemplateType,
  db: any
): Promise<{ subject_template: string; html_content: string; text_content: string } | null> {
  const result = await db.query(`
    SELECT subject_template, html_content, text_content
    FROM email_templates
    WHERE template_type = $1 AND is_active = true
    ORDER BY version DESC
    LIMIT 1
  `, [templateType]);
  
  return result.rows[0] || null;
}

/**
 * Replace template placeholders with actual values
 */
function renderTemplate(template: string, variables: Record<string, any>): string {
  let rendered = template;
  
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    rendered = rendered.replace(regex, String(value ?? ''));
  }
  
  // Handle conditionals: {{#if variable}}content{{/if}}
  const conditionalRegex = /{{#if\s+(\w+)\s*}}([\s\S]*?){{\/if}}/g;
  rendered = rendered.replace(conditionalRegex, (_, varName, content) => {
    return variables[varName] ? content : '';
  });
  
  // Handle loops: {{#each items}}{{this.name}}{{/each}}
  const loopRegex = /{{#each\s+(\w+)\s*}}([\s\S]*?){{\/each}}/g;
  rendered = rendered.replace(loopRegex, (_, arrayName, itemTemplate) => {
    const items = variables[arrayName];
    if (!Array.isArray(items)) return '';
    
    return items.map((item, index) => {
      let itemRendered = itemTemplate;
      for (const [key, value] of Object.entries(item)) {
        const itemRegex = new RegExp(`{{this\\.${key}}}`, 'g');
        itemRendered = itemRendered.replace(itemRegex, String(value ?? ''));
      }
      itemRendered = itemRendered.replace(/{{@index}}/g, String(index));
      return itemRendered;
    }).join('');
  });
  
  return rendered;
}

/**
 * Send email using configured provider
 */
async function sendEmailViaProvider(
  to: string[],
  cc: string[],
  bcc: string[],
  subject: string,
  htmlBody: string,
  textBody: string,
  attachments: EmailAttachment[],
  providerConfig: any
): Promise<{ success: boolean; messageId?: string; provider: string; error?: string }> {
  // Try primary provider first, then fallback
  const providers = ['smtp', 'sendgrid', 'mailgun', 'ses'];
  
  for (const provider of providers) {
    try {
      switch (provider) {
        case 'smtp':
          return await sendViaSMTP(to, cc, bcc, subject, htmlBody, textBody, attachments, providerConfig.smtp);
        case 'sendgrid':
          if (providerConfig.sendgrid?.apiKey) {
            return await sendViaSendGrid(to, cc, bcc, subject, htmlBody, textBody, attachments, providerConfig.sendgrid);
          }
          break;
        case 'mailgun':
          if (providerConfig.mailgun?.apiKey) {
            return await sendViaMailgun(to, cc, bcc, subject, htmlBody, textBody, attachments, providerConfig.mailgun);
          }
          break;
        case 'ses':
          if (providerConfig.ses?.accessKeyId) {
            return await sendViaSES(to, cc, bcc, subject, htmlBody, textBody, attachments, providerConfig.ses);
          }
          break;
      }
    } catch (error) {
      console.error(`Email send failed with ${provider}:`, error);
      continue;
    }
  }
  
  return { success: false, provider: 'none', error: 'All email providers failed' };
}

/**
 * Send via SMTP
 */
async function sendViaSMTP(
  to: string[],
  cc: string[],
  bcc: string[],
  subject: string,
  htmlBody: string,
  textBody: string,
  attachments: EmailAttachment[],
  config: any
): Promise<{ success: boolean; messageId?: string; provider: string; error?: string }> {
  const nodemailer = await import('nodemailer');
  
  const transporter = nodemailer.createTransport({
    host: config.host || process.env.SMTP_HOST,
    port: parseInt(config.port || process.env.SMTP_PORT || '587'),
    secure: config.secure ?? (process.env.SMTP_SECURE === 'true'),
    auth: {
      user: config.user || process.env.SMTP_USER,
      pass: config.pass || process.env.SMTP_PASS
    }
  });
  
  const mailOptions: any = {
    from: config.from || process.env.SMTP_FROM || 'noreply@boxcostpro.com',
    to: to.join(', '),
    subject,
    html: htmlBody,
    text: textBody
  };
  
  if (cc.length > 0) mailOptions.cc = cc.join(', ');
  if (bcc.length > 0) mailOptions.bcc = bcc.join(', ');
  
  if (attachments.length > 0) {
    mailOptions.attachments = attachments.map(att => ({
      filename: att.filename,
      content: att.content,
      contentType: att.contentType,
      path: att.path
    }));
  }
  
  const info = await transporter.sendMail(mailOptions);
  
  return {
    success: true,
    messageId: info.messageId,
    provider: 'smtp'
  };
}

/**
 * Send via SendGrid
 */
async function sendViaSendGrid(
  to: string[],
  cc: string[],
  bcc: string[],
  subject: string,
  htmlBody: string,
  textBody: string,
  attachments: EmailAttachment[],
  config: any
): Promise<{ success: boolean; messageId?: string; provider: string; error?: string }> {
  const sgMail = await import('@sendgrid/mail');
  sgMail.default.setApiKey(config.apiKey);
  
  const msg: any = {
    to,
    from: config.from || 'noreply@boxcostpro.com',
    subject,
    html: htmlBody,
    text: textBody
  };
  
  if (cc.length > 0) msg.cc = cc;
  if (bcc.length > 0) msg.bcc = bcc;
  
  if (attachments.length > 0) {
    msg.attachments = attachments.map(att => ({
      filename: att.filename,
      content: Buffer.isBuffer(att.content) ? att.content.toString('base64') : att.content,
      type: att.contentType,
      disposition: 'attachment'
    }));
  }
  
  const [response] = await sgMail.default.send(msg);
  
  return {
    success: response.statusCode >= 200 && response.statusCode < 300,
    messageId: response.headers['x-message-id'],
    provider: 'sendgrid'
  };
}

/**
 * Send via Mailgun
 */
async function sendViaMailgun(
  to: string[],
  cc: string[],
  bcc: string[],
  subject: string,
  htmlBody: string,
  textBody: string,
  attachments: EmailAttachment[],
  config: any
): Promise<{ success: boolean; messageId?: string; provider: string; error?: string }> {
  const formData = await import('form-data');
  const Mailgun = await import('mailgun.js');
  
  const mailgun = new Mailgun.default(formData.default);
  const mg = mailgun.client({ username: 'api', key: config.apiKey });
  
  const data: any = {
    from: config.from || 'noreply@boxcostpro.com',
    to: to.join(', '),
    subject,
    html: htmlBody,
    text: textBody
  };
  
  if (cc.length > 0) data.cc = cc.join(', ');
  if (bcc.length > 0) data.bcc = bcc.join(', ');
  
  const result = await mg.messages.create(config.domain, data);
  
  return {
    success: true,
    messageId: result.id,
    provider: 'mailgun'
  };
}

/**
 * Send via AWS SES
 */
async function sendViaSES(
  to: string[],
  cc: string[],
  bcc: string[],
  subject: string,
  htmlBody: string,
  textBody: string,
  attachments: EmailAttachment[],
  config: any
): Promise<{ success: boolean; messageId?: string; provider: string; error?: string }> {
  const { SESClient, SendEmailCommand } = await import('@aws-sdk/client-ses');
  
  const client = new SESClient({
    region: config.region || 'us-east-1',
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    }
  });
  
  const command = new SendEmailCommand({
    Source: config.from || 'noreply@boxcostpro.com',
    Destination: {
      ToAddresses: to,
      CcAddresses: cc.length > 0 ? cc : undefined,
      BccAddresses: bcc.length > 0 ? bcc : undefined
    },
    Message: {
      Subject: { Data: subject },
      Body: {
        Html: { Data: htmlBody },
        Text: { Data: textBody }
      }
    }
  });
  
  const response = await client.send(command);
  
  return {
    success: true,
    messageId: response.MessageId,
    provider: 'ses'
  };
}

/**
 * Sleep for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main email sending function with template rendering and retry
 */
export async function sendEmail(
  request: EmailSendRequest,
  db: any,
  providerConfig: any
): Promise<EmailSendResult> {
  const emailId = randomUUID();
  let retryCount = 0;
  
  try {
    // Get template
    const template = await getEmailTemplate(request.template_type, db);
    if (!template) {
      throw new Error(`Email template not found: ${request.template_type}`);
    }
    
    // Render subject and body
    const subject = renderTemplate(
      template.subject_template,
      { ...request.body_variables, ...request.subject_variables }
    );
    const htmlBody = renderTemplate(template.html_content, request.body_variables);
    const textBody = renderTemplate(template.text_content, request.body_variables);
    
    // Separate recipients by type
    const toRecipients = request.recipients.filter(r => r.type === 'to').map(r => r.email);
    const ccRecipients = request.recipients.filter(r => r.type === 'cc').map(r => r.email);
    const bccRecipients = request.recipients.filter(r => r.type === 'bcc').map(r => r.email);
    
    if (toRecipients.length === 0) {
      throw new Error('At least one TO recipient is required');
    }
    
    // Retry loop
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const result = await sendEmailViaProvider(
          toRecipients,
          ccRecipients,
          bccRecipients,
          subject,
          htmlBody,
          textBody,
          request.attachments || [],
          providerConfig
        );
        
        if (result.success) {
          // Log success
          await logEmailSend(db, {
            id: emailId,
            tenant_id: request.tenant_id,
            template_type: request.template_type,
            recipient_emails: toRecipients,
            subject,
            status: 'sent',
            message_id: result.messageId,
            provider_used: result.provider,
            retry_count: retryCount,
            reference_type: request.reference_type,
            reference_id: request.reference_id,
            created_at: new Date(),
            sent_at: new Date()
          });
          
          return {
            success: true,
            email_id: emailId,
            message_id: result.messageId,
            sent_at: new Date(),
            retry_count: retryCount,
            provider_used: result.provider
          };
        }
        
        throw new Error(result.error || 'Email send failed');
        
      } catch (error) {
        lastError = error as Error;
        retryCount++;
        
        console.error(`Email send attempt ${attempt + 1} failed:`, error);
        
        if (attempt < MAX_RETRIES - 1) {
          await sleep(RETRY_DELAYS[attempt]);
        }
      }
    }
    
    // All retries failed
    const errorMessage = lastError?.message || 'Unknown error';
    
    await logEmailSend(db, {
      id: emailId,
      tenant_id: request.tenant_id,
      template_type: request.template_type,
      recipient_emails: toRecipients,
      subject,
      status: 'failed',
      retry_count: retryCount,
      error_message: errorMessage,
      reference_type: request.reference_type,
      reference_id: request.reference_id,
      created_at: new Date()
    });
    
    return {
      success: false,
      email_id: emailId,
      error: errorMessage,
      retry_count: retryCount
    };
    
  } catch (error) {
    const errorMessage = (error as Error).message;
    
    return {
      success: false,
      email_id: emailId,
      error: errorMessage,
      retry_count: retryCount
    };
  }
}

/**
 * Log email send to database
 */
async function logEmailSend(db: any, log: EmailLog): Promise<void> {
  await db.query(`
    INSERT INTO system_audit_logs (
      id, action_type, entity_type, entity_id, 
      tenant_id, changes, created_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7
    )
  `, [
    randomUUID(),
    log.status === 'sent' ? 'email_sent' : 'email_failed',
    'email',
    log.id,
    log.tenant_id,
    JSON.stringify({
      template_type: log.template_type,
      recipients: log.recipient_emails,
      subject: log.subject,
      message_id: log.message_id,
      provider: log.provider_used,
      retry_count: log.retry_count,
      error: log.error_message
    }),
    log.created_at
  ]);
}

// ============================================
// Convenience functions for common email types
// ============================================

/**
 * Send welcome email to new user
 */
export async function sendWelcomeEmail(
  userEmail: string,
  userName: string,
  companyName: string,
  loginUrl: string,
  tenantId: string,
  db: any,
  providerConfig: any
): Promise<EmailSendResult> {
  return sendEmail({
    template_type: 'welcome',
    recipients: [{ email: userEmail, name: userName, type: 'to' }],
    body_variables: {
      user_name: userName,
      company_name: companyName,
      login_url: loginUrl,
      current_year: new Date().getFullYear()
    },
    tenant_id: tenantId,
    reference_type: 'user',
    priority: 'high'
  }, db, providerConfig);
}

/**
 * Send quotation email with PDF attachment
 */
export async function sendQuotationEmail(
  recipientEmail: string,
  recipientName: string,
  quotationNumber: string,
  quotationDate: string,
  totalAmount: string,
  validUntil: string,
  pdfBuffer: Buffer,
  tenantId: string,
  quotationId: string,
  senderCompany: string,
  db: any,
  providerConfig: any
): Promise<EmailSendResult> {
  return sendEmail({
    template_type: 'quotation_sent',
    recipients: [{ email: recipientEmail, name: recipientName, type: 'to' }],
    body_variables: {
      recipient_name: recipientName,
      quotation_number: quotationNumber,
      quotation_date: quotationDate,
      total_amount: totalAmount,
      valid_until: validUntil,
      company_name: senderCompany,
      current_year: new Date().getFullYear()
    },
    attachments: [{
      filename: `Quotation_${quotationNumber}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf'
    }],
    tenant_id: tenantId,
    reference_type: 'quotation',
    reference_id: quotationId,
    priority: 'high'
  }, db, providerConfig);
}

/**
 * Send invoice email with PDF attachment
 */
export async function sendInvoiceEmail(
  recipientEmail: string,
  recipientName: string,
  invoiceNumber: string,
  invoiceDate: string,
  dueDate: string,
  totalAmount: string,
  pdfBuffer: Buffer,
  tenantId: string,
  invoiceId: string,
  senderCompany: string,
  db: any,
  providerConfig: any
): Promise<EmailSendResult> {
  return sendEmail({
    template_type: 'invoice_sent',
    recipients: [{ email: recipientEmail, name: recipientName, type: 'to' }],
    body_variables: {
      recipient_name: recipientName,
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      due_date: dueDate,
      total_amount: totalAmount,
      company_name: senderCompany,
      current_year: new Date().getFullYear()
    },
    attachments: [{
      filename: `Invoice_${invoiceNumber}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf'
    }],
    tenant_id: tenantId,
    reference_type: 'invoice',
    reference_id: invoiceId,
    priority: 'high'
  }, db, providerConfig);
}

/**
 * Send support ticket created email
 */
export async function sendTicketCreatedEmail(
  userEmail: string,
  userName: string,
  ticketNumber: string,
  ticketSubject: string,
  ticketDescription: string,
  tenantId: string,
  ticketId: string,
  db: any,
  providerConfig: any
): Promise<EmailSendResult> {
  return sendEmail({
    template_type: 'support_ticket_created',
    recipients: [{ email: userEmail, name: userName, type: 'to' }],
    body_variables: {
      user_name: userName,
      ticket_number: ticketNumber,
      ticket_subject: ticketSubject,
      ticket_description: ticketDescription,
      current_year: new Date().getFullYear()
    },
    tenant_id: tenantId,
    reference_type: 'support_ticket',
    reference_id: ticketId,
    priority: 'normal'
  }, db, providerConfig);
}

/**
 * Send support ticket reply email
 */
export async function sendTicketReplyEmail(
  recipientEmail: string,
  recipientName: string,
  ticketNumber: string,
  ticketSubject: string,
  replyMessage: string,
  replierName: string,
  tenantId: string,
  ticketId: string,
  db: any,
  providerConfig: any
): Promise<EmailSendResult> {
  return sendEmail({
    template_type: 'support_ticket_reply',
    recipients: [{ email: recipientEmail, name: recipientName, type: 'to' }],
    body_variables: {
      recipient_name: recipientName,
      ticket_number: ticketNumber,
      ticket_subject: ticketSubject,
      reply_message: replyMessage,
      replier_name: replierName,
      current_year: new Date().getFullYear()
    },
    tenant_id: tenantId,
    reference_type: 'support_ticket',
    reference_id: ticketId,
    priority: 'normal'
  }, db, providerConfig);
}

/**
 * Send approval request email
 */
export async function sendApprovalRequestEmail(
  approverEmail: string,
  approverName: string,
  requestType: string,
  requesterName: string,
  requestDetails: string,
  approvalUrl: string,
  tenantId: string,
  approvalId: string,
  db: any,
  providerConfig: any
): Promise<EmailSendResult> {
  return sendEmail({
    template_type: 'approval_request',
    recipients: [{ email: approverEmail, name: approverName, type: 'to' }],
    body_variables: {
      approver_name: approverName,
      request_type: requestType,
      requester_name: requesterName,
      request_details: requestDetails,
      approval_url: approvalUrl,
      current_year: new Date().getFullYear()
    },
    tenant_id: tenantId,
    reference_type: 'approval',
    reference_id: approvalId,
    priority: 'high'
  }, db, providerConfig);
}

export default {
  sendEmail,
  sendWelcomeEmail,
  sendQuotationEmail,
  sendInvoiceEmail,
  sendTicketCreatedEmail,
  sendTicketReplyEmail,
  sendApprovalRequestEmail
};
