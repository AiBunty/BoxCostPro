import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Lock, Loader2, Package, Eye, EyeOff, User, ArrowLeft, Link as LinkIcon, KeyRound } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { 
  signInWithOTP, 
  verifyOTP, 
  signInWithGoogle, 
  signInWithPassword,
  signUpWithPassword,
  signInWithMagicLink,
  resetPassword,
  isSupabaseConfigured 
} from "@/lib/supabase";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const emailSchema = z.object({
  email: z.string().email("Valid email is required"),
});

const otpSchema = z.object({
  otp: z.string().length(6, "Enter 6-digit code"),
});

const passwordLoginSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(1, "Password is required"),
});

const passwordSignupSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  email: z.string().email("Valid email is required"),
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

type AuthMethod = 'password' | 'otp' | 'magic-link';
type AuthMode = 'signin' | 'signup';
type AuthStep = 'form' | 'otp-verify' | 'magic-link-sent' | 'success';

export default function AuthPage() {
  const [, navigate] = useLocation();
  const [authMethod, setAuthMethod] = useState<AuthMethod>('password');
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [authStep, setAuthStep] = useState<AuthStep>('form');
  const [pendingEmail, setPendingEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { toast } = useToast();

  const emailForm = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  const otpForm = useForm<z.infer<typeof otpSchema>>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: "" },
  });

  const passwordLoginForm = useForm<z.infer<typeof passwordLoginSchema>>({
    resolver: zodResolver(passwordLoginSchema),
    defaultValues: { email: "", password: "" },
  });

  const passwordSignupForm = useForm<z.infer<typeof passwordSignupSchema>>({
    resolver: zodResolver(passwordSignupSchema),
    defaultValues: { fullName: "", email: "", password: "", confirmPassword: "" },
  });

  const handlePasswordLogin = async (data: z.infer<typeof passwordLoginSchema>) => {
    if (!isSupabaseConfigured) {
      toast({ title: "Authentication Not Available", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const { error } = await signInWithPassword(data.email, data.password);
      if (error) throw error;
      toast({ title: "Welcome back!", description: "You're now signed in." });
      navigate("/");
    } catch (error: any) {
      toast({
        title: "Sign In Failed",
        description: error.message || "Invalid email or password",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordSignup = async (data: z.infer<typeof passwordSignupSchema>) => {
    if (!isSupabaseConfigured) {
      toast({ title: "Authentication Not Available", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const { data: authData, error } = await signUpWithPassword(
        data.email, 
        data.password,
        { fullName: data.fullName }
      );
      if (error) throw error;
      
      if (authData?.user && !authData.session) {
        setPendingEmail(data.email);
        setAuthStep('magic-link-sent');
        toast({
          title: "Verification Email Sent",
          description: "Please check your email to verify your account.",
        });
      } else {
        toast({ title: "Account Created!", description: "Welcome to PaperBox ERP." });
        navigate("/");
      }
    } catch (error: any) {
      toast({
        title: "Sign Up Failed",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOTPSubmit = async (data: z.infer<typeof emailSchema>) => {
    if (!isSupabaseConfigured) {
      toast({ title: "Authentication Not Available", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const { error } = await signInWithOTP(data.email);
      if (error) throw error;
      setPendingEmail(data.email);
      setAuthStep('otp-verify');
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

  const handleVerifyOTP = async (data: z.infer<typeof otpSchema>) => {
    setIsSubmitting(true);
    try {
      const { error } = await verifyOTP(pendingEmail, data.otp);
      if (error) throw error;
      toast({ title: "Welcome!", description: "You're now signed in." });
      navigate("/");
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

  const handleMagicLinkSubmit = async (data: z.infer<typeof emailSchema>) => {
    if (!isSupabaseConfigured) {
      toast({ title: "Authentication Not Available", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const { error } = await signInWithMagicLink(data.email);
      if (error) throw error;
      setPendingEmail(data.email);
      setAuthStep('magic-link-sent');
      toast({
        title: "Magic Link Sent",
        description: `Check your email at ${data.email} for a sign-in link.`,
      });
    } catch (error: any) {
      toast({
        title: "Failed to Send Link",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!isSupabaseConfigured) {
      toast({ title: "Authentication Not Available", variant: "destructive" });
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

  const handleForgotPassword = async () => {
    const email = passwordLoginForm.getValues("email");
    if (!email || !z.string().email().safeParse(email).success) {
      toast({
        title: "Enter Your Email",
        description: "Please enter your email address first",
        variant: "destructive",
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const { error } = await resetPassword(email);
      if (error) throw error;
      toast({
        title: "Password Reset Email Sent",
        description: "Check your email for a password reset link.",
      });
    } catch (error: any) {
      toast({
        title: "Failed to Send Reset Email",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetToForm = () => {
    setAuthStep('form');
    setPendingEmail('');
    emailForm.reset();
    otpForm.reset();
  };

  if (authStep === 'otp-verify') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center">
                <KeyRound className="h-6 w-6 text-primary" />
              </div>
            </div>
            <CardTitle>Enter Verification Code</CardTitle>
            <CardDescription>
              We sent a 6-digit code to {pendingEmail}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...otpForm}>
              <form onSubmit={otpForm.handleSubmit(handleVerifyOTP)} className="space-y-4">
                <FormField
                  control={otpForm.control}
                  name="otp"
                  render={({ field }) => (
                    <FormItem className="flex flex-col items-center">
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
                    className="p-0 h-auto"
                    onClick={resetToForm}
                    data-testid="button-back-to-email"
                  >
                    <ArrowLeft className="mr-1 h-4 w-4" />
                    Use different email
                  </Button>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    className="p-0 h-auto"
                    onClick={() => handleOTPSubmit({ email: pendingEmail })}
                    disabled={isSubmitting}
                    data-testid="button-resend-code"
                  >
                    Resend code
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (authStep === 'magic-link-sent') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="h-12 w-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <Mail className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <CardTitle>Check Your Email</CardTitle>
            <CardDescription>
              {authMethod === 'magic-link' 
                ? `We've sent a magic link to ${pendingEmail}. Click the link to sign in.`
                : `We've sent a verification email to ${pendingEmail}. Click the link to verify your account.`
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Didn't receive the email?</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Check your spam folder</li>
                <li>Make sure {pendingEmail} is correct</li>
                <li>Wait a few minutes and try again</li>
              </ul>
            </div>
            
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={resetToForm}
              data-testid="button-back-to-signin"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex items-center gap-2">
              <Package className="h-8 w-8 text-primary" />
              <span className="text-2xl font-bold">PaperBox ERP</span>
            </div>
          </div>
          <CardTitle>{authMode === 'signin' ? 'Welcome Back' : 'Create Account'}</CardTitle>
          <CardDescription>
            {authMode === 'signin' 
              ? 'Sign in to access your box costing dashboard' 
              : 'Get started with your free account'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
              <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          <Tabs value={authMethod} onValueChange={(v) => setAuthMethod(v as AuthMethod)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="password" data-testid="tab-password">
                <Lock className="h-4 w-4 mr-1" />
                Password
              </TabsTrigger>
              <TabsTrigger value="otp" data-testid="tab-otp">
                <KeyRound className="h-4 w-4 mr-1" />
                OTP
              </TabsTrigger>
              <TabsTrigger value="magic-link" data-testid="tab-magic-link">
                <LinkIcon className="h-4 w-4 mr-1" />
                Magic Link
              </TabsTrigger>
            </TabsList>

            <TabsContent value="password" className="space-y-4 mt-4">
              {authMode === 'signin' ? (
                <Form {...passwordLoginForm}>
                  <form onSubmit={passwordLoginForm.handleSubmit(handlePasswordLogin)} className="space-y-4">
                    <FormField
                      control={passwordLoginForm.control}
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
                                data-testid="input-email-password"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={passwordLoginForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input 
                                type={showPassword ? "text" : "password"} 
                                placeholder="Enter your password" 
                                className="pl-10 pr-10"
                                {...field} 
                                data-testid="input-password"
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
                        </FormItem>
                      )}
                    />
                    
                    <div className="flex justify-end">
                      <Button 
                        type="button" 
                        variant="ghost" 
                        className="p-0 h-auto text-sm text-primary hover:bg-transparent"
                        onClick={handleForgotPassword}
                        disabled={isSubmitting}
                        data-testid="button-forgot-password"
                      >
                        Forgot password?
                      </Button>
                    </div>
                    
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={isSubmitting || !isSupabaseConfigured}
                      data-testid="button-signin-password"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Signing In...
                        </>
                      ) : (
                        'Sign In'
                      )}
                    </Button>
                  </form>
                </Form>
              ) : (
                <Form {...passwordSignupForm}>
                  <form onSubmit={passwordSignupForm.handleSubmit(handlePasswordSignup)} className="space-y-4">
                    <FormField
                      control={passwordSignupForm.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input 
                                placeholder="John Smith" 
                                className="pl-10"
                                {...field} 
                                data-testid="input-fullname"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={passwordSignupForm.control}
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
                                data-testid="input-email-signup"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={passwordSignupForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input 
                                type={showPassword ? "text" : "password"} 
                                placeholder="Create a strong password" 
                                className="pl-10 pr-10"
                                {...field} 
                                data-testid="input-password-signup"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                onClick={() => setShowPassword(!showPassword)}
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
                      control={passwordSignupForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input 
                                type={showConfirmPassword ? "text" : "password"} 
                                placeholder="Confirm your password" 
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
                      disabled={isSubmitting || !isSupabaseConfigured}
                      data-testid="button-signup-password"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating Account...
                        </>
                      ) : (
                        'Create Account'
                      )}
                    </Button>
                  </form>
                </Form>
              )}
            </TabsContent>

            <TabsContent value="otp" className="space-y-4 mt-4">
              <Form {...emailForm}>
                <form onSubmit={emailForm.handleSubmit(handleOTPSubmit)} className="space-y-4">
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
                              data-testid="input-email-otp"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <p className="text-sm text-muted-foreground">
                    We'll send you a 6-digit code to sign in. No password needed.
                  </p>
                  
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isSubmitting || !isSupabaseConfigured}
                    data-testid="button-send-otp"
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
            </TabsContent>

            <TabsContent value="magic-link" className="space-y-4 mt-4">
              <Form {...emailForm}>
                <form onSubmit={emailForm.handleSubmit(handleMagicLinkSubmit)} className="space-y-4">
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
                              data-testid="input-email-magic"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <p className="text-sm text-muted-foreground">
                    We'll email you a magic link for a password-free sign in.
                  </p>
                  
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isSubmitting || !isSupabaseConfigured}
                    data-testid="button-send-magic-link"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending Link...
                      </>
                    ) : (
                      'Send Magic Link'
                    )}
                  </Button>
                </form>
              </Form>
            </TabsContent>
          </Tabs>

          {authMethod === 'password' && (
            <div className="text-center text-sm">
              {authMode === 'signin' ? (
                <p className="text-muted-foreground">
                  Don't have an account?{' '}
                  <Button 
                    variant="ghost" 
                    className="p-0 h-auto text-primary hover:bg-transparent"
                    onClick={() => {
                      setAuthMode('signup');
                      passwordLoginForm.reset();
                      passwordSignupForm.reset();
                    }}
                    data-testid="button-switch-to-signup"
                  >
                    Sign up
                  </Button>
                </p>
              ) : (
                <p className="text-muted-foreground">
                  Already have an account?{' '}
                  <Button 
                    variant="ghost" 
                    className="p-0 h-auto text-primary hover:bg-transparent"
                    onClick={() => {
                      setAuthMode('signin');
                      passwordLoginForm.reset();
                      passwordSignupForm.reset();
                    }}
                    data-testid="button-switch-to-signin"
                  >
                    Sign in
                  </Button>
                </p>
              )}
            </div>
          )}

          {!isSupabaseConfigured && (
            <p className="text-sm text-muted-foreground text-center bg-muted p-3 rounded-lg">
              Authentication is being configured. Please try again later.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
