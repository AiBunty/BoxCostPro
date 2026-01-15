import { Switch, Route, Redirect, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/layout/AppShell";
import { useEffect } from "react";
import { queryClient } from "@/shared/lib/queryClient";

// User Pages
import Dashboard from "@/app/pages/dashboard";
import CalculatorComponent from "@/app/pages/calculator";
import Quotes from "@/app/pages/quotes";
import Reports from "@/app/pages/reports";
import Masters from "@/app/pages/masters";
import Account from "@/app/pages/account";
import Landing from "@/app/pages/landing";
import CompleteProfilePage from "@/app/pages/complete-profile";
import Onboarding from "@/app/pages/onboarding";
import OnboardingWizard from "@/app/pages/onboarding-wizard";
import OnboardingRejected from "@/app/pages/onboarding-rejected";
import SellerSetup from "@/app/pages/seller-setup";
import SignupFlow from "@/app/pages/signup-flow";
import PaymentSuccess from "@/app/pages/payment-success";
import PricingPage from "@/app/pages/pricing";

// Shared Pages
import AuthPage from "@/shared/components/auth";
import SupportPanel from "@/shared/components/support";
import NotFound from "@/shared/components/not-found";
import Terms from "@/shared/components/terms";
import Privacy from "@/shared/components/privacy";
import About from "@/shared/components/about";
import Contact from "@/shared/components/contact";
import { ApprovalBlockModal } from "@/shared/components/ApprovalBlockModal";

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
    // Clerk handles auth, just invalidate and redirect
    queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    // Route new logins to onboarding; approved users will be redirected forward by gates
    setLocation("/onboarding");
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
  });

  const { data: fluteStatus, isLoading: fluteLoading } = useQuery<any>({
    queryKey: ["/api/flute-settings/status"],
  });

  const { data: setupStatus } = useQuery<any>({
    queryKey: ["/api/user/setup/status"],
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

  // SECURITY: Block admin-only accounts from accessing user app
  const ADMIN_ONLY_ROLES = ['super_admin', 'admin', 'support_manager', 'support_agent'];
  if (ADMIN_ONLY_ROLES.includes(user?.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center max-w-md p-8 bg-white rounded-2xl shadow-xl">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🔐</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Admin Account Detected</h1>
          <p className="text-muted-foreground mb-2">
            This is an <strong>administrator account</strong> and cannot access the user application.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Role: <span className="font-semibold text-red-600">{user?.role}</span>
          </p>
          <div className="space-y-3">
            <a 
              href="/admin" 
              className="block w-full px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
            >
              Go to Admin Panel
            </a>
            <button 
              onClick={() => window.location.href = '/auth'}
              className="block w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Sign Out & Login as User
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Clerk auth is configured, enforce all gates (not session-only mode)
  const sessionOnlyAuth = false;
  const isProfileComplete = user?.mobileNo && user?.firstName;
  const isOnCompleteProfile = location === "/complete-profile";
  const isOnAccount = location === "/account";
  const isOnOnboardingWizard = location === "/onboarding-wizard";
  const isBusinessProfileComplete = !!(defaultCompany && defaultCompany.companyName && (defaultCompany.phone || defaultCompany.email));
  
  // Get verification status
  const verificationStatus = setupStatus?.verificationStatus || 'NOT_SUBMITTED';
  const isPending = verificationStatus === 'PENDING';
  const isApproved = verificationStatus === 'APPROVED';
  const setupProgress = setupStatus?.setupProgress || 0;

  // User profile completion guard
  if (!sessionOnlyAuth && !isProfileComplete && !isOnCompleteProfile && !isOnAccount && !isOnOnboardingWizard) {
    return (
      <Switch>
        <Route path="/complete-profile" component={CompleteProfilePage} />
        <Redirect to="/complete-profile" />
      </Switch>
    );
  }

  // Business profile setup guard - redirect to wizard if not complete and not approved
  if (!sessionOnlyAuth && !isBusinessProfileComplete && setupProgress < 100 && !isPending && !isApproved && !isOnOnboardingWizard && !isOnCompleteProfile && !isOnAccount) {
    return <Redirect to="/onboarding-wizard" />;
  }

  // Approved users can proceed, everything else is optional post-approval
  if (!sessionOnlyAuth && setupProgress < 100 && !isPending && !isApproved && !isOnOnboardingWizard && !isOnCompleteProfile && !isOnAccount && location !== "/onboarding") {
    return <Redirect to="/onboarding-wizard" />;
  }

  // ========== VERIFICATION GATE WITH NON-DISMISSIBLE MODAL ==========
  const isOnOnboarding = location === "/onboarding";
  const isSubmitted = !!setupStatus?.submittedForVerification;
  const isRejected = verificationStatus === 'REJECTED';

  const blockedPaths = ['/dashboard', '/create-quote', '/quotes', '/reports', '/bulk-upload'];
  const isOnBlockedPath = blockedPaths.some(path => location.startsWith(path)) || location === '/';

  // CRITICAL: Show NON-DISMISSIBLE modal for pending/rejected status
  // This modal cannot be bypassed by navigation
  if (!sessionOnlyAuth && !isApproved) {
    // Pending users: force onboarding experience
    if (isPending && location !== '/onboarding') {
      return <Redirect to="/onboarding" />;
    }

    // Rejected users: send to dedicated rejected page
    if (isRejected && location !== '/onboarding/rejected') {
      return <Redirect to="/onboarding/rejected" />;
    }

    // Not yet submitted: block protected pages until onboarding
    if (!isSubmitted && isOnBlockedPath && !isOnOnboarding && !isOnAccount && !isOnCompleteProfile) {
      return <Redirect to="/onboarding" />;
    }
  }

  return (
    <AppShell>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/create-quote" component={Calculator} />
        <Route path="/settings">
          {() => <Redirect to="/masters?tab=settings" />}
        </Route>
        <Route path="/bulk-upload" component={BulkUpload} />
        <Route path="/quotes" component={Quotes} />
        <Route path="/reports" component={Reports} />
        <Route path="/masters" component={Masters} />
        <Route path="/account" component={Account} />
        <Route path="/account-settings">
          {() => <Redirect to="/account" />}
        </Route>
        <Route path="/onboarding-wizard" component={OnboardingWizard} />
        <Route path="/onboarding" component={Onboarding} />
        <Route path="/onboarding/rejected">
          {() => <OnboardingRejected reason={setupStatus?.rejectionReason} />}
        </Route>
        <Route path="/seller-setup" component={SellerSetup} />
        <Route path="/support" component={SupportPanel} />
        <Route path="/about" component={About} />
        <Route path="/pricing" component={PricingPage} />
        <Route path="/contact" component={Contact} />
        <Route path="/terms" component={Terms} />
        <Route path="/privacy" component={Privacy} />
        <Route path="/complete-profile" component={CompleteProfilePage} />
        <Route component={NotFound} />
      </Switch>
    </AppShell>
  );
}

export function AppRouter() {
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
        <Route path="/pricing" component={PricingPage} />
        <Route path="/contact" component={Contact} />
        <Route path="/terms" component={Terms} />
        <Route path="/privacy" component={Privacy} />
        <Route path="/:rest*" component={GuestRedirect} />
      </Switch>
    );
  }

  return <AuthenticatedRouter />;
}
