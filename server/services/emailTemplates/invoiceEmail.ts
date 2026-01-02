/**
 * Invoice Email Template
 *
 * Sent with GST invoice PDF attachment after successful payment
 */

export interface InvoiceEmailParams {
  firstName: string;
  invoiceNumber: string;
  invoiceDate: string;
  amount: number;
  planName: string;
}

export function getInvoiceEmailHTML(params: InvoiceEmailParams): string {
  const { firstName, invoiceNumber, invoiceDate, amount, planName } = params;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Your GST Invoice - ${invoiceNumber}</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background: white; }
        .header { background: #28a745; color: white; padding: 40px 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; }
        .header p { margin: 10px 0 0; opacity: 0.9; }
        .content { padding: 40px 30px; }
        .invoice-box { background: #f9f9f9; border: 2px solid #28a745; border-radius: 8px; padding: 25px; margin: 25px 0; }
        .invoice-box h3 { margin-top: 0; color: #28a745; }
        .invoice-detail { display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #e0e0e0; }
        .invoice-detail:last-child { border-bottom: none; font-weight: bold; font-size: 16px; }
        .info-box { background: #e7f3ff; border-left: 4px solid #0066cc; padding: 15px; margin: 20px 0; color: #004085; }
        .footer { text-align: center; padding: 30px; background: #f8f9fa; color: #666; font-size: 13px; border-top: 1px solid #ddd; }
        .footer a { color: #28a745; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✓ Payment Successful</h1>
          <p>Your GST Invoice is Ready</p>
        </div>

        <div class="content">
          <p>Hi ${firstName},</p>

          <p>Thank you for your payment! Your subscription to <strong>${planName}</strong> is now active.</p>

          <div class="invoice-box">
            <h3>📄 Invoice Details</h3>
            <div class="invoice-detail">
              <span>Invoice Number:</span>
              <span>${invoiceNumber}</span>
            </div>
            <div class="invoice-detail">
              <span>Date:</span>
              <span>${invoiceDate}</span>
            </div>
            <div class="invoice-detail">
              <span>Amount Paid:</span>
              <span>₹${amount.toFixed(2)}</span>
            </div>
          </div>

          <div class="info-box">
            <strong>📎 Invoice Attached</strong><br>
            Your GST-compliant invoice is attached to this email as a PDF file. Please keep it for your records and tax filing purposes.
          </div>

          <h3>🧾 About Your Invoice</h3>
          <ul style="padding-left: 20px;">
            <li>The invoice includes GST breakdown (CGST+SGST or IGST based on your location)</li>
            <li>This is a valid tax invoice for claiming Input Tax Credit (ITC)</li>
            <li>Keep this invoice for your GST return filing</li>
            <li>You can download it anytime from your account dashboard</li>
          </ul>

          <h3>Need Help?</h3>
          <p>If you have any questions about this invoice or your subscription, please don't hesitate to contact us:</p>
          <p>📧 Email: <a href="mailto:support@boxcostpro.com" style="color: #28a745;">support@boxcostpro.com</a></p>

          <p style="margin-top: 40px;">Best regards,<br><strong>The BoxCostPro Team</strong></p>
        </div>

        <div class="footer">
          <p>This is an automated email. Please do not reply directly to this message.</p>
          <p style="margin-top: 10px;">© ${new Date().getFullYear()} BoxCostPro. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export function getInvoiceEmailText(params: InvoiceEmailParams): string {
  const { firstName, invoiceNumber, invoiceDate, amount, planName } = params;

  return `
Payment Successful - Your GST Invoice

Hi ${firstName},

Thank you for your payment! Your subscription to ${planName} is now active.

INVOICE DETAILS
---------------
Invoice Number: ${invoiceNumber}
Date: ${invoiceDate}
Amount Paid: ₹${amount.toFixed(2)}

INVOICE ATTACHED
----------------
Your GST-compliant invoice is attached to this email as a PDF file. Please keep it for your records and tax filing purposes.

ABOUT YOUR INVOICE
------------------
- The invoice includes GST breakdown (CGST+SGST or IGST based on your location)
- This is a valid tax invoice for claiming Input Tax Credit (ITC)
- Keep this invoice for your GST return filing
- You can download it anytime from your account dashboard

NEED HELP?
----------
If you have any questions about this invoice or your subscription, please contact us:
Email: support@boxcostpro.com

Best regards,
The BoxCostPro Team

---
This is an automated email. Please do not reply directly to this message.
© ${new Date().getFullYear()} BoxCostPro. All rights reserved.
  `;
}
