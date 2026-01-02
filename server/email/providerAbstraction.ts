/**
 * Email Provider Abstraction Layer
 * 
 * Unified interface for all email providers (SMTP, API, Webhook)
 * Supports: Gmail, SES, Zoho, Brevo, Pabbly, SendGrid, Mailgun, etc.
 */

export type ProviderType = 
  | 'gmail' 
  | 'ses' 
  | 'zoho' 
  | 'outlook' 
  | 'yahoo'
  | 'brevo' 
  | 'pabbly_webhook'
  | 'sendgrid'
  | 'mailgun'
  | 'postmark'
  | 'sparkpost'
  | 'mailjet'
  | 'smtp2go'
  | 'protonmail'
  | 'elastic_email'
  | 'netcore_pepipost'
  | 'rediffmail_pro'
  | 'custom_smtp';

export type ConnectionType = 'smtp' | 'api' | 'webhook';

export type EmailTaskType =
  | 'SYSTEM_EMAILS'
  | 'AUTH_EMAILS'
  | 'TRANSACTIONAL_EMAILS'
  | 'ONBOARDING_EMAILS'
  | 'NOTIFICATION_EMAILS'
  | 'MARKETING_EMAILS'
  | 'SUPPORT_EMAILS'
  | 'BILLING_EMAILS'
  | 'REPORT_EMAILS';

export type ProviderRole = 'primary' | 'secondary' | 'fallback';

export interface EmailProvider {
  id: string;
  providerType: ProviderType;
  providerName: string;
  connectionType: ConnectionType;
  fromName: string;
  fromEmail: string;
  replyToEmail?: string;
  
  // SMTP config
  smtpHost?: string;
  smtpPort?: number;
  smtpUsername?: string;
  smtpPasswordEncrypted?: string;
  smtpEncryption?: 'TLS' | 'SSL' | 'NONE';
  
  // API config
  apiEndpoint?: string;
  apiKeyEncrypted?: string;
  apiSecretEncrypted?: string;
  apiRegion?: string;
  
  // Provider-specific config
  configJson?: Record<string, any>;
  
  // Status
  isActive: boolean;
  isVerified: boolean;
  priorityOrder: number;
  role: ProviderRole;
  
  // Rate limiting
  maxEmailsPerHour?: number;
  maxEmailsPerDay?: number;
  currentHourlyCount: number;
  currentDailyCount: number;
  
  // Health
  lastUsedAt?: Date;
  lastTestAt?: Date;
  lastErrorAt?: Date;
  lastErrorMessage?: string;
  consecutiveFailures: number;
  totalSent: number;
  totalFailed: number;
  
  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

export interface EmailTaskRouting {
  id: string;
  taskType: EmailTaskType;
  taskDescription?: string;
  primaryProviderId?: string;
  fallbackProviderIds: string[];
  retryAttempts: number;
  retryDelaySeconds: number;
  maxSendAttempts: number;
  forceProviderId?: string;
  isEnabled: boolean;
}

export interface EmailMessage {
  to: string | string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
  text?: string;
  from?: { name: string; email: string };
  replyTo?: string;
  attachments?: EmailAttachment[];
  headers?: Record<string, string>;
  metadata?: Record<string, any>;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
  encoding?: string;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  providerId: string;
  providerName: string;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  attemptNumber: number;
  sentAt?: Date;
}

export interface FailoverResult extends SendResult {
  failoverOccurred: boolean;
  failoverFromProviderId?: string;
  failoverReason?: string;
  totalAttempts: number;
}

/**
 * Abstract Email Provider Adapter
 * All provider implementations must extend this
 */
export abstract class EmailProviderAdapter {
  protected provider: EmailProvider;
  
  constructor(provider: EmailProvider) {
    this.provider = provider;
  }
  
  /**
   * Send email using this provider
   */
  abstract send(message: EmailMessage): Promise<SendResult>;
  
  /**
   * Test provider connection (no actual send)
   */
  abstract test(): Promise<{ success: boolean; error?: string }>;
  
  /**
   * Get provider-specific capabilities
   */
  abstract getCapabilities(): {
    supportsAttachments: boolean;
    supportsHtml: boolean;
    supportsBulk: boolean;
    maxRecipientsPerEmail: number;
    maxAttachmentSize: number; // bytes
  };
  
  /**
   * Check if provider can send (rate limits, health)
   */
  canSend(): boolean {
    if (!this.provider.isActive) return false;
    if (this.provider.consecutiveFailures >= 10) return false;
    
    // Check rate limits
    if (this.provider.maxEmailsPerHour && 
        this.provider.currentHourlyCount >= this.provider.maxEmailsPerHour) {
      return false;
    }
    
    if (this.provider.maxEmailsPerDay && 
        this.provider.currentDailyCount >= this.provider.maxEmailsPerDay) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Get decrypted credentials
   */
  protected async getDecryptedPassword(): Promise<string> {
    if (!this.provider.smtpPasswordEncrypted) {
      throw new Error('No encrypted password configured');
    }
    const { decrypt } = await import('./encryption');
    return decrypt(this.provider.smtpPasswordEncrypted);
  }
  
  protected async getDecryptedApiKey(): Promise<string> {
    if (!this.provider.apiKeyEncrypted) {
      throw new Error('No encrypted API key configured');
    }
    const { decrypt } = await import('./encryption');
    return decrypt(this.provider.apiKeyEncrypted);
  }
  
  protected async getDecryptedApiSecret(): Promise<string> {
    if (!this.provider.apiSecretEncrypted) {
      throw new Error('No encrypted API secret configured');
    }
    const { decrypt } = await import('./encryption');
    return decrypt(this.provider.apiSecretEncrypted);
  }
}

/**
 * Provider Detection Utility
 */
export class ProviderDetector {
  /**
   * Detect provider type from email domain or SMTP host
   */
  static detectProviderType(email: string, smtpHost?: string): ProviderType {
    const domain = email.split('@')[1]?.toLowerCase();
    const host = smtpHost?.toLowerCase();
    
    // Gmail / Google Workspace
    if (domain === 'gmail.com' || host?.includes('smtp.gmail.com')) {
      return 'gmail';
    }
    
    // Microsoft / Outlook
    if (domain?.includes('outlook.') || domain?.includes('hotmail.') || 
        domain?.includes('live.') || host?.includes('smtp.office365.com')) {
      return 'outlook';
    }
    
    // Zoho
    if (domain?.includes('zoho.') || host?.includes('smtp.zoho.com')) {
      return 'zoho';
    }
    
    // Yahoo
    if (domain?.includes('yahoo.') || host?.includes('smtp.mail.yahoo.com')) {
      return 'yahoo';
    }
    
    // Rediffmail
    if (domain?.includes('rediffmail.') || host?.includes('smtp.rediffmail.com')) {
      return 'rediffmail_pro';
    }
    
    // ProtonMail
    if (domain?.includes('protonmail.') || domain?.includes('pm.me') || 
        host?.includes('smtp.protonmail.ch')) {
      return 'protonmail';
    }
    
    // AWS SES
    if (host?.includes('amazonaws.com') && host?.includes('email-smtp')) {
      return 'ses';
    }
    
    // SendGrid
    if (host?.includes('sendgrid.net')) {
      return 'sendgrid';
    }
    
    // Mailgun
    if (host?.includes('mailgun.org')) {
      return 'mailgun';
    }
    
    // Postmark
    if (host?.includes('postmarkapp.com')) {
      return 'postmark';
    }
    
    // SparkPost
    if (host?.includes('sparkpost.com')) {
      return 'sparkpost';
    }
    
    // Mailjet
    if (host?.includes('mailjet.com')) {
      return 'mailjet';
    }
    
    // SMTP2GO
    if (host?.includes('smtp2go.com')) {
      return 'smtp2go';
    }
    
    // Elastic Email
    if (host?.includes('elasticemail.com')) {
      return 'elastic_email';
    }
    
    // Brevo (Sendinblue)
    if (host?.includes('sendinblue.com') || host?.includes('brevo.com')) {
      return 'brevo';
    }
    
    // Netcore Pepipost
    if (host?.includes('pepipost.com')) {
      return 'netcore_pepipost';
    }
    
    // Default to custom SMTP
    return 'custom_smtp';
  }
  
  /**
   * Get provider preset configuration
   */
  static getProviderPreset(providerType: ProviderType): Partial<EmailProvider> {
    const presets: Record<ProviderType, Partial<EmailProvider>> = {
      gmail: {
        connectionType: 'smtp',
        smtpHost: 'smtp.gmail.com',
        smtpPort: 587,
        smtpEncryption: 'TLS',
      },
      outlook: {
        connectionType: 'smtp',
        smtpHost: 'smtp.office365.com',
        smtpPort: 587,
        smtpEncryption: 'TLS',
      },
      zoho: {
        connectionType: 'smtp',
        smtpHost: 'smtp.zoho.com',
        smtpPort: 587,
        smtpEncryption: 'TLS',
      },
      yahoo: {
        connectionType: 'smtp',
        smtpHost: 'smtp.mail.yahoo.com',
        smtpPort: 587,
        smtpEncryption: 'TLS',
      },
      rediffmail_pro: {
        connectionType: 'smtp',
        smtpHost: 'smtp.rediffmail.com',
        smtpPort: 587,
        smtpEncryption: 'TLS',
      },
      protonmail: {
        connectionType: 'smtp',
        smtpHost: 'smtp.protonmail.ch',
        smtpPort: 587,
        smtpEncryption: 'TLS',
      },
      ses: {
        connectionType: 'api',
        apiRegion: 'us-east-1',
        apiEndpoint: 'https://email.us-east-1.amazonaws.com',
      },
      brevo: {
        connectionType: 'api',
        apiEndpoint: 'https://api.brevo.com/v3/smtp/email',
      },
      sendgrid: {
        connectionType: 'api',
        apiEndpoint: 'https://api.sendgrid.com/v3/mail/send',
      },
      mailgun: {
        connectionType: 'api',
        apiEndpoint: 'https://api.mailgun.net/v3',
      },
      postmark: {
        connectionType: 'api',
        apiEndpoint: 'https://api.postmarkapp.com/email',
      },
      sparkpost: {
        connectionType: 'api',
        apiEndpoint: 'https://api.sparkpost.com/api/v1/transmissions',
      },
      mailjet: {
        connectionType: 'api',
        apiEndpoint: 'https://api.mailjet.com/v3.1/send',
      },
      smtp2go: {
        connectionType: 'smtp',
        smtpHost: 'mail.smtp2go.com',
        smtpPort: 587,
        smtpEncryption: 'TLS',
      },
      elastic_email: {
        connectionType: 'api',
        apiEndpoint: 'https://api.elasticemail.com/v2/email/send',
      },
      netcore_pepipost: {
        connectionType: 'api',
        apiEndpoint: 'https://api.pepipost.com/v5/mail/send',
      },
      pabbly_webhook: {
        connectionType: 'webhook',
        apiEndpoint: '', // User-provided webhook URL
      },
      custom_smtp: {
        connectionType: 'smtp',
        smtpPort: 587,
        smtpEncryption: 'TLS',
      },
    };
    
    return presets[providerType] || presets.custom_smtp;
  }
}
