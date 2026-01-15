import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Mail, Shield, CheckCircle2, XCircle, ExternalLink, RefreshCw, Trash2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SiGoogle } from "react-icons/si";

interface EmailProvider {
  id: string;
  name: string;
  description: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  supportsOAuth: boolean;
  oauthProvider?: string;
  setupInstructions: string;
}

interface EmailSettings {
  configured: boolean;
  provider?: string;
  emailAddress?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUsername?: string;
  hasSmtpPassword?: boolean;
  oauthProvider?: string;
  hasOAuthTokens?: boolean;
  isVerified?: boolean;
  isActive?: boolean;
  lastVerifiedAt?: string;
}

export default function EmailConfigurationTab() {
  const { toast } = useToast();
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [showSmtpForm, setShowSmtpForm] = useState(false);
  const [oauthMessage, setOauthMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Handle OAuth callback messages from URL parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailSuccess = params.get('emailSuccess');
    const emailError = params.get('emailError');
    
    if (emailSuccess === 'true') {
      setOauthMessage({ type: 'success', text: 'Google account connected successfully! Your email is ready to send quotes.' });
      toast({
        title: "Email Connected",
        description: "Your Google account has been connected successfully.",
      });
      // Clean up URL
      const url = new URL(window.location.href);
      url.searchParams.delete('emailSuccess');
      url.searchParams.delete('tab');
      window.history.replaceState({}, '', url.pathname + (url.searchParams.toString() ? '?' + url.searchParams.toString() : ''));
    } else if (emailError) {
      setOauthMessage({ type: 'error', text: decodeURIComponent(emailError) });
      toast({
        title: "Connection Failed",
        description: decodeURIComponent(emailError),
        variant: "destructive",
      });
      // Clean up URL
      const url = new URL(window.location.href);
      url.searchParams.delete('emailError');
      url.searchParams.delete('tab');
      window.history.replaceState({}, '', url.pathname);
    }
  }, [toast]);

  const { data: providers = [], isLoading: providersLoading } = useQuery<EmailProvider[]>({
    queryKey: ["/api/email-providers"],
  });

  const { data: settings, isLoading: settingsLoading, refetch: refetchSettings } = useQuery<EmailSettings>({
    queryKey: ["/api/email-settings"],
  });

  // Check if Google OAuth is available (server has proper credentials configured)
  const { data: googleStatus } = useQuery<{ available: boolean }>({
    queryKey: ["/api/email-settings/google/status"],
  });
  
  // Filter providers - hide Gmail OAuth if Google OAuth is not configured on server
  const availableProviders = providers.filter(p => {
    if (p.id === 'google_oauth' && !googleStatus?.available) {
      return false;
    }
    return true;
  });

  const smtpForm = useForm({
    defaultValues: {
      emailAddress: "",
      smtpHost: "",
      smtpPort: 587,
      smtpSecure: false,
      smtpUsername: "",
      smtpPassword: "",
    },
  });

  useEffect(() => {
    if (settings?.configured && settings.provider) {
      setSelectedProvider(settings.provider);
      smtpForm.reset({
        emailAddress: settings.emailAddress || "",
        smtpHost: settings.smtpHost || "",
        smtpPort: settings.smtpPort || 587,
        smtpSecure: settings.smtpSecure || false,
        smtpUsername: settings.smtpUsername || settings.emailAddress || "",
        smtpPassword: "",
      });
    }
  }, [settings]);

  useEffect(() => {
    if (selectedProvider && !settings?.configured) {
      const preset = providers.find(p => p.id === selectedProvider);
      if (preset && !preset.supportsOAuth) {
        smtpForm.reset({
          emailAddress: smtpForm.getValues('emailAddress'),
          smtpHost: preset.smtpHost,
          smtpPort: preset.smtpPort,
          smtpSecure: preset.smtpSecure,
          smtpUsername: smtpForm.getValues('emailAddress'),
          smtpPassword: "",
        });
        setShowSmtpForm(true);
      }
    }
  }, [selectedProvider, providers]);

  const smtpTestMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/admin/test-smtp", {
        host: data.smtpHost,
        port: data.smtpPort,
        secure: data.smtpSecure,
        auth: data.smtpPassword ? {
          user: data.smtpUsername,
          pass: data.smtpPassword,
        } : undefined,
      });
    },
    onSuccess: () => {
      toast({
        title: "SMTP Connection Successful!",
        description: "Your SMTP configuration is valid. You can now save it.",
      });
    },
    onError: (error: any) => {
      const errorMessage = error.details || error.message || "SMTP connection failed";
      toast({
        title: "SMTP Connection Failed",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/email-settings/smtp", {
        ...data,
        provider: selectedProvider,
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-settings"] });
      toast({
        title: "Email Configured Successfully!",
        description: data.message || "Your email configuration has been tested and saved.",
      });
      // Reset form after successful save
      setShowSmtpForm(false);
    },
    onError: (error: any) => {
      // Display detailed error messages from backend
      const errorMessage = error.message || error.error || "Failed to save email settings";
      const errorCode = error.code;

      console.error('[Email Settings] Save failed:', errorCode, errorMessage);

      toast({
        title: errorCode === 'GMAIL_AUTH_FAILED' ? "Gmail Authentication Failed" : "Configuration Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/email-settings/verify", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-settings"] });
      toast({
        title: "Verified!",
        description: "Your email configuration is working correctly.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Verification Failed",
        description: error.message || "Please check your credentials and try again",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/email-settings", undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-settings"] });
      setSelectedProvider("");
      setShowSmtpForm(false);
      smtpForm.reset();
      toast({
        title: "Configuration Removed",
        description: "Your email settings have been cleared.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove email settings",
        variant: "destructive",
      });
    },
  });

  const connectGoogleMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/email-settings/google/connect", {
        credentials: "include",
      });
      const data = await response.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        throw new Error(data.error || "Failed to get auth URL");
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to connect with Google",
        variant: "destructive",
      });
    },
  });

  const handleProviderSelect = (providerId: string) => {
    setSelectedProvider(providerId);
    const preset = providers.find(p => p.id === providerId);
    if (preset?.supportsOAuth) {
      setShowSmtpForm(false);
    } else {
      setShowSmtpForm(true);
      if (preset) {
        smtpForm.reset({
          emailAddress: "",
          smtpHost: preset.smtpHost,
          smtpPort: preset.smtpPort,
          smtpSecure: preset.smtpSecure,
          smtpUsername: "",
          smtpPassword: "",
        });
      }
    }
  };

  const handleSaveSmtp = (data: any) => {
    saveMutation.mutate(data);
  };

  const getProviderIcon = (providerId: string) => {
    switch (providerId) {
      case 'google_oauth':
      case 'gmail':
        return <SiGoogle className="h-5 w-5" />;
      default:
        return <Mail className="h-5 w-5" />;
    }
  };

  if (providersLoading || settingsLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentPreset = providers.find(p => p.id === selectedProvider);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Configuration
          </CardTitle>
          <CardDescription>
            Configure your email to send quotes directly from your address
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {oauthMessage && (
            <Alert className={oauthMessage.type === 'success' ? 'border-green-500/50 bg-green-500/10' : 'border-destructive/50 bg-destructive/10'}>
              {oauthMessage.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              ) : (
                <AlertCircle className="h-4 w-4 text-destructive" />
              )}
              <AlertDescription className={oauthMessage.type === 'success' ? 'text-green-700 dark:text-green-300' : 'text-destructive'}>
                {oauthMessage.text}
              </AlertDescription>
            </Alert>
          )}
          
          {settings?.configured ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50">
                <div className="flex items-center gap-3">
                  {getProviderIcon(settings.provider || '')}
                  <div>
                    <p className="font-medium">{settings.emailAddress}</p>
                    <p className="text-sm text-muted-foreground">
                      {providers.find(p => p.id === settings.provider)?.name || settings.provider}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {settings.isVerified ? (
                    <Badge className="gap-1 bg-green-500/20 text-green-600 dark:text-green-400 hover:bg-green-500/30">
                      <CheckCircle2 className="h-3 w-3" />
                      Verified
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 text-yellow-600 dark:text-yellow-400">
                      <XCircle className="h-3 w-3" />
                      Not Verified
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                {!settings.isVerified && (
                  <Button
                    onClick={() => verifyMutation.mutate()}
                    disabled={verifyMutation.isPending}
                    className="gap-2"
                    data-testid="button-verify-email"
                  >
                    {verifyMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Shield className="h-4 w-4" />
                    )}
                    Verify Configuration
                  </Button>
                )}
                {settings.isVerified && (
                  <Button
                    variant="outline"
                    onClick={() => verifyMutation.mutate()}
                    disabled={verifyMutation.isPending}
                    className="gap-2"
                    data-testid="button-reverify-email"
                  >
                    {verifyMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Re-verify
                  </Button>
                )}
                <Button
                  variant="destructive"
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  className="gap-2"
                  data-testid="button-disconnect-email"
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Label>Select Email Provider</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {availableProviders.map((provider) => (
                  <button
                    key={provider.id}
                    onClick={() => handleProviderSelect(provider.id)}
                    className={`p-4 rounded-lg border text-left transition-all hover-elevate ${
                      selectedProvider === provider.id
                        ? 'border-primary bg-primary/5'
                        : 'hover:border-primary/50'
                    }`}
                    data-testid={`button-provider-${provider.id}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {getProviderIcon(provider.id)}
                      <span className="font-medium text-sm">{provider.name}</span>
                    </div>
                    {provider.supportsOAuth && (
                      <Badge variant="secondary" className="text-xs">
                        OAuth
                      </Badge>
                    )}
                  </button>
                ))}
              </div>

              {selectedProvider && currentPreset?.supportsOAuth && (
                <div className="pt-4">
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      {currentPreset.setupInstructions}
                    </AlertDescription>
                  </Alert>
                  <Button
                    onClick={() => connectGoogleMutation.mutate()}
                    disabled={connectGoogleMutation.isPending}
                    className="w-full mt-4 gap-2"
                    data-testid="button-connect-google"
                  >
                    {connectGoogleMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <SiGoogle className="h-4 w-4" />
                    )}
                    Connect with Google
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              )}

              {showSmtpForm && currentPreset && !currentPreset.supportsOAuth && (
                <div className="pt-4 border-t">
                  {/* Gmail-specific warning */}
                  {selectedProvider === 'gmail' && (
                    <Alert className="mb-4 border-yellow-500/50 bg-yellow-500/10">
                      <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                      <AlertDescription className="text-yellow-700 dark:text-yellow-300">
                        <strong>Important: Use an App Password, NOT your Gmail password!</strong>
                        <ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
                          <li>Go to <a href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer" className="underline">Google Account Security</a></li>
                          <li>Enable 2-Step Verification</li>
                          <li>Under "2-Step Verification", click "App Passwords"</li>
                          <li>Select "Mail" and "Other (Custom name)"</li>
                          <li>Copy the 16-character password (spaces will be removed automatically)</li>
                        </ol>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Generic provider instructions */}
                  {selectedProvider !== 'gmail' && (
                    <Alert className="mb-4">
                      <Mail className="h-4 w-4" />
                      <AlertDescription>
                        {currentPreset.setupInstructions}
                      </AlertDescription>
                    </Alert>
                  )}

                  <Form {...smtpForm}>
                    <form onSubmit={smtpForm.handleSubmit(handleSaveSmtp)} className="space-y-4">
                      <FormField
                        control={smtpForm.control}
                        name="emailAddress"
                        rules={{ required: "Email address is required" }}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email Address</FormLabel>
                            <FormControl>
                              <Input 
                                type="email" 
                                placeholder="your.email@example.com" 
                                {...field} 
                                data-testid="input-smtp-email"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {selectedProvider === 'custom' && (
                        <div className="grid sm:grid-cols-2 gap-4">
                          <FormField
                            control={smtpForm.control}
                            name="smtpHost"
                            rules={{ required: "SMTP host is required" }}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>SMTP Host</FormLabel>
                                <FormControl>
                                  <Input 
                                    placeholder="smtp.example.com" 
                                    {...field} 
                                    data-testid="input-smtp-host"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={smtpForm.control}
                            name="smtpPort"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Port</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    {...field}
                                    onChange={(e) => field.onChange(parseInt(e.target.value) || 587)}
                                    data-testid="input-smtp-port"
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                      )}

                      <FormField
                        control={smtpForm.control}
                        name="smtpPassword"
                        rules={{ required: "Password is required" }}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              {selectedProvider === 'gmail' ? 'App Password (16 characters)' : 'Password / App Password'}
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="password"
                                placeholder={
                                  selectedProvider === 'gmail'
                                    ? 'xxxx xxxx xxxx xxxx (spaces ok)'
                                    : 'Enter your password or app password'
                                }
                                {...field}
                                data-testid="input-smtp-password"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button
                        type="button"
                        variant="outline"
                        className="w-full gap-2"
                        disabled={smtpTestMutation.isPending || !smtpForm.getValues('smtpPassword')}
                        onClick={() => {
                          const values = smtpForm.getValues();
                          if (!values.smtpPassword) {
                            toast({
                              title: "Password Required",
                              description: "Please enter your SMTP password first",
                              variant: "destructive",
                            });
                            return;
                          }
                          smtpTestMutation.mutate(values);
                        }}
                        data-testid="button-test-smtp"
                      >
                        {smtpTestMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Testing Connection...
                          </>
                        ) : (
                          <>
                            <Mail className="h-4 w-4" />
                            Test SMTP Connection
                          </>
                        )}
                      </Button>

                      <Button
                        type="submit"
                        className="w-full gap-2"
                        disabled={saveMutation.isPending}
                        data-testid="button-save-smtp"
                      >
                        {saveMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Testing & Saving...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            Test & Save Configuration
                          </>
                        )}
                      </Button>
                    </form>
                  </Form>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
