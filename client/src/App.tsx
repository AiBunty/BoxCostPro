import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Calculator from "@/pages/calculator";
import Landing from "@/pages/landing";
import AdminPanel from "@/pages/admin";
import Reports from "@/pages/reports";
import PaperSetup from "@/pages/paper-setup";
import NotFound from "@/pages/not-found";

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
        <Route component={NotFound} />
      </Switch>
    );
  }

  const isPaperSetupComplete = paperSetupStatus?.completed ?? false;
  const isOnPaperSetup = location === "/paper-setup";
  const isOnAdmin = location === "/admin";

  if (!isPaperSetupComplete && !isOnPaperSetup && !isOnAdmin) {
    return <Redirect to="/paper-setup" />;
  }

  return (
    <Switch>
      <Route path="/" component={Calculator} />
      <Route path="/paper-setup" component={PaperSetup} />
      <Route path="/admin" component={AdminPanel} />
      <Route path="/reports" component={Reports} />
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
