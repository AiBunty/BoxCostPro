/**
 * Welcome Email Template
 *
 * Sent after successful payment with Clerk magic link for first login
 */

export interface WelcomeEmailParams {
  firstName: string;
  email: string;
  temporaryPassword?: string; // For basic auth
  loginLink?: string; // Clerk magic link
  planName: string;
}

export function getWelcomeEmailHTML(params: WelcomeEmailParams): string {
  const { firstName, email, loginLink, temporaryPassword, planName } = params;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Welcome to BoxCostPro</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background: white; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; }
        .content { padding: 40px 30px; }
        .credentials-box { background: #f9f9f9; border: 2px solid #667eea; border-radius: 8px; padding: 25px; margin: 25px 0; }
        .credentials-box h3 { margin-top: 0; color: #667eea; }
        .btn { display: inline-block; background: #667eea; color: white; padding: 14px 35px; text-decoration: none; border-radius: 5px; margin-top: 20px; font-weight: bold; }
        .btn:hover { background: #5568d3; }
        .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; color: #856404; }
        .steps { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0; }
        .steps ul { margin: 10px 0; padding-left: 20px; }
        .steps li { margin: 8px 0; }
        .footer { text-align: center; padding: 30px; background: #f8f9fa; color: #666; font-size: 13px; border-top: 1px solid #ddd; }
        .footer a { color: #667eea; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to BoxCostPro! 🎉</h1>
          <p style="margin: 10px 0 0; opacity: 0.9;">Your account is ready to use</p>
        </div>

        <div class="content">
          <p>Hi ${firstName},</p>

          <p>Congratulations! Your payment has been processed successfully, and you're now subscribed to our <strong>${planName}</strong> plan.</p>

          <p>We're excited to help you streamline your packaging quotation process and grow your business!</p>

          <div class="credentials-box">
            <h3>🔐 ${loginLink ? 'Set Up Your Account' : 'Your Login Credentials'}</h3>
            <p><strong>Your Email:</strong> ${email}</p>
            ${temporaryPassword ? `
              <p><strong>Temporary Password:</strong> <code style="background: #f0f0f0; padding: 5px 10px; border-radius: 3px;">${temporaryPassword}</code></p>
              <p style="color: #d9534f; font-size: 14px;"><strong>⚠️ Important:</strong> Please change your password after logging in for the first time.</p>
              <a href="${process.env.APP_URL || 'http://localhost:5000'}/auth" class="btn">Login to Your Account</a>
            ` : `
              <p style="margin-top: 15px;">Click the button below to set up your password and access your account:</p>
              <a href="${loginLink}" class="btn">Set Up Your Password</a>
              <p style="margin-top: 15px; font-size: 13px; color: #666;">
                <em>⚠️ This link expires in 24 hours. If expired, you can request a new magic link from the login page.</em>
              </p>
            `}
          </div>

          <div class="steps">
            <h3 style="margin-top: 0;">✨ What's Next?</h3>
            <ul>
              ${temporaryPassword ? `
                <li>Log in using your email and temporary password above</li>
                <li>Change your password in account settings</li>
              ` : `
                <li>Click the button above to set your password</li>
                <li>Log in to your new account</li>
              `}
              <li>Complete your business profile setup (paper pricing, flute settings, etc.)</li>
              <li>Start creating professional quotes for your customers</li>
            </ul>
          </div>

          <h3>📧 Your Invoice</h3>
          <p>Your GST invoice has been sent in a separate email. Please keep it for your records and tax filing purposes.</p>

          <h3>Need Help?</h3>
          <p>If you have any questions or need assistance, our support team is here to help:</p>
          <p>📧 Email: <a href="mailto:support@boxcostpro.com" style="color: #667eea;">support@boxcostpro.com</a></p>

          <p style="margin-top: 40px;">Best regards,<br><strong>The BoxCostPro Team</strong></p>
        </div>

        <div class="footer">
          <p>This email was sent to ${email} because you signed up for BoxCostPro.</p>
          <p style="margin-top: 10px;">© ${new Date().getFullYear()} BoxCostPro. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export function getWelcomeEmailText(params: WelcomeEmailParams): string {
  const { firstName, email, loginLink, temporaryPassword, planName } = params;

  return `
Welcome to BoxCostPro!

Hi ${firstName},

Congratulations! Your payment has been processed successfully, and you're now subscribed to our ${planName} plan.

We're excited to help you streamline your packaging quotation process and grow your business!

${temporaryPassword ? `YOUR LOGIN CREDENTIALS
---------------------
Your Email: ${email}
Temporary Password: ${temporaryPassword}

⚠️ IMPORTANT: Please change your password after logging in for the first time.

Login here: ${process.env.APP_URL || 'http://localhost:5000'}/auth
` : `SET UP YOUR ACCOUNT
-------------------
Your Email: ${email}

Click the link below to set up your password and access your account:
${loginLink}

⚠️ IMPORTANT: This link expires in 24 hours. If expired, you can request a new magic link from the login page.
`}
WHAT'S NEXT?
------------
${temporaryPassword ? `1. Log in using your email and temporary password above
2. Change your password in account settings
3. Complete your business profile setup (paper pricing, flute settings, etc.)
4. Start creating professional quotes for your customers` : `1. Click the link above to set your password
2. Log in to your new account
3. Complete your business profile setup (paper pricing, flute settings, etc.)
4. Start creating professional quotes for your customers`}

YOUR INVOICE
------------
Your GST invoice has been sent in a separate email. Please keep it for your records and tax filing purposes.

NEED HELP?
----------
If you have any questions or need assistance, our support team is here to help:
Email: support@boxcostpro.com

Best regards,
The BoxCostPro Team

---
This email was sent to ${email} because you signed up for BoxCostPro.
© ${new Date().getFullYear()} BoxCostPro. All rights reserved.
  `;
}
