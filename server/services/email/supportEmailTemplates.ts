/**
 * Support Email Templates Service
 * Server-side email template rendering and sending for support notifications
 */

import { EmailProvider } from '../email/emailProvider';
import { log } from '../../vite';

interface BaseTemplateVars {
  appName?: string;
  supportUrl?: string;
  unsubscribeUrl?: string;
}

interface TicketCreatedVars extends BaseTemplateVars {
  customerName: string;
  ticketNumber: string;
  subject: string;
  category: string;
  priority: string;
  message: string;
  viewTicketUrl: string;
}

interface NewMessageVars extends BaseTemplateVars {
  customerName: string;
  ticketNumber: string;
  subject: string;
  agentName: string;
  message: string;
  viewTicketUrl: string;
}

interface AgentAssignmentVars extends BaseTemplateVars {
  agentName: string;
  ticketNumber: string;
  subject: string;
  customerName: string;
  customerEmail: string;
  category: string;
  priority: string;
  message: string;
  assignedBy: string;
  slaDeadline: string;
  viewTicketUrl: string;
}

interface SLAWarningVars extends BaseTemplateVars {
  recipientName: string;
  ticketNumber: string;
  subject: string;
  customerName: string;
  priority: string;
  timeRemaining: string;
  slaType: 'first_response' | 'resolution';
  assignedAgent: string;
  viewTicketUrl: string;
}

interface SLABreachVars extends BaseTemplateVars {
  recipientName: string;
  ticketNumber: string;
  subject: string;
  customerName: string;
  priority: string;
  slaType: 'first_response' | 'resolution';
  breachedBy: string;
  assignedAgent: string;
  viewTicketUrl: string;
}

interface TicketResolvedVars extends BaseTemplateVars {
  customerName: string;
  ticketNumber: string;
  subject: string;
  resolution: string;
  viewTicketUrl: string;
  feedbackUrl: string;
}

interface TicketEscalatedVars extends BaseTemplateVars {
  managerName: string;
  ticketNumber: string;
  subject: string;
  customerName: string;
  priority: string;
  escalationReason: string;
  previousAgent: string;
  viewTicketUrl: string;
}

type EmailTemplateVars = 
  | TicketCreatedVars 
  | NewMessageVars 
  | AgentAssignmentVars 
  | SLAWarningVars 
  | SLABreachVars 
  | TicketResolvedVars 
  | TicketEscalatedVars;

const DEFAULTS = {
  appName: 'BoxCostPro',
  supportUrl: process.env.SUPPORT_URL || 'https://app.boxcostpro.com/support',
  unsubscribeUrl: process.env.UNSUBSCRIBE_URL || 'https://app.boxcostpro.com/settings/notifications',
};

/**
 * Base HTML template wrapper
 */
function baseTemplate(content: string, appName: string = DEFAULTS.appName): string {
  const year = new Date().getFullYear();
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${appName} Support</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5; margin: 0; padding: 20px;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
    ${content}
    <tr>
      <td style="background-color: #f8fafc; padding: 24px; text-align: center; color: #64748b; font-size: 12px; border-top: 1px solid #e2e8f0;">
        <p style="margin: 0 0 8px 0;">This is an automated message from ${appName} Support.</p>
        <p style="margin: 0 0 8px 0;">Please do not reply directly to this email.</p>
        <p style="margin: 0 0 8px 0;">
          <a href="${DEFAULTS.supportUrl}" style="color: #3b82f6; text-decoration: none;">Visit Support Center</a> | 
          <a href="${DEFAULTS.unsubscribeUrl}" style="color: #3b82f6; text-decoration: none;">Manage Preferences</a>
        </p>
        <p style="margin: 0;">© ${year} ${appName}. All rights reserved.</p>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

/**
 * Generate ticket info table
 */
function ticketInfoTable(rows: Array<{ label: string; value: string; color?: string }>): string {
  const rowsHtml = rows.map(row => `
    <tr>
      <td style="padding: 8px 12px; color: #64748b; font-size: 14px; border-bottom: 1px solid #e2e8f0;">${row.label}</td>
      <td style="padding: 8px 12px; font-weight: 500; color: ${row.color || '#1e293b'}; text-align: right; border-bottom: 1px solid #e2e8f0;">${row.value}</td>
    </tr>
  `).join('');
  
  return `
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin: 16px 0;">
      ${rowsHtml}
    </table>
  `;
}

/**
 * Get priority color
 */
function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    urgent: '#dc2626',
    high: '#ea580c',
    medium: '#ca8a04',
    low: '#16a34a',
  };
  return colors[priority.toLowerCase()] || '#1e293b';
}

/**
 * Message box component
 */
function messageBox(content: string): string {
  return `
    <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 16px; margin: 16px 0; border-radius: 0 8px 8px 0;">
      ${content}
    </div>
  `;
}

/**
 * Button component
 */
function button(text: string, url: string, color: string = '#3b82f6'): string {
  return `
    <a href="${url}" style="display: inline-block; background-color: ${color}; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500; margin: 16px 0;">${text}</a>
  `;
}

/**
 * Alert box component
 */
function alertBox(title: string, content: string, type: 'warning' | 'error' | 'success'): string {
  const styles = {
    warning: { bg: '#fef3c7', border: '#fbbf24', color: '#b45309' },
    error: { bg: '#fef2f2', border: '#dc2626', color: '#dc2626' },
    success: { bg: '#dcfce7', border: '#22c55e', color: '#15803d' },
  };
  const style = styles[type];
  
  return `
    <div style="background-color: ${style.bg}; border: 1px solid ${style.border}; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <h4 style="color: ${style.color}; margin: 0 0 8px 0;">${title}</h4>
      <p style="margin: 0;">${content}</p>
    </div>
  `;
}

// ============================================================================
// Email Template Generators
// ============================================================================

/**
 * Ticket Created - Customer confirmation
 */
export function renderTicketCreated(vars: TicketCreatedVars): { subject: string; html: string } {
  const content = `
    <tr>
      <td style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 24px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px; font-weight: 600;">Support Request Received</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px 24px;">
        <p style="margin: 0 0 16px 0;">Hi ${vars.customerName},</p>
        
        <p style="margin: 0 0 16px 0;">Thank you for reaching out to us. We've received your support request and our team will review it shortly.</p>
        
        ${ticketInfoTable([
          { label: 'Ticket Number', value: vars.ticketNumber },
          { label: 'Subject', value: vars.subject },
          { label: 'Category', value: vars.category },
          { label: 'Priority', value: vars.priority, color: getPriorityColor(vars.priority) },
        ])}
        
        <p style="margin: 16px 0 8px 0;"><strong>Your message:</strong></p>
        ${messageBox(vars.message)}
        
        <p style="margin: 16px 0 8px 0;">You can track the status of your request and add additional information by visiting your support dashboard:</p>
        
        ${button('View Ticket', vars.viewTicketUrl)}
        
        <p style="margin: 16px 0 8px 0;">We typically respond within 24 hours during business days. For urgent issues, our team prioritizes based on severity and impact.</p>
        
        <p style="margin: 16px 0 0 0;">Best regards,<br>The Support Team</p>
      </td>
    </tr>
  `;
  
  return {
    subject: `[${vars.ticketNumber}] We received your support request`,
    html: baseTemplate(content, vars.appName),
  };
}

/**
 * New Message Notification - Customer receives update
 */
export function renderNewMessage(vars: NewMessageVars): { subject: string; html: string } {
  const content = `
    <tr>
      <td style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 24px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px; font-weight: 600;">New Response</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px 24px;">
        <p style="margin: 0 0 16px 0;">Hi ${vars.customerName},</p>
        
        <p style="margin: 0 0 16px 0;">${vars.agentName} has responded to your support ticket:</p>
        
        ${ticketInfoTable([
          { label: 'Ticket Number', value: vars.ticketNumber },
          { label: 'Subject', value: vars.subject },
        ])}
        
        <p style="margin: 16px 0 8px 0;"><strong>Response:</strong></p>
        ${messageBox(vars.message)}
        
        <p style="margin: 16px 0 8px 0;">To reply or view the full conversation:</p>
        
        ${button('View Conversation', vars.viewTicketUrl)}
        
        <p style="margin: 16px 0 0 0;">Thank you for your patience!</p>
        
        <p style="margin: 16px 0 0 0;">Best regards,<br>The Support Team</p>
      </td>
    </tr>
  `;
  
  return {
    subject: `[${vars.ticketNumber}] New response on your support ticket`,
    html: baseTemplate(content, vars.appName),
  };
}

/**
 * SLA Warning Notification
 */
export function renderSLAWarning(vars: SLAWarningVars): { subject: string; html: string } {
  const slaTypeText = vars.slaType === 'first_response' ? 'first response' : 'resolution';
  
  const content = `
    <tr>
      <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 24px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px; font-weight: 600;">⚠️ SLA Warning</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px 24px;">
        <p style="margin: 0 0 16px 0;">Hi ${vars.recipientName},</p>
        
        ${alertBox('Action Required', `The following ticket is approaching its ${slaTypeText} SLA deadline.<br><strong>Time Remaining: ${vars.timeRemaining}</strong>`, 'warning')}
        
        ${ticketInfoTable([
          { label: 'Ticket Number', value: vars.ticketNumber },
          { label: 'Subject', value: vars.subject },
          { label: 'Customer', value: vars.customerName },
          { label: 'Priority', value: vars.priority, color: getPriorityColor(vars.priority) },
          { label: 'Assigned To', value: vars.assignedAgent || 'Unassigned' },
        ])}
        
        <p style="margin: 16px 0 8px 0;">Please take action immediately to avoid an SLA breach:</p>
        
        ${button('View Ticket', vars.viewTicketUrl)}
      </td>
    </tr>
  `;
  
  return {
    subject: `⚠️ [${vars.ticketNumber}] SLA Warning - Response needed soon`,
    html: baseTemplate(content, vars.appName),
  };
}

/**
 * SLA Breach Notification
 */
export function renderSLABreach(vars: SLABreachVars): { subject: string; html: string } {
  const slaTypeText = vars.slaType === 'first_response' ? 'first response' : 'resolution';
  
  const content = `
    <tr>
      <td style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 24px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px; font-weight: 600;">🚨 SLA Breached</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px 24px;">
        <p style="margin: 0 0 16px 0;">Hi ${vars.recipientName},</p>
        
        ${alertBox('SLA Breach Alert', `The ${slaTypeText} SLA has been breached by <strong>${vars.breachedBy}</strong>.`, 'error')}
        
        ${ticketInfoTable([
          { label: 'Ticket Number', value: vars.ticketNumber },
          { label: 'Subject', value: vars.subject },
          { label: 'Customer', value: vars.customerName },
          { label: 'Priority', value: vars.priority, color: getPriorityColor(vars.priority) },
          { label: 'Assigned To', value: vars.assignedAgent || 'Unassigned' },
          { label: 'Breached By', value: vars.breachedBy, color: '#dc2626' },
        ])}
        
        <p style="margin: 16px 0 8px 0;">This breach has been logged for review. Please take immediate action and document any reasons for the delay.</p>
        
        ${button('Handle Breach', vars.viewTicketUrl, '#dc2626')}
      </td>
    </tr>
  `;
  
  return {
    subject: `🚨 [${vars.ticketNumber}] SLA BREACHED - Immediate attention required`,
    html: baseTemplate(content, vars.appName),
  };
}

/**
 * Ticket Resolved Notification
 */
export function renderTicketResolved(vars: TicketResolvedVars): { subject: string; html: string } {
  const content = `
    <tr>
      <td style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; padding: 24px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px; font-weight: 600;">✓ Ticket Resolved</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px 24px;">
        <p style="margin: 0 0 16px 0;">Hi ${vars.customerName},</p>
        
        ${alertBox('Great News!', 'Your support ticket has been resolved. We hope we were able to help!', 'success')}
        
        ${ticketInfoTable([
          { label: 'Ticket Number', value: vars.ticketNumber },
          { label: 'Subject', value: vars.subject },
          { label: 'Status', value: 'Resolved', color: '#16a34a' },
        ])}
        
        <p style="margin: 16px 0 8px 0;"><strong>Resolution Summary:</strong></p>
        ${messageBox(vars.resolution)}
        
        <p style="margin: 16px 0 8px 0;">If you have any further questions or the issue persists, you can reopen this ticket:</p>
        
        ${button('View Ticket', vars.viewTicketUrl)}
        
        <p style="margin: 24px 0 8px 0;">We'd love to hear your feedback! It helps us improve our service:</p>
        
        ${button('Rate Your Experience', vars.feedbackUrl, '#8b5cf6')}
        
        <p style="margin: 16px 0 0 0;">Thank you for choosing us!</p>
        
        <p style="margin: 16px 0 0 0;">Best regards,<br>The Support Team</p>
      </td>
    </tr>
  `;
  
  return {
    subject: `[${vars.ticketNumber}] Your support ticket has been resolved`,
    html: baseTemplate(content, vars.appName),
  };
}

/**
 * Agent Assignment Notification
 */
export function renderAgentAssignment(vars: AgentAssignmentVars): { subject: string; html: string } {
  const content = `
    <tr>
      <td style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 24px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px; font-weight: 600;">New Ticket Assigned</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px 24px;">
        <p style="margin: 0 0 16px 0;">Hi ${vars.agentName},</p>
        
        <p style="margin: 0 0 16px 0;">A new support ticket has been assigned to you by ${vars.assignedBy}.</p>
        
        ${ticketInfoTable([
          { label: 'Ticket Number', value: vars.ticketNumber },
          { label: 'Subject', value: vars.subject },
          { label: 'Customer', value: `${vars.customerName} (${vars.customerEmail})` },
          { label: 'Category', value: vars.category },
          { label: 'Priority', value: vars.priority, color: getPriorityColor(vars.priority) },
          { label: 'SLA Deadline', value: vars.slaDeadline },
        ])}
        
        <p style="margin: 16px 0 8px 0;"><strong>Customer's message:</strong></p>
        ${messageBox(vars.message)}
        
        ${button('Respond to Ticket', vars.viewTicketUrl)}
      </td>
    </tr>
  `;
  
  return {
    subject: `[${vars.ticketNumber}] New ticket assigned to you: ${vars.subject}`,
    html: baseTemplate(content, vars.appName),
  };
}

/**
 * Ticket Escalated Notification
 */
export function renderTicketEscalated(vars: TicketEscalatedVars): { subject: string; html: string } {
  const content = `
    <tr>
      <td style="background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%); color: white; padding: 24px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px; font-weight: 600;">📈 Ticket Escalated</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px 24px;">
        <p style="margin: 0 0 16px 0;">Hi ${vars.managerName},</p>
        
        <p style="margin: 0 0 16px 0;">A support ticket has been escalated and requires your attention.</p>
        
        ${ticketInfoTable([
          { label: 'Ticket Number', value: vars.ticketNumber },
          { label: 'Subject', value: vars.subject },
          { label: 'Customer', value: vars.customerName },
          { label: 'Priority', value: vars.priority, color: getPriorityColor(vars.priority) },
          { label: 'Previous Agent', value: vars.previousAgent || 'N/A' },
        ])}
        
        <p style="margin: 16px 0 8px 0;"><strong>Escalation Reason:</strong></p>
        ${messageBox(vars.escalationReason)}
        
        ${button('Review Ticket', vars.viewTicketUrl)}
      </td>
    </tr>
  `;
  
  return {
    subject: `📈 [${vars.ticketNumber}] Ticket Escalated - Manager review required`,
    html: baseTemplate(content, vars.appName),
  };
}

// ============================================================================
// Email Sending Service
// ============================================================================

export class SupportEmailService {
  private emailProvider: EmailProvider;
  
  constructor(emailProvider: EmailProvider) {
    this.emailProvider = emailProvider;
  }
  
  async sendTicketCreated(to: string, vars: TicketCreatedVars): Promise<boolean> {
    const { subject, html } = renderTicketCreated(vars);
    return this.send(to, subject, html);
  }
  
  async sendNewMessage(to: string, vars: NewMessageVars): Promise<boolean> {
    const { subject, html } = renderNewMessage(vars);
    return this.send(to, subject, html);
  }
  
  async sendSLAWarning(to: string, vars: SLAWarningVars): Promise<boolean> {
    const { subject, html } = renderSLAWarning(vars);
    return this.send(to, subject, html);
  }
  
  async sendSLABreach(to: string, vars: SLABreachVars): Promise<boolean> {
    const { subject, html } = renderSLABreach(vars);
    return this.send(to, subject, html);
  }
  
  async sendTicketResolved(to: string, vars: TicketResolvedVars): Promise<boolean> {
    const { subject, html } = renderTicketResolved(vars);
    return this.send(to, subject, html);
  }
  
  async sendAgentAssignment(to: string, vars: AgentAssignmentVars): Promise<boolean> {
    const { subject, html } = renderAgentAssignment(vars);
    return this.send(to, subject, html);
  }
  
  async sendTicketEscalated(to: string, vars: TicketEscalatedVars): Promise<boolean> {
    const { subject, html } = renderTicketEscalated(vars);
    return this.send(to, subject, html);
  }
  
  private async send(to: string, subject: string, html: string): Promise<boolean> {
    try {
      const result = await this.emailProvider.sendEmail({
        to,
        subject,
        html,
      });
      
      if (!result.success) {
        log(`Failed to send support email: ${result.error}`, 'support-email');
      }
      
      return result.success;
    } catch (error) {
      log(`Error sending support email: ${error}`, 'support-email');
      return false;
    }
  }
}

export default SupportEmailService;
