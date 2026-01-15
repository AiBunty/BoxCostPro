import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Activity, TrendingUp } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

interface ProviderHealth {
  provider: string;
  status: 'healthy' | 'degraded' | 'down';
  lastChecked: string;
  successCount: number;
  failureCount: number;
  successRate: number;
  avgDeliveryTimeMs: number;
}

interface EmailHealth {
  timestamp: string;
  providers: ProviderHealth[];
  recentLogs: any[];
}

export function EmailHealthDashboard() {
  const { data: health, isLoading, error } = useQuery<EmailHealth>({
    queryKey: ["/api/admin/email-health"],
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'degraded':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'down':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Activity className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-500/20 text-green-700 dark:text-green-300';
      case 'degraded':
        return 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300';
      case 'down':
        return 'bg-red-500/20 text-red-700 dark:text-red-300';
      default:
        return 'bg-gray-500/20 text-gray-700 dark:text-gray-300';
    }
  };

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 95) return 'text-green-600 dark:text-green-400';
    if (rate >= 90) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Email Provider Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Email Provider Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load email health data. Please try again later.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Email Provider Health
            </CardTitle>
            <CardDescription>
              Monitor your email provider status and performance metrics
            </CardDescription>
          </div>
          {health && (
            <p className="text-xs text-muted-foreground">
              Last updated: {new Date(health.timestamp).toLocaleTimeString()}
            </p>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {health?.providers && health.providers.length > 0 ? (
          <div className="space-y-3">
            {health.providers.map((provider) => (
              <div
                key={provider.provider}
                className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(provider.status)}
                    <div>
                      <p className="font-medium capitalize">{provider.provider}</p>
                      <p className="text-xs text-muted-foreground">
                        Last checked: {new Date(provider.lastChecked).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <Badge className={getStatusColor(provider.status)}>
                    {provider.status.charAt(0).toUpperCase() + provider.status.slice(1)}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div className="p-2 rounded bg-muted/50">
                    <p className="text-muted-foreground text-xs">Success Rate</p>
                    <p className={`font-semibold ${getSuccessRateColor(provider.successRate)}`}>
                      {provider.successRate.toFixed(1)}%
                    </p>
                  </div>
                  <div className="p-2 rounded bg-muted/50">
                    <p className="text-muted-foreground text-xs">Sent</p>
                    <p className="font-semibold">{provider.successCount}</p>
                  </div>
                  <div className="p-2 rounded bg-muted/50">
                    <p className="text-muted-foreground text-xs">Failed</p>
                    <p className="font-semibold text-red-600 dark:text-red-400">
                      {provider.failureCount}
                    </p>
                  </div>
                  <div className="p-2 rounded bg-muted/50">
                    <p className="text-muted-foreground text-xs">Avg Delivery</p>
                    <p className="font-semibold">{provider.avgDeliveryTimeMs}ms</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No email providers configured yet. Configure an email provider to see health metrics.
            </AlertDescription>
          </Alert>
        )}

        {health?.providers && health.providers.length > 0 && (
          <div className="pt-4 border-t">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-medium text-sm">System Status</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <p className="text-muted-foreground text-xs">Healthy Providers</p>
                <p className="font-semibold text-green-600 dark:text-green-400">
                  {health.providers.filter(p => p.status === 'healthy').length}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <p className="text-muted-foreground text-xs">Degraded/Down</p>
                <p className="font-semibold text-yellow-600 dark:text-yellow-400">
                  {health.providers.filter(p => p.status !== 'healthy').length}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
