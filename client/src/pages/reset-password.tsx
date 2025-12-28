import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Lock, Loader2, Package, Eye, EyeOff, CheckCircle, AlertCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { updatePassword, isSupabaseConfigured, supabase } from "@/lib/supabase";

const passwordSchema = z.object({
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[a-z]/, "Password must contain a lowercase letter")
    .regex(/[0-9]/, "Password must contain a number")
    .regex(/[!@#$%^&*(),.?":{}|<>]/, "Password must contain a special character"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type PasswordFormData = z.infer<typeof passwordSchema>;

type ResetState = 'loading' | 'ready' | 'success' | 'error';

export default function ResetPasswordPage() {
  const [, navigate] = useLocation();
  const [resetState, setResetState] = useState<ResetState>('loading');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { toast } = useToast();

  const form = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setResetState('error');
      setErrorMessage('Authentication not configured');
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setResetState('ready');
      } else {
        setResetState('error');
        setErrorMessage('Invalid or expired reset link. Please request a new password reset.');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setResetState('ready');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (data: PasswordFormData) => {
    setIsSubmitting(true);
    try {
      const { error } = await updatePassword(data.password);
      if (error) throw error;
      
      setResetState('success');
      toast({
        title: "Password Updated",
        description: "Your password has been successfully changed.",
      });
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (resetState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-red-50 to-white dark:from-gray-900 dark:to-gray-800 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (resetState === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-red-50 to-white dark:from-gray-900 dark:to-gray-800 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="h-12 w-12 bg-destructive/10 rounded-full flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
            </div>
            <CardTitle>Reset Link Expired</CardTitle>
            <CardDescription>
              {errorMessage}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full" 
              onClick={() => navigate("/auth")}
              data-testid="button-back-to-signin"
            >
              Back to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (resetState === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-red-50 to-white dark:from-gray-900 dark:to-gray-800 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="h-12 w-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <CardTitle>Password Updated!</CardTitle>
            <CardDescription>
              Your password has been successfully changed. You can now sign in with your new password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full" 
              onClick={() => navigate("/auth")}
              data-testid="button-goto-signin"
            >
              Sign In Now
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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
          <CardTitle>Create New Password</CardTitle>
          <CardDescription>
            Enter a new password for your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                          type={showPassword ? "text" : "password"} 
                          placeholder="Enter new password" 
                          className="pl-10 pr-10"
                          {...field} 
                          data-testid="input-new-password"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                          data-testid="button-toggle-password"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                    <p className="text-xs text-muted-foreground mt-1">
                      Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special character
                    </p>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                          type={showConfirmPassword ? "text" : "password"} 
                          placeholder="Confirm new password" 
                          className="pl-10 pr-10"
                          {...field} 
                          data-testid="input-confirm-password"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isSubmitting}
                data-testid="button-update-password"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating Password...
                  </>
                ) : (
                  'Update Password'
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
