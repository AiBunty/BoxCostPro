import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FilePlus,
  FileText,
  Users,
  TrendingUp,
  ArrowRight,
  Package,
  IndianRupee,
  Boxes,
  Sparkles,
  ShoppingCart,
  ClipboardList,
  FileCheck,
  Bell,
  Zap,
  UserCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";

interface Quote {
  id: string;
  partyName: string;
  totalAmount: number;
  createdAt: string;
  status: string;
}

interface DashboardStats {
  totalQuotes: number;
  totalParties: number;
  recentQuotes: Quote[];
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data: quotes, isLoading: quotesLoading } = useQuery<Quote[]>({
    queryKey: ["/api/quotes"],
  });

  const { data: parties, isLoading: partiesLoading } = useQuery<any[]>({
    queryKey: ["/api/party-profiles"],
  });

  const isLoading = quotesLoading || partiesLoading;

  const totalQuotes = quotes?.length || 0;
  const totalParties = parties?.length || 0;
  const recentQuotes = quotes?.slice(0, 5) || [];

  const totalValue = quotes?.reduce((sum, q) => sum + (q.totalAmount || 0), 0) || 0;

  // Show subtle card linking to onboarding when approval is pending and subscription is not paid-active
  const { data: setupStatus } = useQuery<any>({ queryKey: ["/api/user/setup/status"] });
  const verificationStatus = setupStatus?.verificationStatus || "NOT_SUBMITTED";
  const showPendingApprovalCard = verificationStatus !== "APPROVED";

  // Admin: show approvals shortcut if there are pending verifications
  const adminRoles = ["admin", "super_admin", "owner"];
  const isAdmin = adminRoles.includes(user?.role || "");
  const { data: pendingApprovals } = useQuery<any[]>({ queryKey: ["/api/admin/verifications/pending"] });
  const hasPendingApprovals = isAdmin && (pendingApprovals?.length || 0) > 0;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here's an overview of your business.
        </p>
      </div>

      {showPendingApprovalCard && (
        <Card className="shadow-sm border-primary/20 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Pending Approval</Badge>
              <CardTitle className="text-sm font-medium">Account awaiting verification</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Admin will review within 24–48 hours. Track status or submit if not yet done.
            </p>
            <Link href="/onboarding">
              <Button variant="outline" size="sm" className="gap-1">
                View status
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {hasPendingApprovals && (
        <Card className="shadow-sm border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <CardTitle className="text-sm font-medium">Admin: Approvals pending ({pendingApprovals!.length})</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              New verification requests are awaiting review.
            </p>
            <Link href="/admin/users">
              <Button variant="outline" size="sm" className="gap-1">
                View approvals
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Quotes</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{totalQuotes}</div>
            )}
            <p className="text-xs text-muted-foreground">All time quotes created</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Parties</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{totalParties}</div>
            )}
            <p className="text-xs text-muted-foreground">Customer profiles saved</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quote Value</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">
                ₹{totalValue.toLocaleString("en-IN")}
              </div>
            )}
            <p className="text-xs text-muted-foreground">Total quoted amount</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Link href="/create-quote">
              <Button className="w-full gap-2" data-testid="button-create-quote">
                <FilePlus className="h-4 w-4" />
                New Quote
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Recent Quotes</CardTitle>
                <CardDescription>Your latest quotations</CardDescription>
              </div>
              <Link href="/quotes">
                <Button variant="ghost" size="sm" className="gap-1">
                  View All
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : recentQuotes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No quotes yet</p>
                <Link href="/create-quote">
                  <Button variant="ghost" className="mt-2 text-primary">
                    Create your first quote
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentQuotes.map((quote) => (
                  <div
                    key={quote.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{quote.partyName || "Unnamed Party"}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(quote.createdAt).toLocaleDateString("en-IN")}
                      </p>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className="font-semibold">₹{(quote.totalAmount || 0).toLocaleString("en-IN")}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Getting Started</CardTitle>
            <CardDescription>Quick tips to get the most out of BoxCost</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
              <div className="shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                1
              </div>
              <div>
                <p className="font-medium">Set up your paper prices</p>
                <p className="text-sm text-muted-foreground">
                  Configure BF rates and shade premiums in Masters
                </p>
              </div>
            </div>

            <div className="flex gap-3 p-3 rounded-lg bg-muted/50">
              <div className="shrink-0 h-8 w-8 rounded-full bg-muted flex items-center justify-center font-semibold text-sm">
                2
              </div>
              <div>
                <p className="font-medium">Add your customers</p>
                <p className="text-sm text-muted-foreground">
                  Save party profiles for quick quote creation
                </p>
              </div>
            </div>

            <div className="flex gap-3 p-3 rounded-lg bg-muted/50">
              <div className="shrink-0 h-8 w-8 rounded-full bg-muted flex items-center justify-center font-semibold text-sm">
                3
              </div>
              <div>
                <p className="font-medium">Create your first quote</p>
                <p className="text-sm text-muted-foreground">
                  Calculate box costs and share with customers
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Coming Soon Modules Section */}
      <div className="space-y-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <Zap className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold tracking-tight">Coming Soon</h2>
          </div>
          <p className="text-muted-foreground">
            Not just a costing tool — your <span className="font-semibold text-primary">digital Sales Representative</span>
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Paper Stock Management */}
          <Card className="shadow-sm relative overflow-hidden opacity-75 cursor-not-allowed">
            <Badge className="absolute top-4 right-4 bg-amber-500 hover:bg-amber-500">
              Coming Soon
            </Badge>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Boxes className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-lg">Paper Stock Management</CardTitle>
              </div>
              <CardDescription className="mt-2">
                Track paper inventory, manage BF rolls, monitor stock levels, and get low-stock alerts automatically.
              </CardDescription>
            </CardHeader>
          </Card>

          {/* AI Suggestions */}
          <Card className="shadow-sm relative overflow-hidden opacity-75 cursor-not-allowed">
            <Badge className="absolute top-4 right-4 bg-amber-500 hover:bg-amber-500">
              Coming Soon
            </Badge>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/20">
                  <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <CardTitle className="text-lg">AI Price Suggestions</CardTitle>
              </div>
              <CardDescription className="mt-2">
                Get intelligent pricing recommendations based on market trends, material costs, and historical data.
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Purchase Order Planner */}
          <Card className="shadow-sm relative overflow-hidden opacity-75 cursor-not-allowed">
            <Badge className="absolute top-4 right-4 bg-amber-500 hover:bg-amber-500">
              Coming Soon
            </Badge>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/20">
                  <ShoppingCart className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <CardTitle className="text-lg">Purchase Order Planner</CardTitle>
              </div>
              <CardDescription className="mt-2">
                Convert quotes to purchase orders, track order status, and manage supplier relationships seamlessly.
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Job Card Generator */}
          <Card className="shadow-sm relative overflow-hidden opacity-75 cursor-not-allowed">
            <Badge className="absolute top-4 right-4 bg-amber-500 hover:bg-amber-500">
              Coming Soon
            </Badge>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/20">
                  <ClipboardList className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <CardTitle className="text-lg">Job Card Generator</CardTitle>
              </div>
              <CardDescription className="mt-2">
                Auto-generate production job cards with complete specifications, timelines, and quality checkpoints.
              </CardDescription>
            </CardHeader>
          </Card>

          {/* PDI / COA Generator */}
          <Card className="shadow-sm relative overflow-hidden opacity-75 cursor-not-allowed">
            <Badge className="absolute top-4 right-4 bg-amber-500 hover:bg-amber-500">
              Coming Soon
            </Badge>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/20">
                  <FileCheck className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <CardTitle className="text-lg">PDI / COA Generator</CardTitle>
              </div>
              <CardDescription className="mt-2">
                Generate Pre-Delivery Inspection reports and Certificates of Analysis with automated quality parameters.
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Auto Client Follow-ups */}
          <Card className="shadow-sm relative overflow-hidden opacity-75 cursor-not-allowed">
            <Badge className="absolute top-4 right-4 bg-amber-500 hover:bg-amber-500">
              Coming Soon
            </Badge>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-pink-100 dark:bg-pink-900/20">
                  <Bell className="h-5 w-5 text-pink-600 dark:text-pink-400" />
                </div>
                <CardTitle className="text-lg">Auto Client Follow-ups</CardTitle>
              </div>
              <CardDescription className="mt-2">
                Automated follow-up reminders via Email & WhatsApp for pending quotes, orders, and payments.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  );
}
