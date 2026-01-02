import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldX, Package, Mail, HelpCircle } from "lucide-react";
import { signOut } from "@/hooks/useAuth";

interface AccountSuspendedPageProps {
  reason?: string;
}

export default function AccountSuspendedPage({ reason }: AccountSuspendedPageProps) {
  const [, navigate] = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleContactSupport = () => {
    window.location.href = "mailto:support@paperboxerp.com?subject=Account%20Suspension%20Appeal";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-red-50 to-white dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md border-destructive/20">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex items-center gap-2">
              <Package className="h-8 w-8 text-primary" />
              <span className="text-2xl font-bold">PaperBox ERP</span>
            </div>
          </div>
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 bg-destructive/10 rounded-full flex items-center justify-center">
              <ShieldX className="h-8 w-8 text-destructive" />
            </div>
          </div>
          <CardTitle className="text-destructive">Account Suspended</CardTitle>
          <CardDescription>
            Your account has been temporarily suspended. This may be due to a violation of our terms of service or unusual activity detected on your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {reason && (
            <div className="bg-destructive/5 border border-destructive/20 p-4 rounded-lg">
              <p className="font-medium text-sm text-destructive mb-1">Reason for suspension:</p>
              <p className="text-sm text-muted-foreground">{reason}</p>
            </div>
          )}

          <div className="bg-muted p-4 rounded-lg space-y-2">
            <p className="font-medium text-sm">What can you do?</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>Contact our support team to appeal this decision</li>
              <li>Review our terms of service</li>
              <li>Check your email for more details</li>
            </ul>
          </div>

          <Button 
            className="w-full" 
            onClick={handleContactSupport}
            data-testid="button-contact-support"
          >
            <Mail className="mr-2 h-4 w-4" />
            Contact Support
          </Button>

          <Button 
            variant="outline" 
            className="w-full" 
            onClick={() => window.open('https://paperboxerp.com/terms', '_blank')}
            data-testid="button-view-terms"
          >
            <HelpCircle className="mr-2 h-4 w-4" />
            View Terms of Service
          </Button>

          <Button 
            variant="ghost" 
            className="w-full" 
            onClick={handleSignOut}
            data-testid="button-signout"
          >
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
