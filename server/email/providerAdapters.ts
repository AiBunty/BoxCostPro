/**
 * Email Provider Adapter Implementations
 * 
 * Concrete implementations for:
 * - Gmail SMTP
 * - Amazon SES API
 * - Pabbly Webhook
 * - Generic SMTP
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { 
  EmailProviderAdapter, 
  EmailMessage, 
  SendResult,
  type EmailProvider 
} from './providerAbstraction';

/**
 * Gmail SMTP Adapter
 */
export class GmailAdapter extends EmailProviderAdapter {
  private transporter?: Transporter;
  
  async send(message: EmailMessage): Promise<SendResult> {
    try {
      const transporter = await this.getTransporter();
      const password = await this.getDecryptedPassword();
      
      const info = await transporter.sendMail({
        from: message.from 
          ? `"${message.from.name}" <${message.from.email}>`
          : `"${this.provider.fromName}" <${this.provider.fromEmail}>`,
        to: Array.isArray(message.to) ? message.to.join(', ') : message.to,
        cc: message.cc?.join(', '),
        bcc: message.bcc?.join(', '),
        replyTo: message.replyTo || this.provider.replyToEmail,
        subject: message.subject,
        html: message.html,
        text: message.text || message.html.replace(/<[^>]*>/g, ''),
        attachments: message.attachments,
        headers: message.headers,
      });
      
      return {
        success: true,
        messageId: info.messageId,
        providerId: this.provider.id,
        providerName: this.provider.providerName,
        attemptNumber: 1,
        sentAt: new Date(),
      };
    } catch (error: any) {
      return {
        success: false,
        providerId: this.provider.id,
        providerName: this.provider.providerName,
        attemptNumber: 1,
        error: {
          code: error.code || 'GMAIL_ERROR',
          message: error.message || 'Failed to send via Gmail',
          details: error,
        },
      };
    }
  }
  
  async test(): Promise<{ success: boolean; error?: string }> {
    try {
      const transporter = await this.getTransporter();
      await transporter.verify();
      return { success: true };
    } catch (error: any) {
      return { 
        success: false, 
        error: `Gmail SMTP test failed: ${error.message}` 
      };
    }
  }
  
  getCapabilities() {
    return {
      supportsAttachments: true,
      supportsHtml: true,
      supportsBulk: false,
      maxRecipientsPerEmail: 100,
      maxAttachmentSize: 25 * 1024 * 1024, // 25MB
    };
  }
  
  private async getTransporter(): Promise<Transporter> {
    if (this.transporter) return this.transporter;
    
    const password = await this.getDecryptedPassword();
    
    this.transporter = nodemailer.createTransporter({
      host: this.provider.smtpHost,
      port: this.provider.smtpPort,
      secure: this.provider.smtpEncryption === 'SSL',
      auth: {
        user: this.provider.smtpUsername,
        pass: password,
      },
      tls: {
        rejectUnauthorized: true,
      },
    });
    
    return this.transporter;
  }
}

/**
 * Amazon SES API Adapter
 */
export class SESAdapter extends EmailProviderAdapter {
  async send(message: EmailMessage): Promise<SendResult> {
    try {
      // Import AWS SDK v3
      const { SESv2Client, SendEmailCommand } = await import('@aws-sdk/client-sesv2');
      
      const apiKey = await this.getDecryptedApiKey();
      const apiSecret = await this.getDecryptedApiSecret();
      
      const client = new SESv2Client({
        region: this.provider.apiRegion || 'us-east-1',
        credentials: {
          accessKeyId: apiKey,
          secretAccessKey: apiSecret,
        },
      });
      
      const command = new SendEmailCommand({
        FromEmailAddress: message.from?.email || this.provider.fromEmail,
        Destination: {
          ToAddresses: Array.isArray(message.to) ? message.to : [message.to],
          CcAddresses: message.cc,
          BccAddresses: message.bcc,
        },
        Content: {
          Simple: {
            Subject: {
              Data: message.subject,
              Charset: 'UTF-8',
            },
            Body: {
              Html: {
                Data: message.html,
                Charset: 'UTF-8',
              },
              Text: message.text ? {
                Data: message.text,
                Charset: 'UTF-8',
              } : undefined,
            },
          },
        },
        ReplyToAddresses: message.replyTo ? [message.replyTo] : undefined,
      });
      
      const response = await client.send(command);
      
      return {
        success: true,
        messageId: response.MessageId,
        providerId: this.provider.id,
        providerName: this.provider.providerName,
        attemptNumber: 1,
        sentAt: new Date(),
      };
    } catch (error: any) {
      return {
        success: false,
        providerId: this.provider.id,
        providerName: this.provider.providerName,
        attemptNumber: 1,
        error: {
          code: error.Code || 'SES_ERROR',
          message: error.message || 'Failed to send via Amazon SES',
          details: error,
        },
      };
    }
  }
  
  async test(): Promise<{ success: boolean; error?: string }> {
    try {
      const { SESv2Client, GetAccountCommand } = await import('@aws-sdk/client-sesv2');
      
      const apiKey = await this.getDecryptedApiKey();
      const apiSecret = await this.getDecryptedApiSecret();
      
      const client = new SESv2Client({
        region: this.provider.apiRegion || 'us-east-1',
        credentials: {
          accessKeyId: apiKey,
          secretAccessKey: apiSecret,
        },
      });
      
      await client.send(new GetAccountCommand({}));
      return { success: true };
    } catch (error: any) {
      return { 
        success: false, 
        error: `SES API test failed: ${error.message}` 
      };
    }
  }
  
  getCapabilities() {
    return {
      supportsAttachments: true,
      supportsHtml: true,
      supportsBulk: true,
      maxRecipientsPerEmail: 50,
      maxAttachmentSize: 10 * 1024 * 1024, // 10MB
    };
  }
}

/**
 * Pabbly Webhook Adapter
 */
export class PabblyWebhookAdapter extends EmailProviderAdapter {
  async send(message: EmailMessage): Promise<SendResult> {
    try {
      const webhookUrl = this.provider.apiEndpoint;
      if (!webhookUrl) {
        throw new Error('Webhook URL not configured');
      }
      
      const payload = {
        from: {
          name: message.from?.name || this.provider.fromName,
          email: message.from?.email || this.provider.fromEmail,
        },
        to: Array.isArray(message.to) ? message.to : [message.to],
        cc: message.cc,
        bcc: message.bcc,
        subject: message.subject,
        html: message.html,
        text: message.text,
        replyTo: message.replyTo || this.provider.replyToEmail,
        metadata: message.metadata,
      };
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        throw new Error(`Webhook returned ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      return {
        success: true,
        messageId: result.messageId || `pabbly-${Date.now()}`,
        providerId: this.provider.id,
        providerName: this.provider.providerName,
        attemptNumber: 1,
        sentAt: new Date(),
      };
    } catch (error: any) {
      return {
        success: false,
        providerId: this.provider.id,
        providerName: this.provider.providerName,
        attemptNumber: 1,
        error: {
          code: 'WEBHOOK_ERROR',
          message: error.message || 'Failed to send via Pabbly webhook',
          details: error,
        },
      };
    }
  }
  
  async test(): Promise<{ success: boolean; error?: string }> {
    try {
      const webhookUrl = this.provider.apiEndpoint;
      if (!webhookUrl) {
        return { success: false, error: 'Webhook URL not configured' };
      }
      
      // Send test ping
      const response = await fetch(webhookUrl, {
        method: 'HEAD',
      });
      
      if (response.ok || response.status === 405) { // 405 = Method Not Allowed is OK
        return { success: true };
      }
      
      return { 
        success: false, 
        error: `Webhook unreachable: ${response.status}` 
      };
    } catch (error: any) {
      return { 
        success: false, 
        error: `Webhook test failed: ${error.message}` 
      };
    }
  }
  
  getCapabilities() {
    return {
      supportsAttachments: false, // Webhooks typically don't support attachments
      supportsHtml: true,
      supportsBulk: false,
      maxRecipientsPerEmail: 100,
      maxAttachmentSize: 0,
    };
  }
}

/**
 * Generic SMTP Adapter
 * Works with any SMTP provider (Zoho, Outlook, Yahoo, custom, etc.)
 */
export class GenericSMTPAdapter extends EmailProviderAdapter {
  private transporter?: Transporter;
  
  async send(message: EmailMessage): Promise<SendResult> {
    try {
      const transporter = await this.getTransporter();
      
      const info = await transporter.sendMail({
        from: message.from 
          ? `"${message.from.name}" <${message.from.email}>`
          : `"${this.provider.fromName}" <${this.provider.fromEmail}>`,
        to: Array.isArray(message.to) ? message.to.join(', ') : message.to,
        cc: message.cc?.join(', '),
        bcc: message.bcc?.join(', '),
        replyTo: message.replyTo || this.provider.replyToEmail,
        subject: message.subject,
        html: message.html,
        text: message.text || message.html.replace(/<[^>]*>/g, ''),
        attachments: message.attachments,
        headers: message.headers,
      });
      
      return {
        success: true,
        messageId: info.messageId,
        providerId: this.provider.id,
        providerName: this.provider.providerName,
        attemptNumber: 1,
        sentAt: new Date(),
      };
    } catch (error: any) {
      return {
        success: false,
        providerId: this.provider.id,
        providerName: this.provider.providerName,
        attemptNumber: 1,
        error: {
          code: error.code || 'SMTP_ERROR',
          message: error.message || 'Failed to send via SMTP',
          details: error,
        },
      };
    }
  }
  
  async test(): Promise<{ success: boolean; error?: string }> {
    try {
      const transporter = await this.getTransporter();
      await transporter.verify();
      return { success: true };
    } catch (error: any) {
      return { 
        success: false, 
        error: `SMTP test failed: ${error.message}` 
      };
    }
  }
  
  getCapabilities() {
    return {
      supportsAttachments: true,
      supportsHtml: true,
      supportsBulk: false,
      maxRecipientsPerEmail: 100,
      maxAttachmentSize: 25 * 1024 * 1024, // 25MB
    };
  }
  
  private async getTransporter(): Promise<Transporter> {
    if (this.transporter) return this.transporter;
    
    const password = await this.getDecryptedPassword();
    
    this.transporter = nodemailer.createTransporter({
      host: this.provider.smtpHost,
      port: this.provider.smtpPort,
      secure: this.provider.smtpEncryption === 'SSL',
      auth: {
        user: this.provider.smtpUsername,
        pass: password,
      },
      tls: {
        rejectUnauthorized: this.provider.smtpEncryption === 'TLS',
      },
    });
    
    return this.transporter;
  }
}

/**
 * Provider Adapter Factory
 * Creates appropriate adapter based on provider type
 */
export class ProviderAdapterFactory {
  static createAdapter(provider: EmailProvider): EmailProviderAdapter {
    switch (provider.providerType) {
      case 'gmail':
        return new GmailAdapter(provider);
      
      case 'ses':
        return new SESAdapter(provider);
      
      case 'pabbly_webhook':
        return new PabblyWebhookAdapter(provider);
      
      // All other SMTP providers use generic adapter
      case 'zoho':
      case 'outlook':
      case 'yahoo':
      case 'rediffmail_pro':
      case 'protonmail':
      case 'smtp2go':
      case 'custom_smtp':
      default:
        return new GenericSMTPAdapter(provider);
    }
  }
}
