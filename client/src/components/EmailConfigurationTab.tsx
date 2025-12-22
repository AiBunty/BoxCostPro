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
import { Loader2, Mail, Shield, CheckCircle2, XCircle, ExternalLink, RefreshCw, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
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

  const { data: providers = [], isLoading: providersLoading } = useQuery<EmailProvider[]>({
    queryKey: ["/api/email-providers"],
  });

  const { data: settings, isLoading: settingsLoading, refetch: refetchSettings } = useQuery<EmailSettings>({
    queryKey: ["/api/email-settings"],
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

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/email-settings/smtp", {
        ...data,
        provider: selectedProvider,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-settings"] });
      toast({
        title: "Settings Saved",
        description: "Your email configuration has been saved. Click 'Verify' to test the connection.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save email settings",
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
                {providers.map((provider) => (
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
                  <Alert className="mb-4">
                    <Mail className="h-4 w-4" />
                    <AlertDescription>
                      {currentPreset.setupInstructions}
                    </AlertDescription>
                  </Alert>

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
                            <FormLabel>Password / App Password</FormLabel>
                            <FormControl>
                              <Input 
                                type="password" 
                                placeholder="Enter your app password" 
                                {...field}
                                data-testid="input-smtp-password"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button 
                        type="submit" 
                        className="w-full gap-2"
                        disabled={saveMutation.isPending}
                        data-testid="button-save-smtp"
                      >
                        {saveMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Mail className="h-4 w-4" />
                        )}
                        Save & Verify
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
