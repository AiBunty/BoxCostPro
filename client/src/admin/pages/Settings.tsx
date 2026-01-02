/**
 * Settings Page - Platform Configuration
 * Manage business, security, and integration settings
 * NEVER renders blank
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Settings section component
function SettingsSection({ 
  title, 
  description, 
  children 
}: { 
  title: string; 
  description: string; 
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-600 mt-0.5">{description}</p>
      </div>
      <div className="p-6">
        {children}
      </div>
    </div>
  );
}

// Toggle switch component
function Toggle({ 
  enabled, 
  onChange, 
  disabled 
}: { 
  enabled: boolean; 
  onChange: (val: boolean) => void; 
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!enabled)}
      disabled={disabled}
      className={`
        relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent 
        transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
        ${enabled ? 'bg-blue-600' : 'bg-gray-200'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      <span
        className={`
          pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 
          transition duration-200 ease-in-out
          ${enabled ? 'translate-x-5' : 'translate-x-0'}
        `}
      />
    </button>
  );
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'business' | 'security' | 'integrations'>('business');
  const queryClient = useQueryClient();

  // Fetch settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: async () => {
      const res = await fetch('/api/admin/settings', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch settings');
      return res.json();
    },
    staleTime: 60000,
  });

  // Update settings mutation
  const updateMutation = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Failed to update settings');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
    },
  });

  const updateSetting = (key: string, value: any) => {
    updateMutation.mutate({ [key]: value });
  };

  const tabs = [
    { id: 'business', label: 'Business' },
    { id: 'security', label: 'Security' },
    { id: 'integrations', label: 'Integrations' },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">Settings</h1>
        <p className="text-gray-600 mt-1">
          Configure platform-level settings for business, security, and integrations.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="p-8 text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Loading settings...</p>
        </div>
      ) : (
        <>
          {/* Business Settings */}
          {activeTab === 'business' && (
            <div className="space-y-6">
              <SettingsSection
                title="Tax & GST Configuration"
                description="Configure default tax rates and GST settings for invoicing."
              >
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Company GSTIN</label>
                      <input
                        type="text"
                        defaultValue={settings?.gstin || ''}
                        placeholder="22AAAAA0000A1Z5"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">State Code</label>
                      <input
                        type="text"
                        defaultValue={settings?.stateCode || ''}
                        placeholder="27"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Default CGST (%)</label>
                      <input
                        type="number"
                        defaultValue={settings?.defaultCgst || 9}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        min="0"
                        max="28"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Default SGST (%)</label>
                      <input
                        type="number"
                        defaultValue={settings?.defaultSgst || 9}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        min="0"
                        max="28"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Default IGST (%)</label>
                      <input
                        type="number"
                        defaultValue={settings?.defaultIgst || 18}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        min="0"
                        max="28"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200">
                  <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
                    Save Tax Settings
                  </button>
                </div>
              </SettingsSection>

              <SettingsSection
                title="Feature Toggles"
                description="Enable or disable platform features."
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">New User Registration</p>
                      <p className="text-sm text-gray-500">Allow new users to register on the platform.</p>
                    </div>
                    <Toggle 
                      enabled={settings?.registrationEnabled ?? true} 
                      onChange={(val) => updateSetting('registrationEnabled', val)}
                    />
                  </div>

                  <div className="flex items-center justify-between py-2 border-t border-gray-100">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Maintenance Mode</p>
                      <p className="text-sm text-gray-500">Show maintenance page to non-admin users.</p>
                    </div>
                    <Toggle 
                      enabled={settings?.maintenanceMode ?? false} 
                      onChange={(val) => updateSetting('maintenanceMode', val)}
                    />
                  </div>

                  <div className="flex items-center justify-between py-2 border-t border-gray-100">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Email Notifications</p>
                      <p className="text-sm text-gray-500">Send system email notifications to users.</p>
                    </div>
                    <Toggle 
                      enabled={settings?.emailNotifications ?? true} 
                      onChange={(val) => updateSetting('emailNotifications', val)}
                    />
                  </div>
                </div>
              </SettingsSection>
            </div>
          )}

          {/* Security Settings */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <SettingsSection
                title="Session & Authentication"
                description="Configure session timeouts and authentication requirements."
              >
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Session Timeout (minutes)</label>
                      <input
                        type="number"
                        defaultValue={settings?.sessionTimeout || 60}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        min="5"
                        max="1440"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Max Login Attempts</label>
                      <input
                        type="number"
                        defaultValue={settings?.maxLoginAttempts || 5}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        min="3"
                        max="10"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-2 border-t border-gray-100">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Require 2FA for Admins</p>
                      <p className="text-sm text-gray-500">Enforce two-factor authentication for all admin users.</p>
                    </div>
                    <Toggle 
                      enabled={settings?.require2faAdmin ?? true} 
                      onChange={(val) => updateSetting('require2faAdmin', val)}
                    />
                  </div>

                  <div className="flex items-center justify-between py-2 border-t border-gray-100">
                    <div>
                      <p className="text-sm font-medium text-gray-900">IP Whitelisting</p>
                      <p className="text-sm text-gray-500">Restrict admin access to whitelisted IP addresses.</p>
                    </div>
                    <Toggle 
                      enabled={settings?.ipWhitelisting ?? false} 
                      onChange={(val) => updateSetting('ipWhitelisting', val)}
                    />
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200">
                  <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
                    Save Security Settings
                  </button>
                </div>
              </SettingsSection>

              <SettingsSection
                title="Admin Roles"
                description="Manage admin role permissions and access levels."
              >
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Role</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">View</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Edit</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Delete</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Settings</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      <tr>
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-gray-900">Super Admin</span>
                        </td>
                        <td className="px-4 py-3 text-center text-green-600">✓</td>
                        <td className="px-4 py-3 text-center text-green-600">✓</td>
                        <td className="px-4 py-3 text-center text-green-600">✓</td>
                        <td className="px-4 py-3 text-center text-green-600">✓</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-gray-900">Admin</span>
                        </td>
                        <td className="px-4 py-3 text-center text-green-600">✓</td>
                        <td className="px-4 py-3 text-center text-green-600">✓</td>
                        <td className="px-4 py-3 text-center text-gray-400">—</td>
                        <td className="px-4 py-3 text-center text-gray-400">—</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-gray-900">Support</span>
                        </td>
                        <td className="px-4 py-3 text-center text-green-600">✓</td>
                        <td className="px-4 py-3 text-center text-gray-400">—</td>
                        <td className="px-4 py-3 text-center text-gray-400">—</td>
                        <td className="px-4 py-3 text-center text-gray-400">—</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </SettingsSection>
            </div>
          )}

          {/* Integration Settings */}
          {activeTab === 'integrations' && (
            <div className="space-y-6">
              <SettingsSection
                title="Payment Gateway"
                description="Configure payment gateway credentials and settings."
              >
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Primary Gateway</label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                      <option value="razorpay">Razorpay</option>
                      <option value="stripe">Stripe</option>
                    </select>
                  </div>

                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm font-medium text-green-800">Razorpay Connected</span>
                    </div>
                    <p className="text-sm text-green-700 mt-1">Account: rzp_live_****xxxx</p>
                  </div>
                </div>
              </SettingsSection>

              <SettingsSection
                title="Email Provider"
                description="Configure email service provider settings."
              >
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm font-medium text-green-800">Email Provider Active</span>
                    </div>
                    <p className="text-sm text-green-700 mt-1">Multi-provider failover configured</p>
                  </div>

                  <a 
                    href="/admin/email" 
                    className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                  >
                    Manage Email Providers
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </a>
                </div>
              </SettingsSection>

              <SettingsSection
                title="Webhooks"
                description="Configure webhook endpoints for external integrations."
              >
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-500">No webhooks configured.</p>
                  <button className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
                    Add Webhook
                  </button>
                </div>
              </SettingsSection>
            </div>
          )}
        </>
      )}

      {/* Save Indicator */}
      {updateMutation.isPending && (
        <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          Saving...
        </div>
      )}
      {updateMutation.isSuccess && (
        <div className="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg">
          ✓ Settings saved
        </div>
      )}
    </div>
  );
}
