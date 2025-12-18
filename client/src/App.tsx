import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import Calculator from "@/pages/calculator";
import Landing from "@/pages/landing";
import AdminPanel from "@/pages/admin";
import Reports from "@/pages/reports";
import PaperSetup from "@/pages/paper-setup";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";

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

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();

  const { data: paperSetupStatus, isLoading: setupLoading } = useQuery<PaperSetupStatus>({
    queryKey: ["/api/paper-setup-status"],
    enabled: isAuthenticated
  });

  if (isLoading || (isAuthenticated && setupLoading)) {
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

  const isPaperSetupComplete = paperSetupStatus?.completed ?? false;
  const isOnPaperSetup = location === "/paper-setup";
  const isOnAdmin = location === "/admin";
  const isOnSettings = location === "/settings";

  if (!isPaperSetupComplete && !isOnPaperSetup && !isOnAdmin && !isOnSettings) {
    return <Redirect to="/paper-setup" />;
  }

  return (
    <Switch>
      <Route path="/" component={Calculator} />
      <Route path="/paper-setup" component={PaperSetup} />
      <Route path="/admin" component={AdminPanel} />
      <Route path="/reports" component={Reports} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
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
