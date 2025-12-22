export interface EmailProviderPreset {
  id: string;
  name: string;
  description: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  supportsOAuth: boolean;
  oauthProvider?: 'google';
  setupInstructions: string;
}

export const emailProviderPresets: Record<string, EmailProviderPreset> = {
  gmail: {
    id: 'gmail',
    name: 'Gmail (SMTP)',
    description: 'Use Gmail with App Password',
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    smtpSecure: false,
    supportsOAuth: false,
    setupInstructions: 'Create an App Password in your Google Account settings (Security → 2-Step Verification → App Passwords)'
  },
  google_oauth: {
    id: 'google_oauth',
    name: 'Google (OAuth)',
    description: 'Connect with Google - No password needed',
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    smtpSecure: false,
    supportsOAuth: true,
    oauthProvider: 'google',
    setupInstructions: 'Click "Connect with Google" to authorize email sending'
  },
  outlook: {
    id: 'outlook',
    name: 'Outlook / Microsoft 365',
    description: 'Use Microsoft Outlook or Office 365',
    smtpHost: 'smtp.office365.com',
    smtpPort: 587,
    smtpSecure: false,
    supportsOAuth: false,
    setupInstructions: 'Use your Microsoft account email and password. Enable "Less secure apps" or create an App Password if using 2FA.'
  },
  yahoo: {
    id: 'yahoo',
    name: 'Yahoo Mail',
    description: 'Use Yahoo Mail SMTP',
    smtpHost: 'smtp.mail.yahoo.com',
    smtpPort: 587,
    smtpSecure: false,
    supportsOAuth: false,
    setupInstructions: 'Generate an App Password in Yahoo Account Security settings'
  },
  zoho: {
    id: 'zoho',
    name: 'Zoho Mail',
    description: 'Use Zoho Mail for business',
    smtpHost: 'smtp.zoho.com',
    smtpPort: 587,
    smtpSecure: false,
    supportsOAuth: false,
    setupInstructions: 'Use your Zoho email address and password. Enable SMTP access in Zoho Mail settings.'
  },
  titan: {
    id: 'titan',
    name: 'Titan Email',
    description: 'Use Titan Email (by Flock)',
    smtpHost: 'smtp.titan.email',
    smtpPort: 587,
    smtpSecure: false,
    supportsOAuth: false,
    setupInstructions: 'Use your Titan email address and password'
  },
  custom: {
    id: 'custom',
    name: 'Custom SMTP',
    description: 'Enter your own SMTP settings',
    smtpHost: '',
    smtpPort: 587,
    smtpSecure: false,
    supportsOAuth: false,
    setupInstructions: 'Enter your SMTP server details provided by your email hosting provider'
  }
};

export function getProviderPreset(providerId: string): EmailProviderPreset | undefined {
  return emailProviderPresets[providerId];
}

export function getAllProviders(): EmailProviderPreset[] {
  return Object.values(emailProviderPresets);
}
