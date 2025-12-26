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
import AuthPage from "@/pages/auth";
import ResetPasswordPage from "@/pages/reset-password";
import CompleteProfilePage from "@/pages/complete-profile";
import AdminPanel from "@/pages/admin";
import AdminUsers from "@/pages/admin-users";
import Onboarding from "@/pages/onboarding";
import SupportPanel from "@/pages/support";
import NotFound from "@/pages/not-found";
import Settings from "@/pages/settings";

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

  const { data: user, isLoading: userLoading } = useQuery<any>({
    queryKey: ["/api/auth/user"],
  });

  const { data: paperSetupStatus, isLoading: setupLoading } = useQuery<PaperSetupStatus>({
    queryKey: ["/api/paper-setup-status"],
  });

  const { data: defaultCompany, isLoading: companyLoading } = useQuery<any>({
    queryKey: ["/api/company-profiles/default"],
    // return null on 404/401 handled by getQueryFn
  });

  const { data: fluteStatus, isLoading: fluteLoading } = useQuery<any>({
    queryKey: ["/api/flute-settings/status"],
  });

  if (userLoading || setupLoading) {
    if (companyLoading || fluteLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      );
    }
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const isProfileComplete = user?.mobileNo && user?.firstName;
  const isOnCompleteProfile = location === "/complete-profile";
  const isOnAdmin = location === "/admin";
  const isOnAccount = location === "/account";
  // Business Profile completion check (must complete Business Profile first)
  const isBusinessProfileComplete = !!(defaultCompany && defaultCompany.companyName && (defaultCompany.phone || defaultCompany.email));

  if (!isProfileComplete && !isOnCompleteProfile && !isOnAdmin && !isOnAccount) {
    return (
      <Switch>
        <Route path="/complete-profile" component={CompleteProfilePage} />
        <Redirect to="/complete-profile" />
      </Switch>
    );
  }
  // If user hasn't set Business Profile, force them to /settings (account tab)
  const isPaperSetupComplete = paperSetupStatus?.completed ?? false;
  const isMachineConfigured = fluteStatus?.configured ?? false;
  const isOnMasters = location.startsWith("/masters");

  if (!isBusinessProfileComplete && location !== "/settings" && !isOnAdmin && !isOnAccount && !isOnCompleteProfile) {
    return <Redirect to="/settings" />;
  }
  // After Business Profile, ensure machine/flute settings are configured before masters/paper setup
  if (!isMachineConfigured && !isOnMasters && !isOnAdmin && !isOnAccount && !isOnCompleteProfile && location !== "/settings") {
    return <Redirect to="/masters?tab=flute" />;
  }

  if (!isPaperSetupComplete && !isOnMasters && !isOnAdmin && !isOnAccount && !isOnCompleteProfile) {
    return <Redirect to="/masters?tab=paper" />;
  }

  return (
    <AppShell>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/create-quote" component={Calculator} />
        <Route path="/settings" component={Settings} />
        <Route path="/bulk-upload" component={BulkUpload} />
        <Route path="/quotes" component={Quotes} />
        <Route path="/reports" component={Reports} />
        <Route path="/masters" component={Masters} />
        <Route path="/account" component={Account} />
        <Route path="/admin" component={AdminPanel} />
        <Route path="/admin/users" component={AdminUsers} />
        <Route path="/onboarding" component={Onboarding} />
        <Route path="/support" component={SupportPanel} />
        <Route path="/complete-profile" component={CompleteProfilePage} />
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
        <Route path="/auth" component={AuthPage} />
        <Route path="/auth/callback" component={AuthCallback} />
        <Route path="/auth/reset-password" component={ResetPasswordPage} />
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
