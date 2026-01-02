/**
 * Verification Email Templates
 * All email templates for the onboarding verification flow
 */

// ========== ADMIN NOTIFICATION - NEW USER SIGNUP ==========

export function getAdminNewUserEmailHTML(params: {
  businessName: string;
  ownerName: string;
  email: string;
  mobile: string;
  signupDate: string;
  verificationUrl: string;
}): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
    .content { background: #f9f9f9; padding: 30px; border: 1px solid #ddd; }
    .info-box { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #4CAF50; }
    .button { display: inline-block; background: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔔 New Business Signup</h1>
    </div>
    <div class="content">
      <h2>Verification Pending</h2>
      <p>A new business has signed up and is awaiting verification:</p>

      <div class="info-box">
        <p><strong>Business Name:</strong> ${params.businessName}</p>
        <p><strong>Owner Name:</strong> ${params.ownerName}</p>
        <p><strong>Email:</strong> ${params.email}</p>
        <p><strong>Mobile:</strong> ${params.mobile}</p>
        <p><strong>Signup Date:</strong> ${params.signupDate}</p>
      </div>

      <p>The user is currently setting up their account. You'll receive another notification when they submit for verification.</p>

      <a href="${params.verificationUrl}" class="button">View Admin Panel</a>
    </div>
    <div class="footer">
      <p>BoxCostPro Admin Notification | Do Not Reply</p>
    </div>
  </div>
</body>
</html>`;
}

export function getAdminNewUserEmailText(params: typeof getAdminNewUserEmailHTML extends (p: infer P) => any ? P : never): string {
  return `NEW BUSINESS SIGNUP - VERIFICATION PENDING

Business Name: ${params.businessName}
Owner Name: ${params.ownerName}
Email: ${params.email}
Mobile: ${params.mobile}
Signup Date: ${params.signupDate}

The user is setting up their account. You'll receive another notification when they submit for verification.

View Admin Panel: ${params.verificationUrl}

---
BoxCostPro Admin Notification | Do Not Reply`;
}

// ========== ADMIN NOTIFICATION - VERIFICATION SUBMITTED ==========

export function getAdminVerificationSubmittedEmailHTML(params: {
  businessName: string;
  ownerName: string;
  email: string;
  submittedAt: string;
  verificationUrl: string;
}): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #FF9800; color: white; padding: 20px; text-align: center; }
    .content { background: #f9f9f9; padding: 30px; border: 1px solid #ddd; }
    .info-box { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #FF9800; }
    .button { display: inline-block; background: #FF9800; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
    .urgent { color: #ff5722; font-weight: bold; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⏰ Business Ready for Verification</h1>
    </div>
    <div class="content">
      <p class="urgent">ACTION REQUIRED: A business has completed setup and is awaiting approval.</p>

      <div class="info-box">
        <p><strong>Business Name:</strong> ${params.businessName}</p>
        <p><strong>Owner Name:</strong> ${params.ownerName}</p>
        <p><strong>Email:</strong> ${params.email}</p>
        <p><strong>Submitted:</strong> ${params.submittedAt}</p>
      </div>

      <p><strong>SLA Target:</strong> 24 hours</p>
      <p>Please review and approve or reject this business to unlock their dashboard access.</p>

      <a href="${params.verificationUrl}" class="button">Review Now</a>
    </div>
    <div class="footer">
      <p>BoxCostPro Admin Notification | Do Not Reply</p>
    </div>
  </div>
</body>
</html>`;
}

export function getAdminVerificationSubmittedEmailText(params: typeof getAdminVerificationSubmittedEmailHTML extends (p: infer P) => any ? P : never): string {
  return `BUSINESS READY FOR VERIFICATION - ACTION REQUIRED

Business Name: ${params.businessName}
Owner Name: ${params.ownerName}
Email: ${params.email}
Submitted: ${params.submittedAt}

SLA Target: 24 hours

Please review and approve or reject this business to unlock their dashboard access.

Review Now: ${params.verificationUrl}

---
BoxCostPro Admin Notification | Do Not Reply`;
}

// ========== USER - ONBOARDING REMINDER ==========

export function getUserOnboardingReminderEmailHTML(params: {
  firstName: string;
  stepsCompleted: number;
  stepsRemaining: number;
  setupUrl: string;
}): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #2196F3; color: white; padding: 20px; text-align: center; }
    .content { background: #f9f9f9; padding: 30px; border: 1px solid #ddd; }
    .progress-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; text-align: center; }
    .progress-bar { background: #e0e0e0; height: 30px; border-radius: 15px; overflow: hidden; }
    .progress-fill { background: #4CAF50; height: 100%; line-height: 30px; color: white; font-weight: bold; }
    .button { display: inline-block; background: #2196F3; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Complete Your Setup</h1>
    </div>
    <div class="content">
      <p>Hi ${params.firstName},</p>

      <p>You're almost there! Complete your setup to unlock your BoxCostPro dashboard.</p>

      <div class="progress-box">
        <h3>Setup Progress</h3>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${(params.stepsCompleted / 5) * 100}%">
            ${params.stepsCompleted}/5 Steps
          </div>
        </div>
        <p style="margin-top: 15px;"><strong>${params.stepsRemaining} steps remaining</strong></p>
      </div>

      <p><strong>Why complete setup?</strong></p>
      <ul>
        <li>✓ Access Box Cost Calculator</li>
        <li>✓ Generate Professional Quotes</li>
        <li>✓ Track Your Business Analytics</li>
        <li>✓ Manage Customers & Orders</li>
      </ul>

      <a href="${params.setupUrl}" class="button">Complete Setup Now</a>

      <p style="color: #666; font-size: 14px; margin-top: 30px;">Your dashboard will remain locked until setup is complete and verified by our team (typically 24-48 hours).</p>
    </div>
    <div class="footer">
      <p>BoxCostPro | Help: support@boxcostpro.com</p>
    </div>
  </div>
</body>
</html>`;
}

export function getUserOnboardingReminderEmailText(params: typeof getUserOnboardingReminderEmailHTML extends (p: infer P) => any ? P : never): string {
  return `COMPLETE YOUR SETUP

Hi ${params.firstName},

You're almost there! Complete your setup to unlock your BoxCostPro dashboard.

Setup Progress: ${params.stepsCompleted}/5 Steps Completed
${params.stepsRemaining} steps remaining

Why complete setup?
✓ Access Box Cost Calculator
✓ Generate Professional Quotes
✓ Track Your Business Analytics
✓ Manage Customers & Orders

Complete Setup Now: ${params.setupUrl}

Your dashboard will remain locked until setup is complete and verified by our team (typically 24-48 hours).

---
BoxCostPro | Help: support@boxcostpro.com`;
}

// ========== USER - VERIFICATION APPROVED ==========

export function getUserVerificationApprovedEmailHTML(params: {
  firstName: string;
  dashboardUrl: string;
}): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #4CAF50, #45a049); color: white; padding: 30px; text-align: center; }
    .emoji { font-size: 48px; margin-bottom: 10px; }
    .content { background: #f9f9f9; padding: 30px; border: 1px solid #ddd; }
    .success-box { background: #e8f5e9; padding: 20px; margin: 20px 0; border-left: 4px solid #4CAF50; border-radius: 4px; }
    .button { display: inline-block; background: #4CAF50; color: white; padding: 15px 40px; text-decoration: none; border-radius: 4px; margin: 20px 0; font-size: 16px; font-weight: bold; }
    .features { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; }
    .feature-item { padding: 10px 0; border-bottom: 1px solid #eee; }
    .feature-item:last-child { border-bottom: none; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="emoji">🎉</div>
      <h1>Your Account is Verified!</h1>
    </div>
    <div class="content">
      <p>Hi ${params.firstName},</p>

      <div class="success-box">
        <h3 style="margin-top: 0;">✓ Verification Complete</h3>
        <p>Congratulations! Your business profile has been reviewed and approved. You now have full access to BoxCostPro.</p>
      </div>

      <div class="features">
        <h3>What You Can Do Now:</h3>
        <div class="feature-item">📊 <strong>Access Your Dashboard</strong> - View business analytics and insights</div>
        <div class="feature-item">🧮 <strong>Use Box Calculator</strong> - Calculate costs and generate quotes instantly</div>
        <div class="feature-item">👥 <strong>Manage Customers</strong> - Add parties and track orders</div>
        <div class="feature-item">📈 <strong>View Reports</strong> - Analyze your business performance</div>
        <div class="feature-item">⚙️ <strong>Configure Settings</strong> - Customize pricing, email, and masters</div>
      </div>

      <center>
        <a href="${params.dashboardUrl}" class="button">Go to Dashboard →</a>
      </center>

      <p style="margin-top: 30px;">Need help getting started? Check out our <a href="#">Quick Start Guide</a> or contact support at support@boxcostpro.com.</p>
    </div>
    <div class="footer">
      <p>BoxCostPro | Simplify Box Costing & Quoting</p>
    </div>
  </div>
</body>
</html>`;
}

export function getUserVerificationApprovedEmailText(params: typeof getUserVerificationApprovedEmailHTML extends (p: infer P) => any ? P : never): string {
  return `YOUR ACCOUNT IS VERIFIED! 🎉

Hi ${params.firstName},

Congratulations! Your business profile has been reviewed and approved. You now have full access to BoxCostPro.

WHAT YOU CAN DO NOW:
📊 Access Your Dashboard - View business analytics and insights
🧮 Use Box Calculator - Calculate costs and generate quotes instantly
👥 Manage Customers - Add parties and track orders
📈 View Reports - Analyze your business performance
⚙️ Configure Settings - Customize pricing, email, and masters

Go to Dashboard: ${params.dashboardUrl}

Need help getting started? Contact support at support@boxcostpro.com.

---
BoxCostPro | Simplify Box Costing & Quoting`;
}

// ========== USER - VERIFICATION REJECTED ==========

export function getUserVerificationRejectedEmailHTML(params: {
  firstName: string;
  rejectionReason: string;
  setupUrl: string;
}): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #ff5722; color: white; padding: 20px; text-align: center; }
    .content { background: #f9f9f9; padding: 30px; border: 1px solid #ddd; }
    .warning-box { background: #fff3e0; padding: 20px; margin: 20px 0; border-left: 4px solid #ff9800; border-radius: 4px; }
    .reason-box { background: #ffebee; padding: 15px; margin: 15px 0; border-radius: 4px; }
    .button { display: inline-block; background: #2196F3; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Verification Needs Changes</h1>
    </div>
    <div class="content">
      <p>Hi ${params.firstName},</p>

      <div class="warning-box">
        <h3 style="margin-top: 0;">⚠️ Verification Not Approved</h3>
        <p>Our team has reviewed your business profile and found some issues that need to be addressed.</p>
      </div>

      <div class="reason-box">
        <p><strong>Reason for Rejection:</strong></p>
        <p>${params.rejectionReason}</p>
      </div>

      <h3>What to Do Next:</h3>
      <ol>
        <li>Review the rejection reason above</li>
        <li>Update the required information in your setup</li>
        <li>Resubmit for verification</li>
      </ol>

      <p>Once you've made the necessary changes, you can resubmit your profile for review. We typically respond within 24-48 hours.</p>

      <a href="${params.setupUrl}" class="button">Update & Resubmit</a>

      <p style="margin-top: 30px; color: #666; font-size: 14px;">Need clarification? Contact us at support@boxcostpro.com and reference your business email.</p>
    </div>
    <div class="footer">
      <p>BoxCostPro | Help: support@boxcostpro.com</p>
    </div>
  </div>
</body>
</html>`;
}

export function getUserVerificationRejectedEmailText(params: typeof getUserVerificationRejectedEmailHTML extends (p: infer P) => any ? P : never): string {
  return `VERIFICATION NEEDS CHANGES

Hi ${params.firstName},

Our team has reviewed your business profile and found some issues that need to be addressed.

REASON FOR REJECTION:
${params.rejectionReason}

WHAT TO DO NEXT:
1. Review the rejection reason above
2. Update the required information in your setup
3. Resubmit for verification

Once you've made the necessary changes, you can resubmit your profile for review. We typically respond within 24-48 hours.

Update & Resubmit: ${params.setupUrl}

Need clarification? Contact us at support@boxcostpro.com and reference your business email.

---
BoxCostPro | Help: support@boxcostpro.com`;
}
