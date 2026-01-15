/**
 * Email Page - Admin-Exclusive Email Provider Management
 * This is INDEPENDENT from user email setup - admin system-wide providers
 * 
 * Features:
 * - Add/manage MULTIPLE email providers
 * - Set active/primary provider
 * - Test email delivery
 * - View delivery logs
 * 
 * NEVER renders blank
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Toaster, toast } from '../../components/Toast';

// Supported email provider types
type ProviderType = 'smtp' | 'sendgrid' | 'mailgun' | 'ses' | 'postmark' | 'resend';

interface EmailProvider {
  id: string;
  name: string;
  type: ProviderType;
  status: 'active' | 'inactive' | 'error';
  priority: number;
  host?: string;
  port?: number;
  username?: string;
  apiKey?: string;
  fromEmail?: string;
  fromName?: string;
  createdAt: string;
}

// Provider status badge
function ProviderStatusBadge({ status, isPrimary, isVerified }: { status?: string; isPrimary?: boolean; isVerified?: boolean }) {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    inactive: 'bg-gray-100 text-gray-800',
    error: 'bg-red-100 text-red-800',
  };
  const safeStatus = (status || 'inactive').toLowerCase();
  const label = safeStatus.charAt(0).toUpperCase() + safeStatus.slice(1);
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[safeStatus] || colors.inactive}`}>
        {label}
      </span>
      {isPrimary && (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
          Primary
        </span>
      )}
      {isVerified && (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
          Verified
        </span>
      )}
    </div>
  );
}

// Delivery status badge
function DeliveryStatusBadge({ status }: { status?: string }) {
  const colors: Record<string, string> = {
    sent: 'bg-green-100 text-green-800',
    delivered: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    deferred: 'bg-yellow-100 text-yellow-800',
    bounced: 'bg-orange-100 text-orange-800',
  };
  const safe = (status || 'sent').toLowerCase();
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[safe] || 'bg-gray-100 text-gray-800'}`}>
      {safe.charAt(0).toUpperCase() + safe.slice(1)}
    </span>
  );
}

// Email Domain Validator
function getEmailDomain(email: string): string {
  return email.includes('@') ? email.split('@')[1].toLowerCase() : '';
}

function validateFromEmailDomain(fromEmail: string, providerType: ProviderType, username: string): { valid: boolean; error?: string; warning?: string } {
  // SendGrid and SES allow any verified domain (must be verified in their console first)
  if (providerType === 'sendgrid') {
    if (!fromEmail.includes('@')) {
      return { valid: false, error: 'Invalid From Email address' };
    }
    return { 
      valid: true, 
      warning: 'Domain must be verified in SendGrid console'
    };
  }

  if (providerType === 'ses') {
    if (!fromEmail.includes('@')) {
      return { valid: false, error: 'Invalid From Email address' };
    }
    return { 
      valid: true, 
      warning: 'Domain must be verified in AWS SES console'
    };
  }

  // For SMTP providers, FROM domain must match username domain (CRITICAL for deliverability)
  if (providerType === 'smtp') {
    const fromDomain = getEmailDomain(fromEmail);
    const usernameDomain = getEmailDomain(username);
    
    if (!fromEmail.includes('@')) {
      return { valid: false, error: 'Invalid From Email address' };
    }

    if (!username.includes('@')) {
      return { valid: false, error: 'Invalid SMTP username - must be email address' };
    }
    
    if (fromDomain !== usernameDomain) {
      return { 
        valid: false, 
        error: `⚠️ CRITICAL: From Email domain (@${fromDomain}) must match SMTP username domain (@${usernameDomain}). Mail servers will reject mismatched domains.`
      };
    }
  }

  return { valid: true };
}

// Add Provider Modal
function AddProviderModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  isSubmitting: boolean;
}) {
  const [providerType, setProviderType] = useState<ProviderType>('smtp');
  const [smtpPreset, setSmtpPreset] = useState('gmail');
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [testError, setTestError] = useState('');
  const [validationError, setValidationError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    host: '',
    port: '587',
    username: '',
    password: '',
    apiKey: '',
    fromEmail: '',
    fromName: '',
  });

  // Provider Presets Configuration
  const PROVIDER_PRESETS: Record<string, Record<string, { host?: string; port?: number; username?: string; note: string }>> = {
    smtp: {
      gmail: { 
        host: 'smtp.gmail.com', 
        port: 587,
        note: 'Use App Password, not your Gmail password'
      },
      outlook: { 
        host: 'smtp.office365.com', 
        port: 587,
        note: 'Supports Microsoft 365 accounts'
      },
      zoho: { 
        host: 'smtp.zoho.in', 
        port: 587,
        note: 'Use Zoho mail credentials'
      },
      titan: { 
        host: 'smtp.titan.email', 
        port: 587,
        note: 'Professional email hosting'
      },
      yahoo: { 
        host: 'smtp.mail.yahoo.com', 
        port: 587,
        note: 'Requires App Password'
      },
      custom: { 
        host: '',
        port: 587,
        note: 'Enter custom SMTP server details'
      },
    },
    sendgrid: {
      default: {
        host: 'smtp.sendgrid.net',
        port: 587,
        username: 'apikey',
        note: 'Use "apikey" as username, paste API key as password'
      },
    },
    ses: {
      default: {
        host: 'email-smtp.{region}.amazonaws.com',
        port: 587,
        note: 'Use SMTP credentials from AWS SES (not IAM access keys)'
      },
    },
  };

  const SMTP_PRESETS: Record<string, { host: string; port: number; fromName: string; note?: string }> = {
    gmail: { 
      host: 'smtp.gmail.com', 
      port: 587, 
      fromName: 'Gmail/Google Workspace',
      note: 'Use App Password (not your Gmail login password)'
    },
    outlook: { 
      host: 'smtp.office365.com', 
      port: 587, 
      fromName: 'Outlook/Hotmail/Microsoft 365'
    },
    zoho: { 
      host: 'smtp.zoho.in', 
      port: 587, 
      fromName: 'Zoho Mail'
    },
    titan: { 
      host: 'smtp.titan.email', 
      port: 587, 
      fromName: 'Titan Email'
    },
    yahoo: { 
      host: 'smtp.mail.yahoo.com', 
      port: 587, 
      fromName: 'Yahoo Mail'
    },
    custom: { 
      host: '', 
      port: 587, 
      fromName: 'Custom SMTP'
    },
  };

  const handleSmtpPresetChange = (preset: string) => {
    setSmtpPreset(preset);
    setValidationError('');
    setTestError('');
    const config = PROVIDER_PRESETS['smtp'][preset];
    setFormData({
      ...formData,
      host: config.host || '',
      port: config.port?.toString() || '587',
    });
  };

  const handleProviderTypeChange = (type: ProviderType) => {
    setProviderType(type);
    setValidationError('');
    setTestError('');
    if (type === 'sendgrid' && smtpPreset !== 'default') {
      setSmtpPreset('default');
      const config = PROVIDER_PRESETS['sendgrid']['default'];
      setFormData(prev => ({
        ...prev,
        username: config.username || '',
      }));
    } else if (type === 'ses' && smtpPreset !== 'default') {
      setSmtpPreset('default');
    }
  };

  const handleTestSmtp = async (e: React.MouseEvent) => {
    e.preventDefault();
    setTestError('');
    
    // Validate required fields
    if (!formData.host || !formData.port || !formData.username || !formData.password || !formData.fromEmail) {
      setTestError('All fields required: Host, Port, Username, Password, From Email');
      return;
    }

    setTestingSmtp(true);
    try {
      const res = await fetch('/api/admin/email/test-smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          host: formData.host,
          port: parseInt(formData.port),
          username: formData.username,
          password: formData.password,
          secure: false,
        }),
      });

      const text = await res.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch {
        console.error('Non-JSON response:', text.substring(0, 200));
        setTestError(`Server returned invalid response: ${res.status} ${res.statusText}`);
        return;
      }

      if (!res.ok) {
        setTestError(result.error || `Request failed: ${res.status}`);
        return;
      }

      if (result.success) {
        setTestError('');
        toast.success('✓ SMTP connection successful!');
      } else {
        setTestError(result.error || 'Connection test failed');
      }
    } catch (err: any) {
      setTestError(err.message || 'Network error');
    } finally {
      setTestingSmtp(false);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');
    setTestError('');

    // Validate FROM email domain matches SMTP domain
    const validation = validateFromEmailDomain(formData.fromEmail, providerType, formData.username);
    if (!validation.valid) {
      setValidationError(validation.error || 'Invalid email configuration');
      return;
    }

    // Warn about SendGrid/SES domain verification
    if ((providerType === 'sendgrid' || providerType === 'ses') && validation.warning) {
      // Still allow submission but user should know about warning
      console.warn('Domain verification warning:', validation.warning);
    }

    // All validations passed - submit in backend field names
    onSubmit({
      providerType,
      providerName: formData.name || formData.fromName || providerType.toUpperCase(),
      fromEmail: formData.fromEmail,
      fromName: formData.fromName || formData.name,
      connectionType: providerType === 'smtp' ? 'smtp' : 'api',
      smtpHost: providerType === 'smtp' ? formData.host : undefined,
      smtpPort: providerType === 'smtp' ? parseInt(formData.port) : undefined,
      smtpUsername: formData.username || undefined,
      smtpPassword: providerType === 'smtp' ? formData.password || undefined : undefined,
      apiKey: providerType !== 'smtp' ? formData.password || formData.apiKey : undefined,
      isActive: true,
    });
  };

  const providerOptions: { value: ProviderType; label: string }[] = [
    { value: 'smtp', label: 'SMTP Server' },
    { value: 'sendgrid', label: 'SendGrid' },
    { value: 'mailgun', label: 'Mailgun' },
    { value: 'ses', label: 'Amazon SES' },
    { value: 'postmark', label: 'Postmark' },
    { value: 'resend', label: 'Resend' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Add Email Provider</h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Provider Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Provider Type
            </label>
            <select
              value={providerType}
              onChange={(e) => handleProviderTypeChange(e.target.value as ProviderType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {providerOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Provider Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Display Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => {
                const newName = e.target.value;
                setFormData({ 
                  ...formData, 
                  name: newName,
                  // Auto-populate fromName if it's empty or was auto-filled
                  fromName: formData.fromName === '' || formData.fromName === formData.name ? newName : formData.fromName
                });
              }}
              placeholder="e.g., Primary SMTP Server"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* SMTP-specific fields */}
          {providerType === 'smtp' && (
            <>
              {/* SMTP Provider Preset */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Provider Preset (Optional)
                </label>
                <select
                  value={smtpPreset}
                  onChange={(e) => handleSmtpPresetChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="gmail">Gmail / Google Workspace</option>
                  <option value="outlook">Outlook / Hotmail / Microsoft 365</option>
                  <option value="zoho">Zoho Mail</option>
                  <option value="titan">Titan Email</option>
                  <option value="yahoo">Yahoo Mail</option>
                  <option value="custom">Custom SMTP</option>
                </select>
                {smtpPreset !== 'custom' && PROVIDER_PRESETS.smtp[smtpPreset] && (
                  <p className="text-xs text-amber-600 mt-1">
                    ⚠️ {PROVIDER_PRESETS.smtp[smtpPreset].note}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    SMTP Host
                  </label>
                  <input
                    type="text"
                    value={formData.host}
                    onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                    placeholder="smtp.example.com"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Port
                  </label>
                  <input
                    type="number"
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                    placeholder="587"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username / Email
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => {
                    const newUsername = e.target.value;
                    setFormData({ 
                      ...formData, 
                      username: newUsername,
                      // Auto-populate fromEmail if it's empty or was auto-filled
                      fromEmail: formData.fromEmail === '' || formData.fromEmail === formData.username ? newUsername : formData.fromEmail
                    });
                  }}
                  placeholder="user@example.com"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password / App Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                    required
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {smtpPreset === 'gmail' && (
                  <p className="text-xs text-gray-500 mt-1">
                    Generate an <a href="https://support.google.com/accounts/answer/185833" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">App Password</a>
                  </p>
                )}
              </div>

              {/* Test SMTP Connection Button */}
              <div>
                <button
                  onClick={handleTestSmtp}
                  disabled={testingSmtp}
                  className="w-full px-4 py-2 text-sm font-medium text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {testingSmtp ? 'Testing Connection...' : 'Test SMTP Connection'}
                </button>
                {testError && (
                  <p className="text-xs text-red-600 mt-2 p-2 bg-red-50 rounded">
                    {testError}
                  </p>
                )}
              </div>
            </>
          )}

          {/* SendGrid specific fields */}
          {providerType === 'sendgrid' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API Key (use as password) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="SG.xxxxxxxxxxxxx"
                    required
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                    title={showPassword ? "Hide API key" : "Show API key"}
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  📋 Get API key from <a href="https://app.sendgrid.com/settings/api_keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">SendGrid Dashboard</a>
                </p>
                <p className="text-xs text-amber-600 mt-1">
                  ⚠️ Ensure your domain is verified in SendGrid
                </p>
              </div>
              {/* Test SendGrid */}
              <div>
                <button
                  onClick={async (e) => {
                    e.preventDefault();
                    setTestError('');
                    if (!formData.password || !formData.fromEmail) {
                      setTestError('API Key and From Email required');
                      return;
                    }
                    setTestingSmtp(true);
                    try {
                      const res = await fetch('/api/admin/email/test-smtp', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({
                          host: 'smtp.sendgrid.net',
                          port: 587,
                          username: 'apikey',
                          password: formData.password,
                          secure: false,
                        }),
                      });
                      const text = await res.text();
                      let result;
                      try {
                        result = JSON.parse(text);
                      } catch {
                        console.error('Non-JSON response:', text.substring(0, 200));
                        setTestError(`Server returned invalid response: ${res.status}`);
                        return;
                      }
                      if (res.ok) {
                        alert('SendGrid connection successful! ✓');
                      } else {
                        setTestError(result.error || `Connection failed: ${res.status}`);
                      }
                    } catch (err: any) {
                      setTestError(err.message);
                    } finally {
                      setTestingSmtp(false);
                    }
                  }}
                  disabled={testingSmtp}
                  className="w-full px-4 py-2 text-sm font-medium text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {testingSmtp ? 'Testing Connection...' : 'Test SendGrid Connection'}
                </button>
                {testError && (
                  <p className="text-xs text-red-600 mt-2 p-2 bg-red-50 rounded">
                    ❌ {testError}
                  </p>
                )}
              </div>
            </>
          )}

          {/* Amazon SES specific fields */}
          {providerType === 'ses' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SMTP Region Endpoint <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.host}
                  onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                  placeholder="email-smtp.us-east-1.amazonaws.com"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  📋 From AWS Console → SES → SMTP Settings → Server Name
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Username <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="AKIA..."
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Password <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => {
                        // Auto-remove spaces (Gmail App Passwords have spaces when copied)
                        const cleanedPassword = e.target.value.replace(/\s+/g, '');
                        setFormData({ ...formData, password: cleanedPassword });
                      }}
                      onPaste={(e) => {
                        // Remove spaces from pasted content (common with Gmail App Passwords)
                        e.preventDefault();
                        const pastedText = e.clipboardData.getData('text');
                        const cleanedPassword = pastedText.replace(/\s+/g, '');
                        setFormData({ ...formData, password: cleanedPassword });
                      }}
                      placeholder="••••••••"
                      required
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {smtpPreset === 'gmail' && (
                    <p className="text-xs text-blue-600 mt-1">
                      💡 Paste your 16-character Gmail App Password. Spaces are removed automatically.
                    </p>
                  )}
                </div>
              </div>
              <p className="text-xs text-amber-600 -mt-2">
                ⚠️ Use SMTP credentials from AWS Console, NOT IAM access keys
              </p>
              {/* Test SES */}
              <div>
                <button
                  onClick={handleTestSmtp}
                  disabled={testingSmtp}
                  className="w-full px-4 py-2 text-sm font-medium text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {testingSmtp ? 'Testing Connection...' : 'Test SES Connection'}
                </button>
                {testError && (
                  <p className="text-xs text-red-600 mt-2 p-2 bg-red-50 rounded">
                    ❌ {testError}
                  </p>
                )}
              </div>
            </>
          )}

          {/* Sender Info */}
          <div className="pt-4 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Sender Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  From Email <span className="text-red-500">*</span>
                  {formData.fromEmail === formData.username && formData.username && (
                    <span className="text-xs text-blue-600 ml-2">(Auto-filled)</span>
                  )}
                </label>
                <input
                  type="email"
                  value={formData.fromEmail}
                  onChange={(e) => {
                    setFormData({ ...formData, fromEmail: e.target.value });
                    setValidationError('');
                  }}
                  placeholder="noreply@yourdomain.com"
                  required
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                    validationError ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                />
                {/* Real-time domain validation feedback */}
                {formData.fromEmail && formData.username && (
                  (() => {
                    const validation = validateFromEmailDomain(formData.fromEmail, providerType, formData.username);
                    return (
                      <>
                        {validation.error && (
                          <p className="text-xs text-red-600 mt-1">
                            ❌ {validation.error}
                          </p>
                        )}
                        {!validation.error && validation.warning && (
                          <p className="text-xs text-amber-600 mt-1">
                            ⚠️ {validation.warning}
                          </p>
                        )}
                        {!validation.error && !validation.warning && (
                          <p className="text-xs text-green-600 mt-1">
                            ✓ Domain validation passed
                          </p>
                        )}
                      </>
                    );
                  })()
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  From Name <span className="text-red-500">*</span>
                  {formData.fromName === formData.name && formData.name && (
                    <span className="text-xs text-blue-600 ml-2">(Auto-filled)</span>
                  )}
                </label>
                <input
                  type="text"
                  value={formData.fromName}
                  onChange={(e) => setFormData({ ...formData, fromName: e.target.value })}
                  placeholder="BoxCostPro"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Validation Error */}
          {validationError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">❌ {validationError}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !!validationError}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Adding...' : 'Add Provider'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Email() {
  const [testEmail, setTestEmail] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const queryClient = useQueryClient();

  // Fetch email configuration
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-email-config'],
    queryFn: async () => {
      const res = await fetch('/api/admin/email/config', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch email config');
      return res.json();
    },
    staleTime: 30000,
  });

  // Fetch recent email logs
  const { data: logsData } = useQuery({
    queryKey: ['admin-email-logs'],
    queryFn: async () => {
      const res = await fetch('/api/admin/email/logs?limit=10', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch logs');
      return res.json();
    },
    staleTime: 30000,
  });

  // Fetch email provider health status
  const { data: healthData, isLoading: healthLoading } = useQuery({
    queryKey: ['admin-email-health'],
    queryFn: async () => {
      const res = await fetch('/api/admin/email/health', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch health');
      return res.json();
    },
    refetchInterval: 60000, // Refetch every minute
    staleTime: 30000,
  });

  // Send test email mutation
  const testEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await fetch('/api/admin/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      });
      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: text };
      }
      if (!res.ok) {
        throw new Error(data?.details || data?.error || 'Failed to send test email');
      }
      return data;
    },
    onSuccess: () => {
      setTestEmail('');
      queryClient.invalidateQueries({ queryKey: ['admin-email-logs'] });
      toast.success('✓ Test email sent successfully');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to send test email');
    },
  });

  // Add provider mutation
  const addProviderMutation = useMutation({
    mutationFn: async (providerData: Partial<EmailProvider>) => {
      const res = await fetch('/api/admin/email/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(providerData),
      });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        console.error('Non-JSON response:', text.substring(0, 200));
        throw new Error(`Server returned invalid response: ${res.status} ${res.statusText}`);
      }
      if (!res.ok) {
        throw new Error(data.error || `Request failed: ${res.status}`);
      }
      return data;
    },
    onSuccess: (data) => {
      setShowAddModal(false);
      queryClient.invalidateQueries({ queryKey: ['admin-email-config'] });
      queryClient.invalidateQueries({ queryKey: ['admin-email-health'] });
      
      // Show confirmation email status
      if (data?.confirmationEmail?.sent) {
        toast.success('✓ Provider added and confirmation email sent!');
      } else if (data?.confirmationEmail?.error) {
        toast.error(`Provider added but confirmation email failed: ${data.confirmationEmail.error}`);
      } else {
        toast.success('✓ Provider added successfully');
      }
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to add provider');
    },
  });

  // Set primary provider mutation
  const setPrimaryMutation = useMutation({
    mutationFn: async (providerId: string) => {
      const res = await fetch(`/api/admin/email/providers/${providerId}/primary`, {
        method: 'POST',
        credentials: 'include',
      });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        console.error('Non-JSON response:', text.substring(0, 200));
        throw new Error(`Server returned invalid response: ${res.status}`);
      }
      if (!res.ok) {
        throw new Error(data.error || 'Failed to set primary provider');
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-email-config'] });
    },
  });

  // Verify provider connection mutation
  const verifyProviderMutation = useMutation({
    mutationFn: async (providerId: string) => {
      const res = await fetch(`/api/admin/email/providers/${providerId}/test`, {
        method: 'POST',
        credentials: 'include',
      });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        console.error('Non-JSON response:', text.substring(0, 200));
        throw new Error(`Server returned invalid response: ${res.status}`);
      }
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || 'Provider verification failed');
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-email-config'] });
      toast.success('✓ Provider connection verified successfully');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Provider connection failed');
    },
  });

  // Delete provider mutation
  const deleteProviderMutation = useMutation({
    mutationFn: async (providerId: string) => {
      const res = await fetch(`/api/admin/email/providers/${providerId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        console.error('Non-JSON response:', text.substring(0, 200));
        throw new Error(`Server returned invalid response: ${res.status}`);
      }
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete provider');
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-email-config'] });
    },
  });

  // Normalize providers from backend shape to UI shape
  const providers = (data?.providers || []).map((p: any, idx: number) => {
    const isActive = p?.isActive ?? false;
    const failures = p?.consecutiveFailures ?? 0;
    const hasError = Boolean(p?.lastErrorAt || p?.lastErrorMessage);
    let status: 'active' | 'inactive' | 'error' = 'inactive';
    if (isActive) {
      status = (failures > 3 || hasError) ? 'error' : 'active';
    }

    return {
      // identity
      id: p?.id,
      // display
      name: p?.providerName || p?.fromName || p?.fromEmail || 'Email Provider',
      type: (p?.providerType || p?.connectionType || 'smtp').toLowerCase(),
      status,
      priority: p?.priorityOrder ?? (idx + 1),
      isVerified: p?.isVerified ?? false,
      // useful fields for other sections
      fromEmail: p?.fromEmail,
      fromName: p?.fromName,
      lastTestAt: p?.lastTestAt,
      consecutiveFailures: failures,
      lastErrorMessage: p?.lastErrorMessage,
    } as any;
  });
  const logs = logsData?.logs || [];

  // Format date
  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-IN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      <Toaster />
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">Email</h1>
        <p className="text-gray-600 mt-1">
          Configure email providers, manage failover, and monitor delivery health.
        </p>
      </div>

      {/* Enterprise Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-blue-900">Multi-Provider Architecture</p>
            <p className="text-sm text-blue-700 mt-0.5">
              Admins can configure multiple email providers with automatic failover for high deliverability.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configured Providers */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Configured Providers</h2>
          
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse"></div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-6">
              <p className="text-red-600 text-sm">Failed to load providers</p>
            </div>
          ) : providers.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm text-gray-500">No email providers configured.</p>
              <p className="text-xs text-gray-400 mt-1">Add a provider to enable email delivery.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {providers.map((provider: any, index: number) => (
                <div key={provider.id || index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
                      <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{provider.name}</p>
                      <p className="text-xs text-gray-500">{provider.type?.toUpperCase()} • Priority: {index + 1}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <ProviderStatusBadge status={provider.status} isPrimary={index === 0} isVerified={provider.isVerified} />
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={() => verifyProviderMutation.mutate(provider.id)}
                        disabled={verifyProviderMutation.isPending}
                        className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                        title="Verify Connection"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      {index !== 0 && (
                        <button
                          onClick={() => setPrimaryMutation.mutate(provider.id)}
                          disabled={setPrimaryMutation.isPending}
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Set as Primary"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (confirm(`Delete provider "${provider.name}"?`)) {
                            deleteProviderMutation.mutate(provider.id);
                          }
                        }}
                        disabled={deleteProviderMutation.isPending}
                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete Provider"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button 
            onClick={() => setShowAddModal(true)}
            className="w-full mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Email Provider
          </button>
        </div>

        {/* Test Email */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Send Test Email</h2>
          <p className="text-sm text-gray-600 mb-4">
            Verify email delivery by sending a test message through the primary provider.
          </p>
          
          <div className="flex gap-3">
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="recipient@example.com"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              onClick={() => testEmail && testEmailMutation.mutate(testEmail)}
              disabled={!testEmail || testEmailMutation.isPending}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {testEmailMutation.isPending ? 'Sending...' : 'Send Test'}
            </button>
          </div>

          {/* Delivery Stats */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Delivery Stats (Last 24h)</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <p className="text-xl font-bold text-green-600">{data?.stats?.sent || 0}</p>
                <p className="text-xs text-green-700">Sent</p>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <p className="text-xl font-bold text-red-600">{data?.stats?.failed || 0}</p>
                <p className="text-xs text-red-700">Failed</p>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <p className="text-xl font-bold text-yellow-600">{data?.stats?.deferred || 0}</p>
                <p className="text-xs text-yellow-700">Deferred</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Provider Health Dashboard */}
      {providers.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Provider Health</h2>
            <span className="text-xs text-gray-500">Real-time status</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {providers.map((provider: any, index: number) => {
              // Determine health color based on status
              let healthColor = 'bg-green-50 border-green-200';
              let healthIcon = '🟢';
              let healthText = 'Healthy';

              if (provider.status === 'error') {
                healthColor = 'bg-red-50 border-red-200';
                healthIcon = '🔴';
                healthText = 'Error';
              } else if (provider.status === 'critical') {
                healthColor = 'bg-red-50 border-red-200';
                healthIcon = '🔴';
                healthText = 'Critical';
              } else if (provider.status === 'warning') {
                healthColor = 'bg-yellow-50 border-yellow-200';
                healthIcon = '🟡';
                healthText = 'Warning';
              }

              return (
                <div key={provider.id || index} className={`border rounded-lg p-4 ${healthColor}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{provider.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{provider.type?.toUpperCase()}</p>
                    </div>
                    <span className="text-lg">{healthIcon}</span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Status:</span>
                      <span className="font-medium text-gray-900">{healthText}</span>
                    </div>
                    {provider.lastTestAt && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Last Test:</span>
                        <span className="text-gray-700">{formatDate(provider.lastTestAt)}</span>
                      </div>
                    )}
                    {provider.consecutiveFailures > 0 && (
                      <div className="flex items-center justify-between pt-1 border-t border-current border-opacity-20">
                        <span className="text-gray-600">Failures:</span>
                        <span className="font-semibold text-red-700">{provider.consecutiveFailures}</span>
                      </div>
                    )}
                  </div>

                  {provider.lastErrorMessage && (
                    <div className="mt-3 pt-3 border-t border-current border-opacity-20">
                      <p className="text-xs text-gray-700 bg-black bg-opacity-5 rounded p-2">
                        <span className="font-medium">Last Error:</span><br />
                        {provider.lastErrorMessage.substring(0, 100)}...
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Delivery Logs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent Delivery Logs</h2>
        </div>
        
        {logs.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-sm text-gray-500">No email logs available.</p>
            <p className="text-xs text-gray-400 mt-1">Logs will appear as emails are sent.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Recipient</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Subject</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Provider</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {logs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{log.recipient}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 max-w-xs truncate">{log.subject}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{log.provider}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <DeliveryStatusBadge status={log.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(log.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Provider Modal */}
      <AddProviderModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={(data) => addProviderMutation.mutate(data)}
        isSubmitting={addProviderMutation.isPending}
      />
    </div>
  );
}
