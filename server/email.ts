import nodemailer from 'nodemailer';

// Email configuration - uses environment variables
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || 'BoxCost Pro <noreply@boxcostpro.com>';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';

// Check if email is configured
export const isEmailConfigured = !!(SMTP_USER && SMTP_PASS);

// Create transporter
const transporter = isEmailConfigured ? nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
}) : null;

// Email templates
const emailHeader = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; }
    .footer { background: #1e293b; color: #94a3b8; padding: 20px; text-align: center; font-size: 12px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
    .button:hover { background: #1d4ed8; }
    .highlight { background: #fef3c7; padding: 15px; border-radius: 6px; border-left: 4px solid #f59e0b; margin: 15px 0; }
    .success { background: #dcfce7; border-left-color: #22c55e; }
    .danger { background: #fee2e2; border-left-color: #ef4444; }
    .info { background: #dbeafe; border-left-color: #3b82f6; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>BoxCost Pro</h1>
    </div>
    <div class="content">
`;

const emailFooter = `
    </div>
    <div class="footer">
      <p>This is an automated message from BoxCost Pro. Please do not reply directly to this email.</p>
      <p>&copy; ${new Date().getFullYear()} Ventura Packagers Pvt Ltd. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;

// Send email function
async function sendEmail(to: string, subject: string, htmlContent: string): Promise<boolean> {
  if (!isEmailConfigured || !transporter) {
    console.log('[EMAIL] Email not configured. Would have sent:', { to, subject });
    return false;
  }

  try {
    await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject: `[BoxCost Pro] ${subject}`,
      html: `${emailHeader}${htmlContent}${emailFooter}`,
    });
    console.log(`[EMAIL] Sent to ${to}: ${subject}`);
    return true;
  } catch (error) {
    console.error('[EMAIL] Failed to send:', error);
    return false;
  }
}

// Email templates
export const emailTemplates = {
  // New user signup - notify admin
  newUserSignup: async (user: { email: string; firstName?: string | null; lastName?: string | null; companyName?: string | null }) => {
    if (!ADMIN_EMAIL) {
      console.log('[EMAIL] Admin email not configured, skipping new user notification');
      return;
    }
    
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Not provided';
    const html = `
      <h2>New User Signup</h2>
      <p>A new user has signed up for BoxCost Pro and needs verification.</p>
      <div class="highlight info">
        <p><strong>Email:</strong> ${user.email}</p>
        <p><strong>Name:</strong> ${fullName}</p>
        <p><strong>Company:</strong> ${user.companyName || 'Not provided'}</p>
        <p><strong>Signed up at:</strong> ${new Date().toLocaleString()}</p>
      </div>
      <p>Please review this user in the Admin Panel to approve or reject their account.</p>
      <a href="${process.env.APP_URL || 'https://boxcostpro.replit.app'}/admin/users" class="button">Go to Admin Panel</a>
    `;
    
    return sendEmail(ADMIN_EMAIL, 'New User Signup - Verification Required', html);
  },

  // User approved
  userApproved: async (user: { email: string; firstName?: string | null }) => {
    const html = `
      <h2>Account Approved!</h2>
      <p>Hi ${user.firstName || 'there'},</p>
      <div class="highlight success">
        <p>Great news! Your BoxCost Pro account has been approved by our team.</p>
      </div>
      <p>You now have full access to all features including:</p>
      <ul>
        <li>Box costing calculator</li>
        <li>Quote generation and management</li>
        <li>Reports and analytics</li>
        <li>And much more!</li>
      </ul>
      <a href="${process.env.APP_URL || 'https://boxcostpro.replit.app'}/dashboard" class="button">Start Using BoxCost Pro</a>
      <p>Thank you for choosing BoxCost Pro for your corrugated box costing needs.</p>
    `;
    
    return sendEmail(user.email, 'Your Account Has Been Approved', html);
  },

  // User rejected
  userRejected: async (user: { email: string; firstName?: string | null }, reason: string) => {
    const html = `
      <h2>Account Verification Update</h2>
      <p>Hi ${user.firstName || 'there'},</p>
      <div class="highlight danger">
        <p>We were unable to approve your BoxCost Pro account at this time.</p>
      </div>
      <p><strong>Reason provided by our team:</strong></p>
      <blockquote style="background: #f8fafc; padding: 15px; border-left: 4px solid #64748b; margin: 15px 0;">
        ${reason}
      </blockquote>
      <p>If you believe this was a mistake or you've addressed the concerns mentioned above, you can update your profile and resubmit for verification.</p>
      <a href="${process.env.APP_URL || 'https://boxcostpro.replit.app'}/onboarding" class="button">Update Your Profile</a>
      <p>If you need assistance, please contact our support team.</p>
    `;
    
    return sendEmail(user.email, 'Account Verification Update', html);
  },

  // Support ticket created - notify user
  ticketCreated: async (user: { email: string; firstName?: string | null }, ticket: { ticketNo: string; subject: string }) => {
    const html = `
      <h2>Support Ticket Created</h2>
      <p>Hi ${user.firstName || 'there'},</p>
      <p>We've received your support request and created a ticket for you.</p>
      <div class="highlight info">
        <p><strong>Ticket Number:</strong> ${ticket.ticketNo}</p>
        <p><strong>Subject:</strong> ${ticket.subject}</p>
      </div>
      <p>Our support team will review your request and respond as soon as possible.</p>
      <a href="${process.env.APP_URL || 'https://boxcostpro.replit.app'}/support/tickets" class="button">View Your Ticket</a>
      <p>You can track the status of your ticket and add additional information at any time.</p>
    `;
    
    return sendEmail(user.email, `Ticket ${ticket.ticketNo} Created`, html);
  },

  // Support ticket reply - notify user
  ticketReply: async (user: { email: string; firstName?: string | null }, ticket: { ticketNo: string; subject: string }, replyPreview: string) => {
    const html = `
      <h2>New Reply on Your Support Ticket</h2>
      <p>Hi ${user.firstName || 'there'},</p>
      <p>There's a new reply on your support ticket.</p>
      <div class="highlight info">
        <p><strong>Ticket Number:</strong> ${ticket.ticketNo}</p>
        <p><strong>Subject:</strong> ${ticket.subject}</p>
      </div>
      <p><strong>Latest Reply:</strong></p>
      <blockquote style="background: #f8fafc; padding: 15px; border-left: 4px solid #64748b; margin: 15px 0;">
        ${replyPreview.substring(0, 300)}${replyPreview.length > 300 ? '...' : ''}
      </blockquote>
      <a href="${process.env.APP_URL || 'https://boxcostpro.replit.app'}/support/tickets" class="button">View Full Ticket</a>
    `;
    
    return sendEmail(user.email, `Reply on Ticket ${ticket.ticketNo}`, html);
  },

  // Support ticket closed - notify user
  ticketClosed: async (user: { email: string; firstName?: string | null }, ticket: { ticketNo: string; subject: string }, resolution: string) => {
    const html = `
      <h2>Support Ticket Closed</h2>
      <p>Hi ${user.firstName || 'there'},</p>
      <p>Your support ticket has been resolved and closed.</p>
      <div class="highlight success">
        <p><strong>Ticket Number:</strong> ${ticket.ticketNo}</p>
        <p><strong>Subject:</strong> ${ticket.subject}</p>
        <p><strong>Status:</strong> Closed</p>
      </div>
      <p><strong>Resolution:</strong></p>
      <blockquote style="background: #f8fafc; padding: 15px; border-left: 4px solid #22c55e; margin: 15px 0;">
        ${resolution}
      </blockquote>
      <p>If you're not satisfied with the resolution or have additional questions, you can create a new support ticket.</p>
      <a href="${process.env.APP_URL || 'https://boxcostpro.replit.app'}/support/tickets" class="button">View Tickets</a>
      <p>Thank you for using BoxCost Pro support!</p>
    `;
    
    return sendEmail(user.email, `Ticket ${ticket.ticketNo} Closed`, html);
  },

  // New ticket notification for support team
  newTicketForSupport: async (ticket: { ticketNo: string; subject: string; priority: string; category?: string | null }, user: { email: string; firstName?: string | null; companyName?: string | null }) => {
    if (!ADMIN_EMAIL) return;
    
    const priorityColors: Record<string, string> = {
      low: '#22c55e',
      medium: '#f59e0b',
      high: '#ef4444',
      urgent: '#dc2626'
    };
    
    const html = `
      <h2>New Support Ticket</h2>
      <p>A new support ticket has been created and needs attention.</p>
      <div class="highlight" style="border-left-color: ${priorityColors[ticket.priority] || '#3b82f6'}">
        <p><strong>Ticket Number:</strong> ${ticket.ticketNo}</p>
        <p><strong>Subject:</strong> ${ticket.subject}</p>
        <p><strong>Priority:</strong> <span style="color: ${priorityColors[ticket.priority] || '#3b82f6'}; font-weight: bold;">${ticket.priority.toUpperCase()}</span></p>
        <p><strong>Category:</strong> ${ticket.category || 'General'}</p>
        <p><strong>From:</strong> ${user.firstName || 'Unknown'} (${user.email})</p>
        <p><strong>Company:</strong> ${user.companyName || 'Not specified'}</p>
      </div>
      <a href="${process.env.APP_URL || 'https://boxcostpro.replit.app'}/admin/support" class="button">View in Support Panel</a>
    `;
    
    return sendEmail(ADMIN_EMAIL, `New Support Ticket: ${ticket.ticketNo} - ${ticket.priority.toUpperCase()}`, html);
  },
};

export default emailTemplates;
