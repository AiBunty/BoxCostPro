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
} from "lucide-react";

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

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here's an overview of your business.
        </p>
      </div>

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
    </div>
  );
}
