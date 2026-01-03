import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Building2, 
  FileText, 
  Layers, 
  Calculator, 
  FileCheck,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowRight,
  Send,
  AlertTriangle
} from "lucide-react";

interface SetupStatusResponse {
  userId: string;
  tenantId?: string;
  steps: {
    businessProfile: boolean;
    paperPricing: boolean;
    fluteSettings: boolean;
    taxDefaults: boolean;
    quoteTerms: boolean;
  };
  setupProgress: number;
  isSetupComplete: boolean;
  verificationStatus: 'NOT_SUBMITTED' | 'PENDING' | 'APPROVED' | 'REJECTED';
  submittedForVerification: boolean;
  rejectionReason?: string | null;
  submittedAt?: string | null;
  approvedAt?: string | null;
}

const onboardingSteps = [
  {
    id: 'business',
    key: 'businessProfileDone',
    title: 'Business Profile',
    description: 'Set up your company information',
    icon: Building2,
    href: '/account',
    actionText: 'Set Up Profile'
  },
  {
    id: 'paper',
    key: 'paperSetupDone',
    title: 'Paper Pricing',
    description: 'Configure BF-based paper rates',
    icon: FileText,
    href: '/paper-setup',
    actionText: 'Configure Paper Prices'
  },
  {
    id: 'flute',
    key: 'fluteSetupDone',
    title: 'Flute Settings',
    description: 'Set up fluting factors and combinations',
    icon: Layers,
    href: '/masters',
    actionText: 'Configure Flute Settings'
  },
  {
    id: 'tax',
    key: 'taxSetupDone',
    title: 'Tax & Defaults',
    description: 'Configure GST and business defaults',
    icon: Calculator,
    href: '/masters?tab=settings',
    actionText: 'Set Up Tax & Defaults'
  },
  {
    id: 'terms',
    key: 'termsSetupDone',
    title: 'Quote Terms',
    description: 'Set default quote terms and conditions',
    icon: FileCheck,
    href: '/masters?tab=settings',
    actionText: 'Set Up Terms'
  }
];

const mapStepKey = (legacyKey: string): keyof SetupStatusResponse['steps'] => {
  switch (legacyKey) {
    case 'businessProfileDone':
      return 'businessProfile';
    case 'paperSetupDone':
      return 'paperPricing';
    case 'fluteSetupDone':
      return 'fluteSettings';
    case 'taxSetupDone':
      return 'taxDefaults';
    case 'termsSetupDone':
      return 'quoteTerms';
    default:
      return 'businessProfile';
  }
};

export default function Onboarding() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { data: onboardingStatus, isLoading } = useQuery<SetupStatusResponse>({
    queryKey: ['/api/user/setup/status'],
    staleTime: 10000,
  });

  const submitMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/user/submit-verification'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/setup/status'] });
      toast({
        title: "Submitted for Verification",
        description: "Your account is now pending admin approval. You'll be notified once reviewed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Submission Failed",
        description: error.message || "Please complete all onboarding steps first.",
        variant: "destructive",
      });
    },
  });

  const completedSteps = onboardingSteps.filter(step => onboardingStatus?.steps?.[mapStepKey(step.key)]).length;

  const allStepsCompleted = completedSteps === onboardingSteps.length;
  const progress = onboardingStatus?.setupProgress ?? (completedSteps / onboardingSteps.length) * 100;

  const verificationStatus = onboardingStatus?.verificationStatus || 'NOT_SUBMITTED';
  const isApproved = verificationStatus === 'APPROVED';
  const isPending = verificationStatus === 'PENDING' || (onboardingStatus?.submittedForVerification && verificationStatus !== 'APPROVED');
  const isRejected = verificationStatus === 'REJECTED';

  if (isApproved) {
    return (
      <div className="p-4 md:p-6">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900">
                <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-2xl font-bold">Account Verified!</h2>
              <p className="text-muted-foreground">
                Your account has been approved. You now have full access to all features.
              </p>
              <Button onClick={() => navigate('/dashboard')} data-testid="button-go-to-dashboard">
                Go to Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 md:p-6">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Loading onboarding status...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Welcome to BoxCost Pro</h1>
          <p className="text-muted-foreground">
            Complete the following steps to set up your account and get started.
          </p>
        </div>

        {isRejected && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Account Verification Rejected</AlertTitle>
            <AlertDescription>
              <p className="mt-2">{onboardingStatus?.rejectionReason || "Your account was not approved."}</p>
              <p className="mt-2 text-sm">Please update your profile and resubmit for verification.</p>
            </AlertDescription>
          </Alert>
        )}

        {isPending && (
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertTitle>Pending Verification</AlertTitle>
            <AlertDescription>
              Your account is being reviewed by our team. You'll be notified once approved.
              <span className="block text-xs mt-1">Typical review time: 24–48 hours.</span>
              <span className="block text-xs mt-1">We also send emails to you and the admin when you submit and when a decision is made.</span>
              <span className="block text-xs mt-1 text-muted-foreground">
                Submitted on {onboardingStatus?.submittedAt ? new Date(onboardingStatus.submittedAt).toLocaleDateString() : 'recently'}
              </span>
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Setup Progress</CardTitle>
                <CardDescription>{completedSteps} of {onboardingSteps.length} steps completed</CardDescription>
              </div>
              <Badge variant={allStepsCompleted ? "default" : "secondary"}>
                {Math.round(progress)}%
              </Badge>
            </div>
            <Progress value={progress} className="mt-2" />
          </CardHeader>
          <CardContent className="space-y-4">
            {onboardingSteps.map((step, index) => {
              const StepIcon = step.icon;
              const isCompleted = onboardingStatus?.steps?.[mapStepKey(step.key)];
              
              return (
                <div
                  key={step.id}
                  className={`flex items-center gap-4 p-4 rounded-lg border ${
                    isCompleted 
                      ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800' 
                      : 'bg-muted/50'
                  }`}
                  data-testid={`onboarding-step-${step.id}`}
                >
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                    isCompleted 
                      ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400' 
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <span className="font-semibold">{index + 1}</span>
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <StepIcon className="w-4 h-4" />
                      <h3 className="font-medium">{step.title}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </div>
                  
                  {isCompleted ? (
                    <Badge variant="outline" className="text-green-600 border-green-300">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Complete
                    </Badge>
                  ) : (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => navigate(step.href)}
                      data-testid={`button-${step.id}-setup`}
                    >
                      {step.actionText}
                      <ArrowRight className="ml-2 h-3 w-3" />
                    </Button>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {!isPending && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="text-center md:text-left">
                  <h3 className="font-semibold">
                    {allStepsCompleted ? "Ready to Submit!" : "Complete All Steps"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {allStepsCompleted 
                      ? "Submit your account for admin verification to get full access."
                      : "Complete all setup steps above before submitting for verification."}
                  </p>
                </div>
                <Button
                  disabled={!allStepsCompleted || submitMutation.isPending}
                  onClick={() => submitMutation.mutate()}
                  className="gap-2"
                  data-testid="button-submit-verification"
                >
                  {submitMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Submit for Verification
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
