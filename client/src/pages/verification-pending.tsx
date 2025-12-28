import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, RefreshCw, Package, CheckCircle } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { signOut } from "@/lib/supabase";

interface VerificationPendingPageProps {
  email?: string;
}

export default function VerificationPendingPage({ email }: VerificationPendingPageProps) {
  const [, navigate] = useLocation();
  const [resending, setResending] = useState(false);
  const { toast } = useToast();

  const handleResendVerification = async () => {
    setResending(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast({
        title: "Verification Email Sent",
        description: "Please check your inbox and spam folder.",
      });
    } catch (error: any) {
      toast({
        title: "Failed to Resend",
        description: error.message || "Please try again later",
        variant: "destructive",
      });
    } finally {
      setResending(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-red-50 to-white dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex items-center gap-2">
              <Package className="h-8 w-8 text-primary" />
              <span className="text-2xl font-bold">PaperBox ERP</span>
            </div>
          </div>
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
              <Mail className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
          <CardTitle>Verify Your Email</CardTitle>
          <CardDescription>
            We've sent a verification email to <strong>{email || 'your email'}</strong>.
            Please click the link in the email to activate your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted p-4 rounded-lg space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Check your inbox</p>
                <p className="text-xs text-muted-foreground">Look for an email from noreply@paperboxerp.com</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Check spam folder</p>
                <p className="text-xs text-muted-foreground">Sometimes emails end up in spam</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Link expires in 24 hours</p>
                <p className="text-xs text-muted-foreground">Request a new one if needed</p>
              </div>
            </div>
          </div>

          <Button 
            variant="outline" 
            className="w-full" 
            onClick={handleResendVerification}
            disabled={resending}
            data-testid="button-resend-verification"
          >
            {resending ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Resend Verification Email
              </>
            )}
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
