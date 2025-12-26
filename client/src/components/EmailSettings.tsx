/**
 * Email Settings Component
 *
 * Allows users to configure their email settings for sending quotes
 * Supports:
 * 1. Google OAuth (via Supabase)
 * 2. Custom SMTP (any email provider)
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Mail,
  Check,
  X,
  AlertCircle,
  RefreshCw,
  Send,
  Settings,
  Info,
  ExternalLink
} from "lucide-react";

interface UserEmailSettings {
  id: string;
  userId: string;
  provider: string;
  emailAddress: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUsername?: string;
  oauthProvider?: string;
  isVerified: boolean;
  isActive: boolean;
  lastVerifiedAt?: string;
}

const SMTP_PRESETS: Record<string, { host: string; port: number; secure: boolean }> = {
  gmail: { host: 'smtp.gmail.com', port: 587, secure: false },
  outlook: { host: 'smtp-mail.outlook.com', port: 587, secure: false },
  yahoo: { host: 'smtp.mail.yahoo.com', port: 587, secure: false },
  zoho: { host: 'smtp.zoho.com', port: 587, secure: false },
  titan: { host: 'smtp.titan.email', port: 587, secure: false },
  custom: { host: '', port: 587, secure: false },
};

export function EmailSettings() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'google' | 'smtp'>('google');
  const [showPassword, setShowPassword] = useState(false);

  // SMTP form state
  const [emailAddress, setEmailAddress] = useState('');
  const [smtpProvider, setSmtpProvider] = useState('gmail');
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUsername, setSmtpUsername] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');

  // Fetch current email settings
  const { data: emailSettings, isLoading } = useQuery<UserEmailSettings>({
    queryKey: ['/api/email-settings'],
  });

  // Pre-fill form if settings exist
  useEffect(() => {
    if (emailSettings) {
      setEmailAddress(emailSettings.emailAddress);
      if (emailSettings.provider === 'smtp' || emailSettings.provider === 'gmail') {
        setActiveTab('smtp');
        setSmtpHost(emailSettings.smtpHost || '');
        setSmtpPort(emailSettings.smtpPort || 587);
        setSmtpSecure(emailSettings.smtpSecure || false);
        setSmtpUsername(emailSettings.smtpUsername || '');
      } else if (emailSettings.provider === 'google_oauth') {
        setActiveTab('google');
      }
    }
  }, [emailSettings]);

  // Handle SMTP provider change
  const handleProviderChange = (provider: string) => {
    setSmtpProvider(provider);
    const preset = SMTP_PRESETS[provider];
    setSmtpHost(preset.host);
    setSmtpPort(preset.port);
    setSmtpSecure(preset.secure);
  };

  // Save SMTP settings mutation
  const saveSMTPMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/email-settings/smtp', {
        emailAddress,
        smtpHost,
        smtpPort,
        smtpSecure,
        smtpUsername,
        smtpPassword,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email-settings'] });
      toast({
        title: "SMTP Settings Saved",
        description: "Your email configuration has been saved. Testing connection...",
      });
      // Auto-verify after saving
      verifyMutation.mutate();
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save SMTP settings",
        variant: "destructive",
      });
    },
  });

  // Connect Google OAuth mutation
  const connectGoogleMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('GET', '/api/email-settings/google/auth-url');
      return response;
    },
    onSuccess: (data: any) => {
      // Redirect to Google OAuth
      window.location.href = data.authUrl;
    },
    onError: (error: any) => {
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect Google account",
        variant: "destructive",
      });
    },
  });

  // Verify email configuration mutation
  const verifyMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/email-settings/verify');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email-settings'] });
      toast({
        title: "✅ Verification Successful",
        description: "Your email configuration is working correctly!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Verification Failed",
        description: error.message || "Email configuration is not working",
        variant: "destructive",
      });
    },
  });

  // Send test email mutation
  const sendTestMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/email-settings/test');
    },
    onSuccess: () => {
      toast({
        title: "Test Email Sent",
        description: "Check your inbox for the test email!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Test Email Failed",
        description: error.message || "Failed to send test email",
        variant: "destructive",
      });
    },
  });

  // Disconnect email mutation
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('DELETE', '/api/email-settings');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email-settings'] });
      setEmailAddress('');
      setSmtpPassword('');
      toast({
        title: "Email Disconnected",
        description: "Your email configuration has been removed",
      });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Card */}
      {emailSettings && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="py-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                {emailSettings.isVerified ? (
                  <Check className="h-5 w-5 text-green-600 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                )}
                <div>
                  <p className="font-medium text-green-900">
                    Email Connected: {emailSettings.emailAddress}
                  </p>
                  <p className="text-sm text-green-700">
                    Provider: {emailSettings.provider === 'google_oauth' ? 'Google OAuth' : 'SMTP'}
                    {emailSettings.isVerified ? (
                      <Badge className="ml-2 bg-green-600">Verified</Badge>
                    ) : (
                      <Badge className="ml-2 bg-amber-500">Not Verified</Badge>
                    )}
                  </p>
                  {emailSettings.lastVerifiedAt && (
                    <p className="text-xs text-green-600 mt-1">
                      Last verified: {new Date(emailSettings.lastVerifiedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => verifyMutation.mutate()}
                  disabled={verifyMutation.isPending}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${verifyMutation.isPending ? 'animate-spin' : ''}`} />
                  Verify
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => sendTestMutation.mutate()}
                  disabled={sendTestMutation.isPending}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Test
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => disconnectMutation.mutate()}
                  disabled={disconnectMutation.isPending}
                >
                  <X className="h-4 w-4 mr-2" />
                  Disconnect
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Configuration
          </CardTitle>
          <CardDescription>
            Configure your email to send quotes and notifications from your own email address
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'google' | 'smtp')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="google">
                <img src="https://www.google.com/favicon.ico" className="h-4 w-4 mr-2" alt="Google" />
                Google OAuth (Recommended)
              </TabsTrigger>
              <TabsTrigger value="smtp">
                <Settings className="h-4 w-4 mr-2" />
                Custom SMTP
              </TabsTrigger>
            </TabsList>

            {/* Google OAuth Tab */}
            <TabsContent value="google" className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Why Google OAuth?</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1 text-sm mt-2">
                    <li>Most secure method (no password storage)</li>
                    <li>Higher sending limits than SMTP</li>
                    <li>Better deliverability (less spam)</li>
                    <li>Automatic token refresh</li>
                  </ul>
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div>
                  <Label>What happens when you connect?</Label>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground mt-2">
                    <li>You'll be redirected to Google's secure login page</li>
                    <li>Grant BoxCostPro permission to send emails on your behalf</li>
                    <li>Your Gmail address will be configured automatically</li>
                    <li>You can revoke access anytime from Google settings</li>
                  </ol>
                </div>

                <Button
                  className="w-full"
                  onClick={() => connectGoogleMutation.mutate()}
                  disabled={connectGoogleMutation.isPending}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  {connectGoogleMutation.isPending ? 'Connecting...' : 'Connect Google Account'}
                </Button>
              </div>
            </TabsContent>

            {/* SMTP Tab */}
            <TabsContent value="smtp" className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>SMTP Configuration</AlertTitle>
                <AlertDescription>
                  Use this for Gmail, Outlook, Yahoo, Zoho, or any custom email provider.
                  For Gmail, you'll need an App Password (not your regular password).
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="email-provider">Email Provider</Label>
                  <Select value={smtpProvider} onValueChange={handleProviderChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gmail">Gmail (recommended)</SelectItem>
                      <SelectItem value="outlook">Outlook / Hotmail</SelectItem>
                      <SelectItem value="yahoo">Yahoo Mail</SelectItem>
                      <SelectItem value="zoho">Zoho Mail</SelectItem>
                      <SelectItem value="titan">Titan Mail</SelectItem>
                      <SelectItem value="custom">Custom SMTP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="email-address">Email Address</Label>
                  <Input
                    id="email-address"
                    type="email"
                    placeholder="your-email@gmail.com"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                  />
                </div>

                {smtpProvider === 'gmail' && (
                  <Alert className="bg-amber-50 border-amber-200">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertTitle>Gmail App Password Required</AlertTitle>
                    <AlertDescription>
                      <ol className="list-decimal list-inside space-y-1 text-sm mt-2">
                        <li>Enable 2-Factor Authentication on your Google account</li>
                        <li>Go to: <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Google App Passwords</a></li>
                        <li>Generate a new App Password for "Mail"</li>
                        <li>Copy the 16-character password and paste below</li>
                      </ol>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="smtp-host">SMTP Host</Label>
                    <Input
                      id="smtp-host"
                      placeholder="smtp.gmail.com"
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                      disabled={smtpProvider !== 'custom'}
                    />
                  </div>
                  <div>
                    <Label htmlFor="smtp-port">Port</Label>
                    <Input
                      id="smtp-port"
                      type="number"
                      placeholder="587"
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(parseInt(e.target.value))}
                      disabled={smtpProvider !== 'custom'}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="smtp-username">Username</Label>
                  <Input
                    id="smtp-username"
                    placeholder="Usually same as email address"
                    value={smtpUsername}
                    onChange={(e) => setSmtpUsername(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="smtp-password">Password / App Password</Label>
                  <Input
                    id="smtp-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={smtpProvider === 'gmail' ? '16-character App Password' : 'Your email password'}
                    value={smtpPassword}
                    onChange={(e) => setSmtpPassword(e.target.value)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? 'Hide' : 'Show'} Password
                  </Button>
                </div>

                <Button
                  className="w-full"
                  onClick={() => saveSMTPMutation.mutate()}
                  disabled={saveSMTPMutation.isPending || !emailAddress || !smtpPassword}
                >
                  {saveSMTPMutation.isPending ? 'Saving...' : 'Save SMTP Settings'}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
