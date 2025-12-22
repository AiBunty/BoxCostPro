import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Mail, CheckCircle, XCircle, AlertTriangle, Send, TrendingUp, Clock, RefreshCw } from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { queryClient } from "@/lib/queryClient";

interface EmailStats {
  total: number;
  sent: number;
  delivered: number;
  bounced: number;
  failed: number;
  byProvider: Record<string, number>;
  byChannel: Record<string, number>;
}

interface EmailLog {
  id: string;
  recipientEmail: string;
  senderEmail: string;
  subject: string;
  provider: string;
  channel: string;
  status: string;
  messageId?: string;
  failureReason?: string;
  quoteId?: string;
  sentAt: string;
}

interface EmailBounce {
  id: string;
  emailLogId: string;
  recipientEmail: string;
  bounceType: string;
  bounceReason?: string;
  provider?: string;
  occurredAt: string;
}

export default function EmailAnalyticsTab() {
  const [dateRange, setDateRange] = useState("7d");
  const [statusFilter, setStatusFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");

  const getDateParams = () => {
    const now = new Date();
    let startDate: Date;
    
    switch (dateRange) {
      case "1d":
        startDate = startOfDay(now);
        break;
      case "7d":
        startDate = subDays(now, 7);
        break;
      case "30d":
        startDate = subDays(now, 30);
        break;
      case "90d":
        startDate = subDays(now, 90);
        break;
      default:
        startDate = subDays(now, 7);
    }
    
    return {
      startDate: startDate.toISOString(),
      endDate: endOfDay(now).toISOString()
    };
  };

  const buildQueryParams = () => {
    const { startDate, endDate } = getDateParams();
    const params = new URLSearchParams();
    params.append("startDate", startDate);
    params.append("endDate", endDate);
    if (statusFilter !== "all") params.append("status", statusFilter);
    if (channelFilter !== "all") params.append("channel", channelFilter);
    return params.toString();
  };

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<EmailStats>({
    queryKey: ["/api/email-analytics/stats", dateRange],
    queryFn: async () => {
      const { startDate, endDate } = getDateParams();
      const response = await fetch(`/api/email-analytics/stats?startDate=${startDate}&endDate=${endDate}`, {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Failed to fetch stats");
      return response.json();
    }
  });

  const { data: logs = [], isLoading: logsLoading } = useQuery<EmailLog[]>({
    queryKey: ["/api/email-analytics/logs", dateRange, statusFilter, channelFilter],
    queryFn: async () => {
      const response = await fetch(`/api/email-analytics/logs?${buildQueryParams()}`, {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Failed to fetch logs");
      return response.json();
    }
  });

  const { data: bounces = [] } = useQuery<EmailBounce[]>({
    queryKey: ["/api/email-analytics/bounces"],
  });

  const { data: bouncedRecipients = [] } = useQuery<string[]>({
    queryKey: ["/api/email-analytics/bounced-recipients"],
  });

  const handleRefresh = () => {
    refetchStats();
    queryClient.invalidateQueries({ queryKey: ["/api/email-analytics/logs"] });
    queryClient.invalidateQueries({ queryKey: ["/api/email-analytics/bounces"] });
    queryClient.invalidateQueries({ queryKey: ["/api/email-analytics/bounced-recipients"] });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return <Badge variant="secondary" data-testid="badge-status-sent"><Send className="w-3 h-3 mr-1" />Sent</Badge>;
      case "delivered":
        return <Badge variant="default" className="bg-green-600" data-testid="badge-status-delivered"><CheckCircle className="w-3 h-3 mr-1" />Delivered</Badge>;
      case "bounced":
        return <Badge variant="destructive" data-testid="badge-status-bounced"><AlertTriangle className="w-3 h-3 mr-1" />Bounced</Badge>;
      case "failed":
        return <Badge variant="destructive" data-testid="badge-status-failed"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline" data-testid="badge-status-unknown">{status}</Badge>;
    }
  };

  const getChannelLabel = (channel: string) => {
    switch (channel) {
      case "quote":
        return "Quote";
      case "followup":
        return "Follow-up";
      case "system":
        return "System";
      case "confirmation":
        return "Confirmation";
      default:
        return channel;
    }
  };

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const successRate = stats && stats.total > 0 
    ? ((stats.sent + stats.delivered) / stats.total * 100).toFixed(1)
    : "0.0";

  const bounceRate = stats && stats.total > 0 
    ? (stats.bounced / stats.total * 100).toFixed(1)
    : "0.0";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Email Delivery Analytics</h3>
          <p className="text-sm text-muted-foreground">
            Track email delivery rates and bounce analytics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[130px]" data-testid="select-date-range">
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1d">Today</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={handleRefresh} data-testid="button-refresh-stats">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sent</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-sent">{stats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">emails in period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-success-rate">{successRate}%</div>
            <p className="text-xs text-muted-foreground">{(stats?.sent || 0) + (stats?.delivered || 0)} successful</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bounced</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500" data-testid="text-bounce-rate">{bounceRate}%</div>
            <p className="text-xs text-muted-foreground">{stats?.bounced || 0} bounced</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500" data-testid="text-failed-count">{stats?.failed || 0}</div>
            <p className="text-xs text-muted-foreground">delivery failures</p>
          </CardContent>
        </Card>
      </div>

      {bouncedRecipients.length > 0 && (
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              Bounced Email Addresses ({bouncedRecipients.length})
            </CardTitle>
            <CardDescription>
              These email addresses have hard-bounced. Consider removing them from your contact list.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {bouncedRecipients.slice(0, 10).map((email, idx) => (
                <Badge key={idx} variant="outline" className="text-orange-700 border-orange-300" data-testid={`badge-bounced-email-${idx}`}>
                  {email}
                </Badge>
              ))}
              {bouncedRecipients.length > 10 && (
                <Badge variant="outline" className="text-muted-foreground">
                  +{bouncedRecipients.length - 10} more
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Email Log</CardTitle>
              <CardDescription>Recent email activity</CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[120px]" data-testid="select-status-filter">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="bounced">Bounced</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={channelFilter} onValueChange={setChannelFilter}>
                <SelectTrigger className="w-[120px]" data-testid="select-channel-filter">
                  <SelectValue placeholder="Channel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Channels</SelectItem>
                  <SelectItem value="quote">Quote</SelectItem>
                  <SelectItem value="followup">Follow-up</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No emails sent yet</p>
              <p className="text-sm">Send your first quote to see analytics here</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {logs.map((log) => (
                <div 
                  key={log.id} 
                  className="flex items-start justify-between p-3 border rounded-lg hover-elevate"
                  data-testid={`row-email-log-${log.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusBadge(log.status)}
                      <Badge variant="outline" className="text-xs">
                        {getChannelLabel(log.channel)}
                      </Badge>
                    </div>
                    <p className="font-medium text-sm truncate" data-testid="text-log-recipient">
                      To: {log.recipientEmail}
                    </p>
                    <p className="text-sm text-muted-foreground truncate" data-testid="text-log-subject">
                      {log.subject}
                    </p>
                    {log.failureReason && (
                      <p className="text-xs text-red-500 mt-1 truncate" data-testid="text-log-error">
                        {log.failureReason}
                      </p>
                    )}
                  </div>
                  <div className="text-right text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {format(new Date(log.sentAt), "MMM d, h:mm a")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {stats && Object.keys(stats.byProvider || {}).length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">By Provider</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(stats.byProvider).map(([provider, count]) => (
                  <div key={provider} className="flex items-center justify-between">
                    <span className="text-sm capitalize">{provider.replace('-', ' ')}</span>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">By Channel</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(stats.byChannel).map(([channel, count]) => (
                  <div key={channel} className="flex items-center justify-between">
                    <span className="text-sm">{getChannelLabel(channel)}</span>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
