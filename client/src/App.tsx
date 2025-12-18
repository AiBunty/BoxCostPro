import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { AppShell } from "@/components/layout/AppShell";
import Dashboard from "@/pages/dashboard";
import CalculatorComponent from "@/pages/calculator";
import Quotes from "@/pages/quotes";
import Reports from "@/pages/reports";
import Masters from "@/pages/masters";
import Account from "@/pages/account";
import Landing from "@/pages/landing";
import AdminPanel from "@/pages/admin";
import NotFound from "@/pages/not-found";

// Wrapper components for routes
function Calculator() {
  return <CalculatorComponent />;
}

function BulkUpload() {
  return <CalculatorComponent initialShowBulkUpload={true} />;
}

function AuthCallback() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        }
        setLocation("/");
      });
    } else {
      setLocation("/");
    }
  }, [setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  );
}

interface PaperSetupStatus {
  completed: boolean;
  rules: any;
  pricesCount: number;
}

function AuthenticatedRouter() {
  const [location] = useLocation();

  const { data: paperSetupStatus, isLoading: setupLoading } = useQuery<PaperSetupStatus>({
    queryKey: ["/api/paper-setup-status"],
  });

  if (setupLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const isPaperSetupComplete = paperSetupStatus?.completed ?? false;
  const isOnMasters = location.startsWith("/masters");
  const isOnAdmin = location === "/admin";
  const isOnAccount = location === "/account";

  if (!isPaperSetupComplete && !isOnMasters && !isOnAdmin && !isOnAccount) {
    return <Redirect to="/masters" />;
  }

  return (
    <AppShell>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/create-quote" component={Calculator} />
        <Route path="/bulk-upload" component={BulkUpload} />
        <Route path="/quotes" component={Quotes} />
        <Route path="/reports" component={Reports} />
        <Route path="/masters" component={Masters} />
        <Route path="/account" component={Account} />
        <Route path="/admin" component={AdminPanel} />
        <Route component={NotFound} />
      </Switch>
    </AppShell>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/auth/callback" component={AuthCallback} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  return <AuthenticatedRouter />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
