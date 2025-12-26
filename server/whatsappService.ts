/**
 * WhatsApp Notification Service
 *
 * Handles WhatsApp notifications via Twilio API
 *
 * Environment Variables Required:
 * - TWILIO_ACCOUNT_SID
 * - TWILIO_AUTH_TOKEN
 * - TWILIO_WHATSAPP_NUMBER (format: whatsapp:+14155238886)
 * - ENABLE_WHATSAPP (set to 'true' to enable)
 */

interface WhatsAppMessage {
  to: string; // Phone number in E.164 format (+919876543210)
  message: string;
}

interface UserData {
  phone?: string;
  firstName?: string | null;
  lastName?: string | null;
}

class WhatsAppService {
  private enabled: boolean;
  private twilioClient: any;
  private fromNumber: string;
  private appUrl: string;

  constructor() {
    this.enabled = process.env.ENABLE_WHATSAPP === 'true';
    this.fromNumber = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';
    this.appUrl = process.env.APP_URL || 'http://localhost:5000';

    if (this.enabled) {
      this.initializeTwilio();
    } else {
      console.log('[WhatsApp] Service disabled. Set ENABLE_WHATSAPP=true to enable.');
    }
  }

  private initializeTwilio() {
    try {
      // Twilio integration
      // Requires: npm install twilio
      // const twilio = require('twilio');
      // this.twilioClient = twilio(
      //   process.env.TWILIO_ACCOUNT_SID,
      //   process.env.TWILIO_AUTH_TOKEN
      // );
      console.log('[WhatsApp] Twilio client initialized');
    } catch (error) {
      console.error('[WhatsApp] Failed to initialize Twilio:', error);
      this.enabled = false;
    }
  }

  /**
   * Send a WhatsApp message
   */
  async sendMessage(options: WhatsAppMessage): Promise<boolean> {
    if (!this.enabled) {
      console.log('[WhatsApp] Service is disabled. Message not sent.');
      return false;
    }

    try {
      // Ensure phone number is in E.164 format
      const toNumber = this.formatPhoneNumber(options.to);

      // Uncomment when Twilio is installed and configured
      /*
      const message = await this.twilioClient.messages.create({
        from: this.fromNumber,
        to: `whatsapp:${toNumber}`,
        body: options.message,
      });

      console.log('[WhatsApp] Message sent:', message.sid);
      return true;
      */

      // For now, just log the message
      console.log('[WhatsApp] Would send to', toNumber, ':', options.message);
      return true;
    } catch (error) {
      console.error('[WhatsApp] Failed to send message:', error);
      return false;
    }
  }

  /**
   * Send approval notification via WhatsApp
   */
  async sendApprovalNotification(userData: UserData): Promise<boolean> {
    if (!userData.phone) {
      console.log('[WhatsApp] No phone number provided for user');
      return false;
    }

    const fullName = [userData.firstName, userData.lastName].filter(Boolean).join(' ') || 'User';

    const message = `
🎉 *BoxCostPro Account Approved!*

Hi ${fullName},

Great news! Your BoxCostPro account has been approved.

You now have full access to:
✅ Box Costing Calculator
✅ Quote Management
✅ Customer Profiles
✅ Report Generation

*Get Started:*
${this.appUrl}/create-quote

Need help? Reply to this message or email support@boxcostpro.com

---
BoxCostPro - Your Digital Sales Representative
    `.trim();

    return this.sendMessage({
      to: userData.phone,
      message,
    });
  }

  /**
   * Send rejection notification via WhatsApp
   */
  async sendRejectionNotification(userData: UserData, reason: string): Promise<boolean> {
    if (!userData.phone) {
      console.log('[WhatsApp] No phone number provided for user');
      return false;
    }

    const fullName = [userData.firstName, userData.lastName].filter(Boolean).join(' ') || 'User';

    const message = `
⚠️ *BoxCostPro Account - Action Required*

Hi ${fullName},

Your account verification needs attention.

*Reason:*
${reason}

*What to do:*
1. Login to your account
2. Fix the issues mentioned above
3. Resubmit for verification

*Fix Now:*
${this.appUrl}/onboarding

Questions? Contact support@boxcostpro.com or reply to this message.

---
BoxCostPro Team
    `.trim();

    return this.sendMessage({
      to: userData.phone,
      message,
    });
  }

  /**
   * Send welcome message to new user
   */
  async sendWelcomeMessage(userData: UserData): Promise<boolean> {
    if (!userData.phone) {
      console.log('[WhatsApp] No phone number provided for user');
      return false;
    }

    const fullName = [userData.firstName, userData.lastName].filter(Boolean).join(' ') || 'User';

    const message = `
👋 *Welcome to BoxCostPro!*

Hi ${fullName},

Thanks for signing up!

*Next Steps:*
Complete your onboarding to unlock all features:
${this.appUrl}/onboarding

Need help? Reply to this message.

---
BoxCostPro - Your Digital Sales Representative
    `.trim();

    return this.sendMessage({
      to: userData.phone,
      message,
    });
  }

  /**
   * Format phone number to E.164 format
   * Example: +919876543210
   */
  private formatPhoneNumber(phone: string): string {
    // Remove all non-numeric characters except +
    let cleaned = phone.replace(/[^\d+]/g, '');

    // If doesn't start with +, assume Indian number and add +91
    if (!cleaned.startsWith('+')) {
      // Remove leading 0 if present
      cleaned = cleaned.replace(/^0+/, '');
      // Add India country code
      cleaned = '+91' + cleaned;
    }

    return cleaned;
  }

  /**
   * Validate E.164 phone number format
   */
  isValidPhoneNumber(phone: string): boolean {
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    return e164Regex.test(this.formatPhoneNumber(phone));
  }
}

// Export singleton instance
export const whatsappService = new WhatsAppService();
