import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Calculator, Package, Users, FileText, Search, CheckSquare, Mail, Loader2 } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { signInWithOTP, verifyOTP, signInWithGoogle, isSupabaseConfigured } from "@/lib/supabase";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const emailSchema = z.object({
  email: z.string().email("Valid email is required"),
});

const otpSchema = z.object({
  otp: z.string().length(6, "Enter 6-digit code"),
});

type EmailFormData = z.infer<typeof emailSchema>;
type OTPFormData = z.infer<typeof otpSchema>;

export default function Landing() {
  const [showAuth, setShowAuth] = useState(false);
  const [authStep, setAuthStep] = useState<'email' | 'otp'>('email');
  const [pendingEmail, setPendingEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const emailForm = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  const otpForm = useForm<OTPFormData>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: "" },
  });

  const handleEmailSubmit = async (data: EmailFormData) => {
    if (!isSupabaseConfigured) {
      toast({
        title: "Authentication Not Available",
        description: "Please configure Supabase credentials to enable authentication.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await signInWithOTP(data.email);
      if (error) throw error;
      
      setPendingEmail(data.email);
      setAuthStep('otp');
      toast({
        title: "Code Sent",
        description: `We've sent a 6-digit code to ${data.email}. It expires in 10 minutes.`,
      });
    } catch (error: any) {
      toast({
        title: "Failed to Send Code",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOTPSubmit = async (data: OTPFormData) => {
    setIsSubmitting(true);
    try {
      const { error } = await verifyOTP(pendingEmail, data.otp);
      if (error) throw error;
      
      toast({
        title: "Welcome!",
        description: "You're now signed in.",
      });
      window.location.href = "/";
    } catch (error: any) {
      toast({
        title: "Invalid Code",
        description: error.message || "Please check the code and try again",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!isSupabaseConfigured) {
      toast({
        title: "Authentication Not Available",
        description: "Please configure Supabase credentials to enable authentication.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await signInWithGoogle();
      if (error) throw error;
    } catch (error: any) {
      toast({
        title: "Google Sign In Failed",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    }
  };

  const resetAuth = () => {
    setAuthStep('email');
    setPendingEmail('');
    emailForm.reset();
    otpForm.reset();
  };

  const closeAuth = () => {
    setShowAuth(false);
    resetAuth();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Package className="h-8 w-8 text-blue-600" />
            <span className="text-xl font-bold">Box Costing Calculator</span>
          </div>
          <Button onClick={() => setShowAuth(true)} data-testid="button-signin">
            Sign In
          </Button>
        </nav>
      </header>

      <main className="container mx-auto px-4 py-16">
        <section className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-6 text-gray-900 dark:text-white">
            Professional Corrugated Box Costing
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
            Calculate accurate costs for RSC boxes and sheets. Manage quotes, track customers, and grow your packaging business.
          </p>
          <Button size="lg" onClick={() => setShowAuth(true)} data-testid="button-get-started">
            Get Started Free
          </Button>
        </section>

        <section className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          <Card>
            <CardHeader>
              <Calculator className="h-10 w-10 text-blue-600 mb-2" />
              <CardTitle>Accurate Costing</CardTitle>
              <CardDescription>
                Calculate paper costs, manufacturing costs, and profit margins with precision
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Users className="h-10 w-10 text-green-600 mb-2" />
              <CardTitle>Party Management</CardTitle>
              <CardDescription>
                Save and manage customer profiles for quick quote generation
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <FileText className="h-10 w-10 text-purple-600 mb-2" />
              <CardTitle>Quote Management</CardTitle>
              <CardDescription>
                Save, edit, and recall quotes. Send via WhatsApp or Email instantly
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Search className="h-10 w-10 text-orange-600 mb-2" />
              <CardTitle>Smart Search</CardTitle>
              <CardDescription>
                Find quotes by party name, box name, or box size in seconds
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Package className="h-10 w-10 text-red-600 mb-2" />
              <CardTitle>Strength Analysis</CardTitle>
              <CardDescription>
                McKee Formula calculations for ECT, BCT, and Burst Strength
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CheckSquare className="h-10 w-10 text-teal-600 mb-2" />
              <CardTitle>Item Selection</CardTitle>
              <CardDescription>
                Select specific items to include in WhatsApp or Email messages
              </CardDescription>
            </CardHeader>
          </Card>
        </section>

        <section className="text-center py-16 bg-blue-600 rounded-2xl text-white">
          <h2 className="text-3xl font-bold mb-4">Ready to streamline your box costing?</h2>
          <p className="text-lg mb-8 opacity-90">
            Join packaging businesses that trust our calculator for accurate quotes
          </p>
          <Button size="lg" variant="secondary" onClick={() => setShowAuth(true)} data-testid="button-signup">
            Sign Up Now
          </Button>
        </section>
      </main>

      <footer className="container mx-auto px-4 py-8 text-center text-gray-600 dark:text-gray-400">
        <p>Box Costing Calculator - Professional Packaging Solutions</p>
      </footer>

      <Dialog open={showAuth} onOpenChange={closeAuth}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {authStep === 'email' ? 'Sign In' : 'Enter Verification Code'}
            </DialogTitle>
            <DialogDescription>
              {authStep === 'email' 
                ? 'Enter your email to receive a sign-in code' 
                : `We sent a 6-digit code to ${pendingEmail}`}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {authStep === 'email' ? (
              <>
                <Button 
                  variant="outline" 
                  className="w-full gap-2" 
                  onClick={handleGoogleSignIn}
                  disabled={isSubmitting || !isSupabaseConfigured}
                  data-testid="button-google-signin"
                >
                  <SiGoogle className="h-4 w-4" />
                  Continue with Google
                </Button>
                
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or continue with email</span>
                  </div>
                </div>

                <Form {...emailForm}>
                  <form onSubmit={emailForm.handleSubmit(handleEmailSubmit)} className="space-y-4">
                    <FormField
                      control={emailForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input 
                                type="email" 
                                placeholder="you@company.com" 
                                className="pl-10"
                                {...field} 
                                data-testid="input-email"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={isSubmitting || !isSupabaseConfigured}
                      data-testid="button-send-code"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending Code...
                        </>
                      ) : (
                        'Send Sign-In Code'
                      )}
                    </Button>
                  </form>
                </Form>

                {!isSupabaseConfigured && (
                  <p className="text-sm text-muted-foreground text-center">
                    Authentication is being configured. Please try again later.
                  </p>
                )}
              </>
            ) : (
              <Form {...otpForm}>
                <form onSubmit={otpForm.handleSubmit(handleOTPSubmit)} className="space-y-4">
                  <FormField
                    control={otpForm.control}
                    name="otp"
                    render={({ field }) => (
                      <FormItem className="flex flex-col items-center">
                        <FormLabel className="sr-only">Verification Code</FormLabel>
                        <FormControl>
                          <InputOTP 
                            maxLength={6} 
                            value={field.value}
                            onChange={field.onChange}
                            data-testid="input-otp"
                          >
                            <InputOTPGroup>
                              <InputOTPSlot index={0} />
                              <InputOTPSlot index={1} />
                              <InputOTPSlot index={2} />
                              <InputOTPSlot index={3} />
                              <InputOTPSlot index={4} />
                              <InputOTPSlot index={5} />
                            </InputOTPGroup>
                          </InputOTP>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isSubmitting}
                    data-testid="button-verify-code"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      'Verify Code'
                    )}
                  </Button>

                  <div className="flex justify-between text-sm">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      className="p-0 h-auto text-primary"
                      onClick={resetAuth}
                      data-testid="button-use-different-email"
                    >
                      Use different email
                    </Button>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      className="p-0 h-auto text-primary"
                      onClick={() => handleEmailSubmit({ email: pendingEmail })}
                      disabled={isSubmitting}
                      data-testid="button-resend-code"
                    >
                      Resend code
                    </Button>
                  </div>
                </form>
              </Form>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
