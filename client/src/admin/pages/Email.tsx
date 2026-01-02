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
function ProviderStatusBadge({ status, isPrimary }: { status: string; isPrimary?: boolean }) {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    inactive: 'bg-gray-100 text-gray-800',
    error: 'bg-red-100 text-red-800',
  };
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || colors.inactive}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
      {isPrimary && (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
          Primary
        </span>
      )}
    </div>
  );
}

// Delivery status badge
function DeliveryStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    sent: 'bg-green-100 text-green-800',
    delivered: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    deferred: 'bg-yellow-100 text-yellow-800',
    bounced: 'bg-orange-100 text-orange-800',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
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
  onSubmit: (data: Partial<EmailProvider>) => void;
  isSubmitting: boolean;
}) {
  const [providerType, setProviderType] = useState<ProviderType>('smtp');
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

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name: formData.name,
      type: providerType,
      host: providerType === 'smtp' ? formData.host : undefined,
      port: providerType === 'smtp' ? parseInt(formData.port) : undefined,
      username: providerType === 'smtp' ? formData.username : undefined,
      apiKey: providerType !== 'smtp' ? formData.apiKey : undefined,
      fromEmail: formData.fromEmail,
      fromName: formData.fromName,
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
              onChange={(e) => setProviderType(e.target.value as ProviderType)}
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
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Primary SMTP Server"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* SMTP-specific fields */}
          {providerType === 'smtp' && (
            <>
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
                  Username
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="user@example.com"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </>
          )}

          {/* API-based providers */}
          {providerType !== 'smtp' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                API Key
              </label>
              <input
                type="password"
                value={formData.apiKey}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                placeholder="Your API key"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Get your API key from the {providerOptions.find(p => p.value === providerType)?.label} dashboard.
              </p>
            </div>
          )}

          {/* Sender Info */}
          <div className="pt-4 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Sender Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  From Email
                </label>
                <input
                  type="email"
                  value={formData.fromEmail}
                  onChange={(e) => setFormData({ ...formData, fromEmail: e.target.value })}
                  placeholder="noreply@yourdomain.com"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  From Name
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
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
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

  // Send test email mutation
  const testEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await fetch('/api/admin/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error('Failed to send test email');
      return res.json();
    },
    onSuccess: () => {
      setTestEmail('');
      queryClient.invalidateQueries({ queryKey: ['admin-email-logs'] });
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
      if (!res.ok) throw new Error('Failed to add provider');
      return res.json();
    },
    onSuccess: () => {
      setShowAddModal(false);
      queryClient.invalidateQueries({ queryKey: ['admin-email-config'] });
    },
  });

  // Set primary provider mutation
  const setPrimaryMutation = useMutation({
    mutationFn: async (providerId: string) => {
      const res = await fetch(`/api/admin/email/providers/${providerId}/primary`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to set primary provider');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-email-config'] });
    },
  });

  // Delete provider mutation
  const deleteProviderMutation = useMutation({
    mutationFn: async (providerId: string) => {
      const res = await fetch(`/api/admin/email/providers/${providerId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete provider');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-email-config'] });
    },
  });

  const providers = data?.providers || [];
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
                    <ProviderStatusBadge status={provider.status} isPrimary={index === 0} />
                    <div className="flex items-center gap-1 ml-2">
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

          {testEmailMutation.isSuccess && (
            <p className="mt-3 text-sm text-green-600">✓ Test email sent successfully</p>
          )}
          {testEmailMutation.isError && (
            <p className="mt-3 text-sm text-red-600">✗ Failed to send test email</p>
          )}

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
