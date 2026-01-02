import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient, setClerkTokenGetter } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ClerkProvider, useAuth as useClerkAuth } from "@clerk/clerk-react";
import Dashboard from "@/pages/dashboard";
import CalculatorComponent from "@/pages/calculator";
import Quotes from "@/pages/quotes";
import Reports from "@/pages/reports";
import Masters from "@/pages/masters";
import Account from "@/pages/account";
import Landing from "@/pages/landing";
import AuthPage from "@/pages/auth";
import CompleteProfilePage from "@/pages/complete-profile";
import Onboarding from "@/pages/onboarding";
import SupportPanel from "@/pages/support";
import NotFound from "@/pages/not-found";
import Terms from "@/pages/terms";
import Privacy from "@/pages/privacy";
import About from "@/pages/about";
import Pricing from "@/pages/pricing";
import Contact from "@/pages/contact";
import SignupFlow from "@/pages/signup-flow";
import PaymentSuccess from "@/pages/payment-success";
import SellerSetup from "@/pages/seller-setup";
// Settings page is deprecated; use Master Settings under /masters
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
    // With Clerk, auth is handled automatically via JWT
    // Simply redirect to home and let Clerk handle the session
    queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    setLocation("/");
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

// When unauthenticated users land deep-linked on protected pages, send them to auth
function GuestRedirect() {
  const [location] = useLocation();
  const next = encodeURIComponent(location || "/");
  return <Redirect to={`/auth?next=${next}`} />;
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

  const adminRoles = ["admin", "super_admin", "owner", "support_agent", "support_manager"];
  const isAdmin = adminRoles.includes(user?.role || "");

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

  // Clerk auth is configured, enforce all gates
  const sessionOnlyAuth = false;
  const isProfileComplete = user?.mobileNo && user?.firstName;
  const isOnCompleteProfile = location === "/complete-profile";
  const isOnAccount = location === "/account";
  const isOnAdmin = location.startsWith('/admin');
  // Business Profile completion check - only require companyName
  // Email/phone are now auto-filled from user profile, so guard is more lenient
  const isBusinessProfileComplete = !!(defaultCompany && defaultCompany.companyName);

  if (!isAdmin && !sessionOnlyAuth && !isProfileComplete && !isOnCompleteProfile && !isOnAccount) {
    return (
      <Switch>
        <Route path="/complete-profile" component={CompleteProfilePage} />
        <Redirect to="/complete-profile" />
      </Switch>
    );
  }
  if (isAdmin && isOnAdmin) {
    return <Redirect to="/" />;
  }
  // If user hasn't set Business Profile, force them to /account (single source of truth)
  const isPaperSetupComplete = paperSetupStatus?.completed ?? false;
  const isMachineConfigured = fluteStatus?.configured ?? false;
  const isOnMasters = location.startsWith("/masters");

  if (!isAdmin && !sessionOnlyAuth && !isBusinessProfileComplete && location !== "/account" && !isOnAccount && !isOnCompleteProfile) {
    return <Redirect to="/account" />;
  }
  // After Business Profile, ensure Paper Pricing is configured BEFORE Flute settings
  if (!isAdmin && !sessionOnlyAuth && !isPaperSetupComplete && !isOnMasters && !isOnAccount && !isOnCompleteProfile) {
    return <Redirect to="/masters?tab=paper" />;
  }

  if (!isAdmin && !sessionOnlyAuth && !isMachineConfigured && !isOnMasters && !isOnAccount && !isOnCompleteProfile && location !== "/account") {
    return <Redirect to="/masters?tab=flute" />;
  }

  // After setup steps, enforce verification gate
  const isVerified = onboardingStatus?.verificationStatus === 'approved';
  const isOnOnboarding = location === "/onboarding";

  // Block access to main features if not verified
  const blockedPaths = ['/dashboard', '/create-quote', '/quotes', '/reports', '/bulk-upload'];
  const isOnBlockedPath = blockedPaths.some(path => location.startsWith(path)) || location === '/';

  if (!isAdmin && !sessionOnlyAuth && !isVerified && isOnBlockedPath && !isOnOnboarding && !isOnAccount && !isOnCompleteProfile) {
    return <Redirect to="/onboarding" />;
  }

  return (
    <AppShell>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/create-quote" component={Calculator} />
        {/* Redirect legacy Settings route to Master Settings tab */}
        <Route path="/settings">
          {() => <Redirect to="/masters?tab=settings" />}
        </Route>
        <Route path="/bulk-upload" component={BulkUpload} />
        <Route path="/quotes" component={Quotes} />
        <Route path="/reports" component={Reports} />
        <Route path="/masters" component={Masters} />
        <Route path="/account" component={Account} />
        <Route path="/onboarding" component={Onboarding} />
        <Route path="/seller-setup" component={SellerSetup} />
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
        <Route path="/auth/:pathname" component={AuthPage} />
        <Route path="/auth/callback" component={AuthCallback} />
        <Route path="/signup" component={SignupFlow} />
        <Route path="/payment-success" component={PaymentSuccess} />
        <Route path="/about" component={About} />
        <Route path="/pricing" component={Pricing} />
        <Route path="/contact" component={Contact} />
        <Route path="/terms" component={Terms} />
        <Route path="/privacy" component={Privacy} />
        {/* Catch-all: unauthenticated deep links */}
        <Route path="/:rest*" component={GuestRedirect} />
      </Switch>
    );
  }

  return <AuthenticatedRouter />;
}

/**
 * ClerkAuthInjector - Injects Clerk's getToken into queryClient
 * Must be inside ClerkProvider to access useAuth hook
 */
function ClerkAuthInjector({ children }: { children: React.ReactNode }) {
  const { getToken } = useClerkAuth();

  useEffect(() => {
    // Inject Clerk token getter into queryClient
    setClerkTokenGetter(async () => {
      try {
        const token = await getToken();
        return token;
      } catch (error) {
        console.error('[Clerk] Failed to get token:', error);
        return null;
      }
    });
  }, [getToken]);

  return <>{children}</>;
}

function App() {
  const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

  // CRITICAL: Fail-fast if Clerk publishable key is missing
  if (!publishableKey) {
    console.error(
      '🚨 CLERK INITIALIZATION FAILED\n' +
      '================================\n' +
      'Missing: VITE_CLERK_PUBLISHABLE_KEY\n' +
      '\n' +
      'Required in: .env file in project root\n' +
      '\n' +
      'Format:\n' +
      'VITE_CLERK_PUBLISHABLE_KEY=pk_test_...\n' +
      '\n' +
      '⚠️  IMPORTANT: Restart dev server after adding env variable!\n' +
      '   Vite does NOT hot-reload environment variables.\n'
    );
    throw new Error(
      "Missing VITE_CLERK_PUBLISHABLE_KEY environment variable. " +
      "Check console for setup instructions."
    );
  }

  // Dev-time verification
  if (import.meta.env.DEV) {
    console.log('✅ Clerk initialized with publishable key:', 
      publishableKey.substring(0, 20) + '...');
  }

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <ClerkAuthInjector>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </QueryClientProvider>
      </ClerkAuthInjector>
    </ClerkProvider>
  );
}

export default App;
