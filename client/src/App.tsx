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
import Terms from "@/pages/terms";
import Privacy from "@/pages/privacy";
import About from "@/pages/about";
import Pricing from "@/pages/pricing";
import Contact from "@/pages/contact";
import Settings from "@/pages/settings";
// (duplicate import removed)

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

  const { data: onboardingStatus } = useQuery<any>({
    queryKey: ["/api/onboarding/status"],
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

  const sessionOnlyAuth = !isSupabaseConfigured; // In session-only/DB-less mode, be lenient
  const isProfileComplete = user?.mobileNo && user?.firstName;
  const isOnCompleteProfile = location === "/complete-profile";
  const isOnAdmin = location === "/admin";
  const isOnAccount = location === "/account";
  // Business Profile completion check - only require companyName
  // Email/phone are now auto-filled from user profile, so guard is more lenient
  const isBusinessProfileComplete = !!(defaultCompany && defaultCompany.companyName);

  if (!sessionOnlyAuth && !isProfileComplete && !isOnCompleteProfile && !isOnAdmin && !isOnAccount) {
    return (
      <Switch>
        <Route path="/complete-profile" component={CompleteProfilePage} />
        <Redirect to="/complete-profile" />
      </Switch>
    );
  }
  // If user hasn't set Business Profile, force them to /account (single source of truth)
  const isPaperSetupComplete = paperSetupStatus?.completed ?? false;
  const isMachineConfigured = fluteStatus?.configured ?? false;
  const isOnMasters = location.startsWith("/masters");

  if (!sessionOnlyAuth && !isBusinessProfileComplete && location !== "/account" && !isOnAdmin && !isOnAccount && !isOnCompleteProfile) {
    return <Redirect to="/account" />;
  }
  // After Business Profile, ensure Paper Pricing is configured BEFORE Flute settings
  if (!sessionOnlyAuth && !isPaperSetupComplete && !isOnMasters && !isOnAdmin && !isOnAccount && !isOnCompleteProfile) {
    return <Redirect to="/masters?tab=paper" />;
  }

  if (!sessionOnlyAuth && !isMachineConfigured && !isOnMasters && !isOnAdmin && !isOnAccount && !isOnCompleteProfile && location !== "/account") {
    return <Redirect to="/masters?tab=flute" />;
  }

  // After setup steps, if not paid-active, send to Onboarding page for submission/wait
  const isPaidActive = !!onboardingStatus?.paidActive;
  const isOnOnboarding = location === "/onboarding";
  if (!sessionOnlyAuth && !isPaidActive && !isOnOnboarding && !isOnAdmin && !isOnAccount && !isOnCompleteProfile) {
    return <Redirect to="/onboarding" />;
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
        <Route path="/onboarding" component={Onboarding} />
        <Route path="/admin" component={AdminPanel} />
        <Route path="/admin/users" component={AdminUsers} />
        <Route path="/onboarding" component={Onboarding} />
        <Route path="/support" component={SupportPanel} />
        <Route path="/about" component={About} />
        <Route path="/pricing" component={Pricing} />
        <Route path="/contact" component={Contact} />
        <Route path="/terms" component={Terms} />
        <Route path="/privacy" component={Privacy} />
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
        <Route path="/about" component={About} />
        <Route path="/pricing" component={Pricing} />
        <Route path="/contact" component={Contact} />
        <Route path="/terms" component={Terms} />
        <Route path="/privacy" component={Privacy} />
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
