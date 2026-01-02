/**
 * Multi-Step Signup Flow
 *
 * Payment-first signup flow:
 * 1. Business Profile Collection (with GSTIN validation)
 * 2. Plan Selection (with coupon support)
 * 3. Payment (Razorpay or 100% coupon)
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Check, AlertTriangle, Lock, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// GST State Codes mapping
const GST_STATE_CODES: Record<string, string> = {
  '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
  '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan',
  '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
  '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura',
  '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand',
  '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
  '25': 'Daman and Diu', '26': 'Dadra and Nagar Haveli', '27': 'Maharashtra', '28': 'Andhra Pradesh',
  '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala',
  '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman and Nicobar Islands', '36': 'Telangana',
  '37': 'Andhra Pradesh', '38': 'Ladakh',
};

interface BusinessProfile {
  authorizedPersonName: string;
  businessName: string;
  businessEmail: string;
  mobileNumber: string;
  gstin: string;
  panNo: string;
  stateCode: string;
  stateName: string;
  fullBusinessAddress: string;
  website: string;
}

interface Plan {
  id: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  features: string;
  isActive: boolean;
}

export default function SignupFlow() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [sessionToken, setSessionToken] = useState('');
  const [tempProfileId, setTempProfileId] = useState('');

  // Step 1: Business Profile
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>({
    authorizedPersonName: '',
    businessName: '',
    businessEmail: '',
    mobileNumber: '',
    gstin: '',
    panNo: '',
    stateCode: '',
    stateName: '',
    fullBusinessAddress: '',
    website: '',
  });

  // Step 2: Plan Selection
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [couponCode, setCouponCode] = useState('');
  const [couponValidation, setCouponValidation] = useState<any>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);

  // Step 3: Payment
  const [finalAmount, setFinalAmount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  // Load plans on mount
  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const response = await fetch('/api/subscription-plans');
      const data = await response.json();
      setPlans(data.filter((p: Plan) => p.isActive));
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load subscription plans',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="container mx-auto px-4">
        {/* Progress Indicator */}
        <StepIndicator currentStep={step} />

        {/* Step Content */}
        {step === 1 && (
          <BusinessProfileStep
            profile={businessProfile}
            onChange={setBusinessProfile}
            onNext={(token, profileId) => {
              setSessionToken(token);
              setTempProfileId(profileId);
              setStep(2);
            }}
          />
        )}

        {step === 2 && (
          <PlanSelectionStep
            plans={plans}
            selectedPlan={selectedPlan}
            billingCycle={billingCycle}
            couponCode={couponCode}
            couponValidation={couponValidation}
            isValidatingCoupon={isValidatingCoupon}
            onPlanSelect={setSelectedPlan}
            onBillingCycleChange={setBillingCycle}
            onCouponChange={setCouponCode}
            onValidateCoupon={async () => {
              if (!couponCode || !selectedPlan) return;

              setIsValidatingCoupon(true);
              try {
                const response = await fetch('/api/coupons/validate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    code: couponCode,
                    planId: selectedPlan.id,
                  }),
                });
                const data = await response.json();
                setCouponValidation(data);
              } catch (error) {
                setCouponValidation({ valid: false, error: 'Failed to validate coupon' });
              } finally {
                setIsValidatingCoupon(false);
              }
            }}
            onNext={(amount) => {
              setFinalAmount(amount);
              setStep(3);
            }}
            onBack={() => setStep(1)}
          />
        )}

        {step === 3 && (
          <PaymentStep
            amount={finalAmount}
            businessProfile={businessProfile}
            selectedPlan={selectedPlan!}
            billingCycle={billingCycle}
            couponCode={couponCode}
            sessionToken={sessionToken}
            isProcessing={isProcessing}
            onPaymentSuccess={(userId, invoiceId) => {
              navigate(`/payment-success?userId=${userId}&invoiceId=${invoiceId}`);
            }}
            onBack={() => setStep(2)}
            setIsProcessing={setIsProcessing}
          />
        )}
      </div>
    </div>
  );
}

// Step Indicator Component
function StepIndicator({ currentStep }: { currentStep: number }) {
  const steps = [
    { number: 1, label: 'Business Profile' },
    { number: 2, label: 'Plan Selection' },
    { number: 3, label: 'Payment' },
  ];

  return (
    <div className="max-w-3xl mx-auto mb-8">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.number} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  currentStep > step.number
                    ? 'bg-green-500 text-white'
                    : currentStep === step.number
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-300 text-gray-600'
                }`}
              >
                {currentStep > step.number ? <Check className="h-5 w-5" /> : step.number}
              </div>
              <span className="text-xs mt-2 text-center">{step.label}</span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`h-1 flex-1 mx-4 ${
                  currentStep > step.number ? 'bg-green-500' : 'bg-gray-300'
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Business Profile Step Component
function BusinessProfileStep({
  profile,
  onChange,
  onNext,
}: {
  profile: BusinessProfile;
  onChange: (profile: BusinessProfile) => void;
  onNext: (sessionToken: string, tempProfileId: string) => void;
}) {
  const { toast } = useToast();
  const [gstError, setGstError] = useState('');
  const [isGSTValid, setIsGSTValid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (profile.gstin && profile.gstin.length === 15) {
      validateGSTIN(profile.gstin);
    }
  }, [profile.gstin]);

  const validateGSTIN = (gstin: string) => {
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

    if (!gstinRegex.test(gstin)) {
      setGstError('Invalid GSTIN format');
      setIsGSTValid(false);
      return;
    }

    // Auto-derive PAN and State
    const pan = gstin.substring(2, 12);
    const state = gstin.substring(0, 2);
    const stateName = GST_STATE_CODES[state];

    if (!stateName) {
      setGstError('Invalid state code');
      setIsGSTValid(false);
      return;
    }

    onChange({
      ...profile,
      panNo: pan,
      stateCode: state,
      stateName: stateName,
    });

    setGstError('');
    setIsGSTValid(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!profile.authorizedPersonName || !profile.businessName ||
        !profile.businessEmail || !profile.mobileNumber ||
        !profile.gstin || !profile.fullBusinessAddress) {
      toast({
        title: 'Missing Information',
        description: 'Please fill all required fields',
        variant: 'destructive',
      });
      return;
    }

    if (!isGSTValid) {
      toast({
        title: 'Invalid GSTIN',
        description: 'Please enter a valid GSTIN',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/signup/business-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });

      const data = await response.json();

      if (data.success) {
        onNext(data.sessionToken, data.tempProfileId);
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to create business profile',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to submit business profile',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Business Information</CardTitle>
        <CardDescription>
          Enter your business details to get started
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Authorized Person Name *</Label>
              <Input
                value={profile.authorizedPersonName}
                onChange={(e) => onChange({ ...profile, authorizedPersonName: e.target.value })}
                required
              />
            </div>

            <div>
              <Label>Business / Company Name *</Label>
              <Input
                value={profile.businessName}
                onChange={(e) => onChange({ ...profile, businessName: e.target.value })}
                required
              />
            </div>

            <div>
              <Label>Business Email *</Label>
              <Input
                type="email"
                value={profile.businessEmail}
                onChange={(e) => onChange({ ...profile, businessEmail: e.target.value })}
                required
              />
            </div>

            <div>
              <Label>Mobile Number *</Label>
              <Input
                type="tel"
                value={profile.mobileNumber}
                onChange={(e) => onChange({ ...profile, mobileNumber: e.target.value })}
                required
              />
            </div>

            <div>
              <Label>GSTIN *</Label>
              <Input
                maxLength={15}
                value={profile.gstin}
                onChange={(e) => onChange({ ...profile, gstin: e.target.value.toUpperCase() })}
                className={isGSTValid ? 'border-green-500' : gstError ? 'border-red-500' : ''}
                required
              />
              {gstError && <p className="text-xs text-red-500 mt-1">{gstError}</p>}
              {isGSTValid && <p className="text-xs text-green-600 mt-1">✓ Valid GSTIN</p>}
            </div>

            <div>
              <Label>PAN (Auto-Derived)</Label>
              <Input
                value={profile.panNo}
                disabled
                className="bg-muted"
              />
            </div>

            <div>
              <Label>State (Auto-Derived)</Label>
              <Input
                value={profile.stateName}
                disabled
                className="bg-muted"
              />
            </div>

            <div>
              <Label>Website (Optional)</Label>
              <Input
                type="url"
                value={profile.website}
                onChange={(e) => onChange({ ...profile, website: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label>Full Business Address *</Label>
            <Textarea
              value={profile.fullBusinessAddress}
              onChange={(e) => onChange({ ...profile, fullBusinessAddress: e.target.value })}
              rows={3}
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              'Continue to Plan Selection'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// Plan Selection Step Component
function PlanSelectionStep({
  plans,
  selectedPlan,
  billingCycle,
  couponCode,
  couponValidation,
  isValidatingCoupon,
  onPlanSelect,
  onBillingCycleChange,
  onCouponChange,
  onValidateCoupon,
  onNext,
  onBack,
}: {
  plans: Plan[];
  selectedPlan: Plan | null;
  billingCycle: 'monthly' | 'yearly';
  couponCode: string;
  couponValidation: any;
  isValidatingCoupon: boolean;
  onPlanSelect: (plan: Plan) => void;
  onBillingCycleChange: (cycle: 'monthly' | 'yearly') => void;
  onCouponChange: (code: string) => void;
  onValidateCoupon: () => void;
  onNext: (amount: number) => void;
  onBack: () => void;
}) {
  const { toast } = useToast();

  const calculateFinalAmount = () => {
    if (!selectedPlan) return 0;

    const basePrice = billingCycle === 'monthly'
      ? selectedPlan.priceMonthly
      : selectedPlan.priceYearly;

    let discount = 0;
    if (couponValidation?.valid) {
      if (couponValidation.discountType === 'percentage') {
        discount = (basePrice * couponValidation.discountValue) / 100;
      } else {
        discount = couponValidation.discountValue;
      }
    }

    return Math.max(0, basePrice - discount);
  };

  const handleNext = () => {
    if (!selectedPlan) {
      toast({
        title: 'No Plan Selected',
        description: 'Please select a subscription plan',
        variant: 'destructive',
      });
      return;
    }

    onNext(calculateFinalAmount());
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <Button variant="ghost" onClick={onBack}>
          ← Back to Business Profile
        </Button>
      </div>

      {/* Billing Cycle Toggle */}
      <div className="flex justify-center gap-4">
        <Button
          variant={billingCycle === 'monthly' ? 'default' : 'outline'}
          onClick={() => onBillingCycleChange('monthly')}
        >
          Monthly
        </Button>
        <Button
          variant={billingCycle === 'yearly' ? 'default' : 'outline'}
          onClick={() => onBillingCycleChange('yearly')}
        >
          Yearly <Badge variant="secondary" className="ml-2">Save 20%</Badge>
        </Button>
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <Card
            key={plan.id}
            className={`cursor-pointer transition-all hover:shadow-lg ${
              selectedPlan?.id === plan.id ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => onPlanSelect(plan)}
          >
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
              <div className="text-3xl font-bold">
                ₹{billingCycle === 'monthly' ? plan.priceMonthly : plan.priceYearly}
                <span className="text-sm font-normal text-muted-foreground">
                  /{billingCycle === 'monthly' ? 'month' : 'year'}
                </span>
              </div>
            </CardHeader>

            <CardContent>
              <ul className="space-y-2">
                {(JSON.parse(plan.features || '[]') as string[]).map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Coupon Input */}
      <Card>
        <CardHeader>
          <CardTitle>Have a Coupon Code?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Enter coupon code"
              value={couponCode}
              onChange={(e) => onCouponChange(e.target.value.toUpperCase())}
            />
            <Button onClick={onValidateCoupon} disabled={isValidatingCoupon || !couponCode}>
              {isValidatingCoupon ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Validating...
                </>
              ) : (
                'Apply'
              )}
            </Button>
          </div>

          {couponValidation?.valid && (
            <Alert className="mt-4 border-green-500">
              <Check className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-600">
                Coupon applied! {couponValidation.discountType === 'percentage'
                  ? `${couponValidation.discountValue}% discount`
                  : `₹${couponValidation.discountValue} off`}
              </AlertDescription>
            </Alert>
          )}

          {couponValidation?.valid === false && (
            <Alert className="mt-4" variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{couponValidation.error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Pricing Summary */}
      {selectedPlan && (
        <Card>
          <CardHeader>
            <CardTitle>Pricing Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Plan: {selectedPlan.name}</span>
                <span>₹{billingCycle === 'monthly' ? selectedPlan.priceMonthly : selectedPlan.priceYearly}</span>
              </div>

              {couponValidation?.valid && (
                <div className="flex justify-between text-green-600">
                  <span>Discount ({couponCode})</span>
                  <span>- ₹{(billingCycle === 'monthly' ? selectedPlan.priceMonthly : selectedPlan.priceYearly) - calculateFinalAmount()}</span>
                </div>
              )}

              <div className="flex justify-between text-lg font-bold pt-2 border-t">
                <span>Total Amount</span>
                <span>₹{calculateFinalAmount()}</span>
              </div>

              <p className="text-xs text-muted-foreground">
                GST will be calculated and shown in the invoice
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Button onClick={handleNext} className="w-full" size="lg">
        Proceed to Payment
      </Button>
    </div>
  );
}

// Payment Step Component
function PaymentStep({
  amount,
  businessProfile,
  selectedPlan,
  billingCycle,
  couponCode,
  sessionToken,
  isProcessing,
  onPaymentSuccess,
  onBack,
  setIsProcessing,
}: {
  amount: number;
  businessProfile: BusinessProfile;
  selectedPlan: Plan;
  billingCycle: string;
  couponCode: string;
  sessionToken: string;
  isProcessing: boolean;
  onPaymentSuccess: (userId: string, invoiceId: string) => void;
  onBack: () => void;
  setIsProcessing: (value: boolean) => void;
}) {
  const { toast } = useToast();

  const handleFreeSubscription = async () => {
    setIsProcessing(true);

    try {
      const response = await fetch('/api/signup/complete-free', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionToken,
          planId: selectedPlan.id,
          billingCycle,
          couponCode,
        }),
      });

      const data = await response.json();

      if (data.success) {
        onPaymentSuccess(data.userId, data.invoiceId);
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to activate subscription',
          variant: 'destructive',
        });
        setIsProcessing(false);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to process subscription',
        variant: 'destructive',
      });
      setIsProcessing(false);
    }
  };

  const handleRazorpayPayment = async () => {
    setIsProcessing(true);

    try {
      // Step 1: Create Razorpay order
      const orderResponse = await fetch('/api/signup/create-payment-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionToken,
          planId: selectedPlan.id,
          billingCycle,
          couponCode,
        }),
      });

      const orderData = await orderResponse.json();

      if (!orderData.success) {
        throw new Error(orderData.error || 'Failed to create payment order');
      }

      // Step 2: Open Razorpay Checkout
      const options = {
        key: orderData.razorpayKeyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'BoxCostPro',
        description: `${selectedPlan.name} - ${billingCycle === 'monthly' ? 'Monthly' : 'Yearly'}`,
        order_id: orderData.orderId,
        prefill: {
          name: businessProfile.authorizedPersonName,
          email: businessProfile.businessEmail,
          contact: businessProfile.mobileNumber,
        },
        theme: {
          color: '#3B82F6',
        },
        handler: async function (response: any) {
          await verifyAndCompleteSignup(response);
        },
      };

      const razorpay = new (window as any).Razorpay(options);
      razorpay.open();

      razorpay.on('payment.failed', function (response: any) {
        toast({
          title: 'Payment Failed',
          description: 'Please try again or contact support',
          variant: 'destructive',
        });
        setIsProcessing(false);
      });

    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to initiate payment',
        variant: 'destructive',
      });
      setIsProcessing(false);
    }
  };

  const verifyAndCompleteSignup = async (razorpayResponse: any) => {
    try {
      const response = await fetch('/api/signup/complete-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionToken,
          razorpayOrderId: razorpayResponse.razorpay_order_id,
          razorpayPaymentId: razorpayResponse.razorpay_payment_id,
          razorpaySignature: razorpayResponse.razorpay_signature,
        }),
      });

      const data = await response.json();

      if (data.success) {
        onPaymentSuccess(data.userId, data.invoiceId);
      } else {
        throw new Error(data.error || 'Payment verification failed');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to complete signup',
        variant: 'destructive',
      });
      setIsProcessing(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Complete Payment</CardTitle>
        <CardDescription>
          Secure payment powered by Razorpay
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Order Summary */}
        <div className="bg-muted p-4 rounded-lg space-y-2">
          <h3 className="font-semibold">Order Summary</h3>
          <div className="flex justify-between text-sm">
            <span>Plan:</span>
            <span>{selectedPlan.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Business:</span>
            <span>{businessProfile.businessName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Email:</span>
            <span>{businessProfile.businessEmail}</span>
          </div>
          <div className="flex justify-between text-lg font-bold pt-2 border-t">
            <span>Total Amount:</span>
            <span>₹{amount}</span>
          </div>
        </div>

        {/* Payment Button */}
        {amount === 0 ? (
          <Button
            onClick={handleFreeSubscription}
            disabled={isProcessing}
            className="w-full"
            size="lg"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              'Activate Free Subscription'
            )}
          </Button>
        ) : (
          <Button
            onClick={handleRazorpayPayment}
            disabled={isProcessing}
            className="w-full"
            size="lg"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              `Pay ₹${amount}`
            )}
          </Button>
        )}

        <Button variant="ghost" onClick={onBack} className="w-full" disabled={isProcessing}>
          ← Back to Plan Selection
        </Button>

        {/* Security Badges */}
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Lock className="h-3 w-3" />
            <span>Secure Payment</span>
          </div>
          <div className="flex items-center gap-1">
            <Shield className="h-3 w-3" />
            <span>SSL Encrypted</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
