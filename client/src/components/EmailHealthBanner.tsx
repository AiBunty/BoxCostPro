import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Settings } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

interface EmailHealthStatus {
  status: 'healthy' | 'unhealthy';
  configured: boolean;
  provider?: string;
  reason?: string;
  smtp?: {
    host: string;
    port: number;
    encryption: string;
  };
}

export function EmailHealthBanner() {
  const { data: health } = useQuery<EmailHealthStatus>({
    queryKey: ['/api/system/health/email'],
    refetchInterval: 60000, // Check every 60 seconds
    retry: false,
  });

  // Only show banner if unhealthy
  if (!health || health.status === 'healthy') {
    return null;
  }

  const providerLabel = health.provider ? `(${health.provider.toUpperCase()})` : '';

  return (
    <Alert variant="destructive" className="mb-4 border-red-500 bg-red-50">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <div>
          <strong className="font-semibold">⚠ Email System Misconfigured {providerLabel}</strong>
          <p className="text-sm mt-1">
            System emails will not be sent. <br />
            Reason: {health.reason || 'Unknown error'}
          </p>
        </div>
        <Link href="/admin/email-settings">
          <Button variant="outline" size="sm" className="ml-4">
            <Settings className="h-4 w-4 mr-2" />
            Configure Email Settings
          </Button>
        </Link>
      </AlertDescription>
    </Alert>
  );
}

// Hook to check email health before saving settings
export function useEmailHealth() {
  const { data: health, isLoading } = useQuery<EmailHealthStatus>({
    queryKey: ['/api/system/health/email'],
    retry: false,
  });

  const isHealthy = health?.status === 'healthy';
  const canSaveSettings = isHealthy || health?.configured === false; // Allow saving if not configured yet
  const healthReason = health?.reason;
  const provider = health?.provider;

  return {
    isHealthy,
    canSaveSettings,
    healthReason,
    provider,
    isLoading,
  };
}
