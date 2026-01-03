/**
 * Support Email Templates
 * Email templates for support ticket notifications
 */

import { TicketPriority, TicketStatus, TicketCategory } from '../types/support';

// Base template wrapper
const baseTemplate = (content: string, appName: string = 'BoxCostPro') => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${appName} Support</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f5f5f5;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
      color: white;
      padding: 24px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .content {
      padding: 32px 24px;
    }
    .ticket-info {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
      margin: 16px 0;
    }
    .ticket-info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e2e8f0;
    }
    .ticket-info-row:last-child {
      border-bottom: none;
    }
    .ticket-info-label {
      color: #64748b;
      font-size: 14px;
    }
    .ticket-info-value {
      font-weight: 500;
      color: #1e293b;
    }
    .priority-urgent { color: #dc2626; font-weight: 600; }
    .priority-high { color: #ea580c; font-weight: 600; }
    .priority-medium { color: #ca8a04; font-weight: 600; }
    .priority-low { color: #16a34a; }
    .message-box {
      background-color: #f8fafc;
      border-left: 4px solid #3b82f6;
      padding: 16px;
      margin: 16px 0;
      border-radius: 0 8px 8px 0;
    }
    .button {
      display: inline-block;
      background-color: #3b82f6;
      color: white !important;
      text-decoration: none;
      padding: 12px 24px;
      border-radius: 6px;
      font-weight: 500;
      margin: 16px 0;
    }
    .button:hover {
      background-color: #2563eb;
    }
    .footer {
      background-color: #f8fafc;
      padding: 24px;
      text-align: center;
      color: #64748b;
      font-size: 12px;
      border-top: 1px solid #e2e8f0;
    }
    .footer a {
      color: #3b82f6;
      text-decoration: none;
    }
    .warning-box {
      background-color: #fef3c7;
      border: 1px solid #fbbf24;
      border-radius: 8px;
      padding: 16px;
      margin: 16px 0;
    }
    .warning-box h4 {
      color: #b45309;
      margin: 0 0 8px 0;
    }
    .success-box {
      background-color: #dcfce7;
      border: 1px solid #22c55e;
      border-radius: 8px;
      padding: 16px;
      margin: 16px 0;
    }
    .success-box h4 {
      color: #15803d;
      margin: 0 0 8px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    ${content}
    <div class="footer">
      <p>This is an automated message from ${appName} Support.</p>
      <p>Please do not reply directly to this email.</p>
      <p><a href="{{supportUrl}}">Visit Support Center</a> | <a href="{{unsubscribeUrl}}">Manage Preferences</a></p>
      <p>© ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;

// Ticket Created - Customer confirmation
export const ticketCreatedTemplate = {
  subject: '[{{ticketNumber}}] We received your support request',
  html: (vars: {
    customerName: string;
    ticketNumber: string;
    subject: string;
    category: string;
    priority: string;
    message: string;
    viewTicketUrl: string;
  }) => baseTemplate(`
    <div class="header">
      <h1>Support Request Received</h1>
    </div>
    <div class="content">
      <p>Hi ${vars.customerName},</p>
      
      <p>Thank you for reaching out to us. We've received your support request and our team will review it shortly.</p>
      
      <div class="ticket-info">
        <div class="ticket-info-row">
          <span class="ticket-info-label">Ticket Number</span>
          <span class="ticket-info-value">${vars.ticketNumber}</span>
        </div>
        <div class="ticket-info-row">
          <span class="ticket-info-label">Subject</span>
          <span class="ticket-info-value">${vars.subject}</span>
        </div>
        <div class="ticket-info-row">
          <span class="ticket-info-label">Category</span>
          <span class="ticket-info-value">${vars.category}</span>
        </div>
        <div class="ticket-info-row">
          <span class="ticket-info-label">Priority</span>
          <span class="ticket-info-value priority-${vars.priority.toLowerCase()}">${vars.priority}</span>
        </div>
      </div>
      
      <p><strong>Your message:</strong></p>
      <div class="message-box">
        ${vars.message}
      </div>
      
      <p>You can track the status of your request and add additional information by visiting your support dashboard:</p>
      
      <a href="${vars.viewTicketUrl}" class="button">View Ticket</a>
      
      <p>We typically respond within 24 hours during business days. For urgent issues, our team prioritizes based on severity and impact.</p>
      
      <p>Best regards,<br>The Support Team</p>
    </div>
  `),
};

// New Message Notification - Customer receives update
export const newMessageNotificationTemplate = {
  subject: '[{{ticketNumber}}] New response on your support ticket',
  html: (vars: {
    customerName: string;
    ticketNumber: string;
    subject: string;
    agentName: string;
    message: string;
    viewTicketUrl: string;
  }) => baseTemplate(`
    <div class="header">
      <h1>New Response</h1>
    </div>
    <div class="content">
      <p>Hi ${vars.customerName},</p>
      
      <p>${vars.agentName} has responded to your support ticket:</p>
      
      <div class="ticket-info">
        <div class="ticket-info-row">
          <span class="ticket-info-label">Ticket Number</span>
          <span class="ticket-info-value">${vars.ticketNumber}</span>
        </div>
        <div class="ticket-info-row">
          <span class="ticket-info-label">Subject</span>
          <span class="ticket-info-value">${vars.subject}</span>
        </div>
      </div>
      
      <p><strong>Response:</strong></p>
      <div class="message-box">
        ${vars.message}
      </div>
      
      <p>To reply or view the full conversation:</p>
      
      <a href="${vars.viewTicketUrl}" class="button">View Conversation</a>
      
      <p>Thank you for your patience!</p>
      
      <p>Best regards,<br>The Support Team</p>
    </div>
  `),
};

// Agent Assignment Notification - Agent receives new ticket
export const agentAssignmentTemplate = {
  subject: '[{{ticketNumber}}] New ticket assigned to you: {{subject}}',
  html: (vars: {
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
  }) => baseTemplate(`
    <div class="header">
      <h1>New Ticket Assigned</h1>
    </div>
    <div class="content">
      <p>Hi ${vars.agentName},</p>
      
      <p>A new support ticket has been assigned to you by ${vars.assignedBy}.</p>
      
      <div class="ticket-info">
        <div class="ticket-info-row">
          <span class="ticket-info-label">Ticket Number</span>
          <span class="ticket-info-value">${vars.ticketNumber}</span>
        </div>
        <div class="ticket-info-row">
          <span class="ticket-info-label">Subject</span>
          <span class="ticket-info-value">${vars.subject}</span>
        </div>
        <div class="ticket-info-row">
          <span class="ticket-info-label">Customer</span>
          <span class="ticket-info-value">${vars.customerName} (${vars.customerEmail})</span>
        </div>
        <div class="ticket-info-row">
          <span class="ticket-info-label">Category</span>
          <span class="ticket-info-value">${vars.category}</span>
        </div>
        <div class="ticket-info-row">
          <span class="ticket-info-label">Priority</span>
          <span class="ticket-info-value priority-${vars.priority.toLowerCase()}">${vars.priority}</span>
        </div>
        <div class="ticket-info-row">
          <span class="ticket-info-label">SLA Deadline</span>
          <span class="ticket-info-value">${vars.slaDeadline}</span>
        </div>
      </div>
      
      <p><strong>Customer's message:</strong></p>
      <div class="message-box">
        ${vars.message}
      </div>
      
      <a href="${vars.viewTicketUrl}" class="button">Respond to Ticket</a>
    </div>
  `),
};

// SLA Warning Notification - Agent/Manager
export const slaWarningTemplate = {
  subject: '⚠️ [{{ticketNumber}}] SLA Warning - Response needed soon',
  html: (vars: {
    recipientName: string;
    ticketNumber: string;
    subject: string;
    customerName: string;
    priority: string;
    timeRemaining: string;
    slaType: 'first_response' | 'resolution';
    assignedAgent: string;
    viewTicketUrl: string;
  }) => baseTemplate(`
    <div class="header" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);">
      <h1>⚠️ SLA Warning</h1>
    </div>
    <div class="content">
      <p>Hi ${vars.recipientName},</p>
      
      <div class="warning-box">
        <h4>Action Required</h4>
        <p>The following ticket is approaching its ${vars.slaType === 'first_response' ? 'first response' : 'resolution'} SLA deadline.</p>
        <p><strong>Time Remaining: ${vars.timeRemaining}</strong></p>
      </div>
      
      <div class="ticket-info">
        <div class="ticket-info-row">
          <span class="ticket-info-label">Ticket Number</span>
          <span class="ticket-info-value">${vars.ticketNumber}</span>
        </div>
        <div class="ticket-info-row">
          <span class="ticket-info-label">Subject</span>
          <span class="ticket-info-value">${vars.subject}</span>
        </div>
        <div class="ticket-info-row">
          <span class="ticket-info-label">Customer</span>
          <span class="ticket-info-value">${vars.customerName}</span>
        </div>
        <div class="ticket-info-row">
          <span class="ticket-info-label">Priority</span>
          <span class="ticket-info-value priority-${vars.priority.toLowerCase()}">${vars.priority}</span>
        </div>
        <div class="ticket-info-row">
          <span class="ticket-info-label">Assigned To</span>
          <span class="ticket-info-value">${vars.assignedAgent || 'Unassigned'}</span>
        </div>
      </div>
      
      <p>Please take action immediately to avoid an SLA breach:</p>
      
      <a href="${vars.viewTicketUrl}" class="button">View Ticket</a>
    </div>
  `),
};

// SLA Breach Notification - Manager/Admin
export const slaBreachTemplate = {
  subject: '🚨 [{{ticketNumber}}] SLA BREACHED - Immediate attention required',
  html: (vars: {
    recipientName: string;
    ticketNumber: string;
    subject: string;
    customerName: string;
    priority: string;
    slaType: 'first_response' | 'resolution';
    breachedBy: string;
    assignedAgent: string;
    viewTicketUrl: string;
  }) => baseTemplate(`
    <div class="header" style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);">
      <h1>🚨 SLA Breached</h1>
    </div>
    <div class="content">
      <p>Hi ${vars.recipientName},</p>
      
      <div style="background-color: #fef2f2; border: 1px solid #dc2626; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <h4 style="color: #dc2626; margin: 0 0 8px 0;">SLA Breach Alert</h4>
        <p style="margin: 0;">The ${vars.slaType === 'first_response' ? 'first response' : 'resolution'} SLA has been breached by <strong>${vars.breachedBy}</strong>.</p>
      </div>
      
      <div class="ticket-info">
        <div class="ticket-info-row">
          <span class="ticket-info-label">Ticket Number</span>
          <span class="ticket-info-value">${vars.ticketNumber}</span>
        </div>
        <div class="ticket-info-row">
          <span class="ticket-info-label">Subject</span>
          <span class="ticket-info-value">${vars.subject}</span>
        </div>
        <div class="ticket-info-row">
          <span class="ticket-info-label">Customer</span>
          <span class="ticket-info-value">${vars.customerName}</span>
        </div>
        <div class="ticket-info-row">
          <span class="ticket-info-label">Priority</span>
          <span class="ticket-info-value priority-${vars.priority.toLowerCase()}">${vars.priority}</span>
        </div>
        <div class="ticket-info-row">
          <span class="ticket-info-label">Assigned To</span>
          <span class="ticket-info-value">${vars.assignedAgent || 'Unassigned'}</span>
        </div>
        <div class="ticket-info-row">
          <span class="ticket-info-label">Breached By</span>
          <span class="ticket-info-value" style="color: #dc2626;">${vars.breachedBy}</span>
        </div>
      </div>
      
      <p>This breach has been logged for review. Please take immediate action and document any reasons for the delay.</p>
      
      <a href="${vars.viewTicketUrl}" class="button" style="background-color: #dc2626;">Handle Breach</a>
    </div>
  `),
};

// Ticket Resolved Notification - Customer
export const ticketResolvedTemplate = {
  subject: '[{{ticketNumber}}] Your support ticket has been resolved',
  html: (vars: {
    customerName: string;
    ticketNumber: string;
    subject: string;
    resolution: string;
    viewTicketUrl: string;
    feedbackUrl: string;
  }) => baseTemplate(`
    <div class="header" style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);">
      <h1>✓ Ticket Resolved</h1>
    </div>
    <div class="content">
      <p>Hi ${vars.customerName},</p>
      
      <div class="success-box">
        <h4>Great News!</h4>
        <p>Your support ticket has been resolved. We hope we were able to help!</p>
      </div>
      
      <div class="ticket-info">
        <div class="ticket-info-row">
          <span class="ticket-info-label">Ticket Number</span>
          <span class="ticket-info-value">${vars.ticketNumber}</span>
        </div>
        <div class="ticket-info-row">
          <span class="ticket-info-label">Subject</span>
          <span class="ticket-info-value">${vars.subject}</span>
        </div>
        <div class="ticket-info-row">
          <span class="ticket-info-label">Status</span>
          <span class="ticket-info-value" style="color: #16a34a; font-weight: 600;">Resolved</span>
        </div>
      </div>
      
      <p><strong>Resolution Summary:</strong></p>
      <div class="message-box">
        ${vars.resolution}
      </div>
      
      <p>If you have any further questions or the issue persists, you can reopen this ticket:</p>
      
      <a href="${vars.viewTicketUrl}" class="button">View Ticket</a>
      
      <p style="margin-top: 24px;">We'd love to hear your feedback! It helps us improve our service:</p>
      
      <a href="${vars.feedbackUrl}" class="button" style="background-color: #8b5cf6;">Rate Your Experience</a>
      
      <p>Thank you for choosing us!</p>
      
      <p>Best regards,<br>The Support Team</p>
    </div>
  `),
};

// Ticket Escalated Notification - Manager
export const ticketEscalatedTemplate = {
  subject: '📈 [{{ticketNumber}}] Ticket Escalated - Manager review required',
  html: (vars: {
    managerName: string;
    ticketNumber: string;
    subject: string;
    customerName: string;
    priority: string;
    escalationReason: string;
    previousAgent: string;
    viewTicketUrl: string;
  }) => baseTemplate(`
    <div class="header" style="background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%);">
      <h1>📈 Ticket Escalated</h1>
    </div>
    <div class="content">
      <p>Hi ${vars.managerName},</p>
      
      <p>A support ticket has been escalated and requires your attention.</p>
      
      <div class="ticket-info">
        <div class="ticket-info-row">
          <span class="ticket-info-label">Ticket Number</span>
          <span class="ticket-info-value">${vars.ticketNumber}</span>
        </div>
        <div class="ticket-info-row">
          <span class="ticket-info-label">Subject</span>
          <span class="ticket-info-value">${vars.subject}</span>
        </div>
        <div class="ticket-info-row">
          <span class="ticket-info-label">Customer</span>
          <span class="ticket-info-value">${vars.customerName}</span>
        </div>
        <div class="ticket-info-row">
          <span class="ticket-info-label">Priority</span>
          <span class="ticket-info-value priority-${vars.priority.toLowerCase()}">${vars.priority}</span>
        </div>
        <div class="ticket-info-row">
          <span class="ticket-info-label">Previous Agent</span>
          <span class="ticket-info-value">${vars.previousAgent || 'N/A'}</span>
        </div>
      </div>
      
      <p><strong>Escalation Reason:</strong></p>
      <div class="message-box">
        ${vars.escalationReason}
      </div>
      
      <a href="${vars.viewTicketUrl}" class="button">Review Ticket</a>
    </div>
  `),
};

// Export template renderer function
export function renderEmailTemplate(
  templateName: keyof typeof emailTemplates,
  variables: Record<string, any>
): { subject: string; html: string } {
  const template = emailTemplates[templateName];
  if (!template) {
    throw new Error(`Email template "${templateName}" not found`);
  }
  
  // Replace subject placeholders
  let subject = template.subject;
  Object.entries(variables).forEach(([key, value]) => {
    subject = subject.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
  });
  
  return {
    subject,
    html: template.html(variables),
  };
}

// Template registry
export const emailTemplates = {
  ticketCreated: ticketCreatedTemplate,
  newMessage: newMessageNotificationTemplate,
  agentAssignment: agentAssignmentTemplate,
  slaWarning: slaWarningTemplate,
  slaBreach: slaBreachTemplate,
  ticketResolved: ticketResolvedTemplate,
  ticketEscalated: ticketEscalatedTemplate,
} as const;

export type EmailTemplateName = keyof typeof emailTemplates;
