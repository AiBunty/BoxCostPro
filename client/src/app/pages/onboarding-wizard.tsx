import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  Send,
} from "lucide-react";
import { validateGSTIN, extractPANFromGST, getStateFromGST } from "@shared/gst";

interface CompanyProfile {
  id: string;
  userId: string;
  companyName: string;
  ownerName?: string;
  address?: string;
  phone?: string;
  email?: string;
  gstNo?: string;
  panNo?: string;
  stateCode?: string;
  stateName?: string;
  website?: string;
  logoUrl?: string;
  isDefault: boolean;
  hasFinancialDocs?: boolean;
  lockedAt?: string;
  lockedReason?: string;
}

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
  verificationStatus:
    | "NOT_SUBMITTED"
    | "PENDING"
    | "APPROVED"
    | "REJECTED";
  submittedForVerification: boolean;
  rejectionReason?: string | null;
  submittedAt?: string | null;
  approvedAt?: string | null;
}

export default function OnboardingWizard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // Form state
  const [ownerName, setOwnerName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [gstNo, setGstNo] = useState("");
  const [panNo, setPanNo] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [stateName, setStateName] = useState("");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [pincode, setPincode] = useState("");
  const [countryCode, setCountryCode] = useState("+91");

  // Validation state
  const [gstError, setGstError] = useState<string | null>(null);
  const [isGSTValid, setIsGSTValid] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [pincodeError, setPincodeError] = useState<string | null>(null);

  // Modal state
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [isSubmittingVerification, setIsSubmittingVerification] =
    useState(false);

  // Fetch company profiles
  const { data: companyProfiles, isLoading: profilesLoading } = useQuery<
    CompanyProfile[]
  >({
    queryKey: ["/api/company-profiles"],
  });

  const defaultProfile =
    companyProfiles?.find((p) => p.isDefault) || companyProfiles?.[0];

  // Fetch setup status
  const { data: setupStatus } = useQuery<SetupStatusResponse>({
    queryKey: ["/api/user/setup/status"],
    staleTime: 10000,
  });

  // Populate form when profile loads
  useEffect(() => {
    if (defaultProfile) {
      setOwnerName(defaultProfile.ownerName || "");
      setCompanyName(defaultProfile.companyName || "");
      setPhone(defaultProfile.phone || "");
      setCountryCode((defaultProfile as any).countryCode || "+91");
      setWebsite(defaultProfile.website || "");
      setGstNo(defaultProfile.gstNo || "");
      setPanNo(defaultProfile.panNo || "");
      setStateCode(defaultProfile.stateCode || "");
      setStateName(defaultProfile.stateName || "");
      setAddress1((defaultProfile as any).address1 || "");
      setAddress2((defaultProfile as any).address2 || "");
      setPincode((defaultProfile as any).pincode || "");
    }
  }, [defaultProfile]);

  // Real-time GSTIN validation
  useEffect(() => {
    if (gstNo && gstNo.length === 15) {
      validateGSTINClient(gstNo);
    } else if (gstNo === "") {
      setGstError(null);
      setIsGSTValid(false);
      setPanNo("");
      setStateCode("");
      setStateName("");
    } else if (gstNo.length > 0) {
      setGstError("GSTIN must be exactly 15 characters");
      setIsGSTValid(false);
    }
  }, [gstNo]);

  // Client-side GSTIN validation
  const validateGSTINClient = (gstin: string) => {
    const result = validateGSTIN(gstin);
    if (!result.valid) {
      setGstError(result.error || "Invalid GSTIN");
      setIsGSTValid(false);
      return;
    }

    const pan = extractPANFromGST(gstin);
    const stateInfo = getStateFromGST(gstin);
    setPanNo(pan);
    setStateCode(stateInfo?.code || "");
    setStateName(stateInfo?.name || "");
    setGstError(null);
    setIsGSTValid(true);
  };

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      if (defaultProfile) {
        return apiRequest(
          "PATCH",
          `/api/company-profiles/${defaultProfile.id}`,
          data
        );
      } else {
        return apiRequest("POST", "/api/company-profiles", {
          ...data,
          isDefault: true,
        });
      }
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/setup/status"] });

      // Mark business profile step as complete
      await apiRequest("POST", "/api/user/setup/update", {
        stepKey: "businessProfile",
      });

      // Show completion modal
      setShowCompletionModal(true);

      toast({
        title: "Profile Saved",
        description: "Your business profile has been saved successfully.",
      });
    },
    onError: (error: any) => {
      const errorMessage =
        error?.message || "Failed to save business profile";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Submit for verification mutation
  const submitVerificationMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/user/submit-verification"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/setup/status"] });
      toast({
        title: "Submitted for Verification",
        description:
          "Your account is now pending admin approval. You'll be notified once reviewed.",
      });

      // Close modal and navigate to onboarding status page
      setTimeout(() => {
        setShowCompletionModal(false);
        navigate("/onboarding");
      }, 1500);
    },
    onError: (error: any) => {
      const errorMessage =
        error?.message || "Failed to submit for verification";
      toast({
        title: "Submission Failed",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!companyName.trim()) {
      toast({
        title: "Missing Required Field",
        description: "Company Name is required.",
        variant: "destructive",
      });
      return;
    }

    if (!ownerName.trim()) {
      toast({
        title: "Missing Required Field",
        description: "Owner / Contact Name is required.",
        variant: "destructive",
      });
      return;
    }

    if (!phone.trim()) {
      toast({
        title: "Missing Required Field",
        description: "Business Mobile Number is required.",
        variant: "destructive",
      });
      return;
    }

    // Validate phone: must be exactly 10 digits
    if (phone && !/^\d{10}$/.test(phone)) {
      setPhoneError("Phone must be exactly 10 digits");
      toast({
        title: "Invalid Phone Number",
        description: "Phone must be exactly 10 digits",
        variant: "destructive",
      });
      return;
    }
    setPhoneError(null);

    if (!address1.trim()) {
      toast({
        title: "Missing Required Field",
        description: "Address Line 1 is required.",
        variant: "destructive",
      });
      return;
    }

    if (!pincode.trim()) {
      toast({
        title: "Missing Required Field",
        description: "Pincode is required.",
        variant: "destructive",
      });
      return;
    }

    // Validate pincode: must be exactly 6 digits
    if (pincode && !/^\d{6}$/.test(pincode)) {
      setPincodeError("Pincode must be exactly 6 digits");
      toast({
        title: "Invalid Pincode",
        description: "Pincode must be exactly 6 digits",
        variant: "destructive",
      });
      return;
    }
    setPincodeError(null);

    if (!gstNo.trim()) {
      toast({
        title: "Missing Required Field",
        description: "GSTIN is required.",
        variant: "destructive",
      });
      return;
    }

    if (gstNo && !isGSTValid) {
      toast({
        title: "Invalid GSTIN",
        description: gstError || "Please enter a valid GSTIN.",
        variant: "destructive",
      });
      return;
    }

    updateProfileMutation.mutate({
      ownerName,
      companyName,
      phone,
      countryCode,
      email: user?.email || "",
      website,
      gstNo,
      address1,
      address2,
      pincode,
    });
  };

  if (profilesLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">
            Set Up Your Business Profile
          </h1>
          <p className="text-muted-foreground">
            Loading your business information...
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">
          Set Up Your Business Profile
        </h1>
        <p className="text-muted-foreground">
          Complete your business information to get started with BoxCost Pro.
        </p>
      </div>

      {/* Business Profile Form */}
      <Card>
        <CardHeader>
          <CardTitle>Business Information</CardTitle>
          <CardDescription>
            This information will be used across all documents and
            communications.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Row 1: Owner Name + Company Name */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ownerName">
                  Account Owner / Authorized Person
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="ownerName"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyName">
                  Company / Business Name<span className="text-red-500">*</span>
                </Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Row 2: Mobile + Website */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">
                  Business Mobile Number<span className="text-red-500">*</span>
                </Label>
                <div className="flex gap-2">
                  <Select
                    value={countryCode}
                    onValueChange={setCountryCode}
                  >
                    <SelectTrigger className="w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="+91">India (+91)</SelectItem>
                      <SelectItem value="+1">US (+1)</SelectItem>
                      <SelectItem value="+44">UK (+44)</SelectItem>
                      <SelectItem value="+971">UAE (+971)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="10 digits"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "");
                      setPhone(value);
                      if (value.length === 10) {
                        setPhoneError(null);
                      } else if (value.length > 0) {
                        setPhoneError(
                          "Phone must be exactly 10 digits"
                        );
                      } else {
                        setPhoneError(null);
                      }
                    }}
                    required
                    className={`flex-1 ${
                      phoneError ? "border-red-500" : ""
                    }`}
                  />
                </div>
                {phoneError && (
                  <p className="text-xs text-red-500">{phoneError}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  type="url"
                  placeholder="https://yourcompany.com"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>
            </div>

            {/* Row 3: GSTIN */}
            <div className="space-y-2">
              <Label htmlFor="gstNo">
                GSTIN<span className="text-red-500">*</span>
              </Label>
              <Input
                id="gstNo"
                maxLength={15}
                placeholder="27AAACV3467G1ZH"
                value={gstNo}
                onChange={(e) => setGstNo(e.target.value.toUpperCase())}
                required
                className={`${
                  isGSTValid
                    ? "border-green-500"
                    : gstError
                      ? "border-red-500"
                      : ""
                }`}
              />
              {gstError && (
                <p className="text-xs text-red-500">{gstError}</p>
              )}
              {isGSTValid && (
                <p className="text-xs text-green-600">✓ Valid GSTIN</p>
              )}
            </div>

            {/* Row 4: PAN + State (Auto-Derived, Read-Only) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="panNo">PAN (Auto-Derived)</Label>
                <Input
                  id="panNo"
                  value={panNo}
                  disabled
                  className="bg-muted cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground">
                  Automatically extracted from GSTIN
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="stateName">State (Auto-Derived)</Label>
                <Input
                  id="stateName"
                  value={stateName}
                  disabled
                  className="bg-muted cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground">
                  Determined from GSTIN state code ({stateCode})
                </p>
              </div>
            </div>

            {/* Row 5: Address Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="address1">
                  Address Line 1<span className="text-red-500">*</span>
                </Label>
                <Input
                  id="address1"
                  placeholder="Street address, building name"
                  value={address1}
                  onChange={(e) => setAddress1(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address2">Address Line 2</Label>
                <Input
                  id="address2"
                  placeholder="Apartment, suite, unit, etc. (optional)"
                  value={address2}
                  onChange={(e) => setAddress2(e.target.value)}
                />
              </div>
            </div>

            {/* Row 6: Pincode */}
            <div className="space-y-2">
              <Label htmlFor="pincode">
                Pincode<span className="text-red-500">*</span>
              </Label>
              <Input
                id="pincode"
                placeholder="6 digits"
                maxLength={6}
                value={pincode}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "");
                  setPincode(value);
                  if (value.length === 6) {
                    setPincodeError(null);
                  } else if (value.length > 0) {
                    setPincodeError(
                      "Pincode must be exactly 6 digits"
                    );
                  } else {
                    setPincodeError(null);
                  }
                }}
                required
                className={`md:w-1/2 ${
                  pincodeError ? "border-red-500" : ""
                }`}
              />
              {pincodeError && (
                <p className="text-xs text-red-500">{pincodeError}</p>
              )}
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-4">
              <Button
                type="submit"
                disabled={updateProfileMutation.isPending}
                size="lg"
              >
                {updateProfileMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Complete Setup"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Completion Modal */}
      <Dialog open={showCompletionModal} onOpenChange={setShowCompletionModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900">
                  <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <div className="space-y-2">
                <DialogTitle className="text-2xl">
                  🎉 Setup Complete!
                </DialogTitle>
                <DialogDescription className="text-base">
                  Your business profile has been saved.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Modal Content */}
          <div className="space-y-4 py-4">
            <Alert className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/20">
              <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertTitle className="text-blue-900 dark:text-blue-300">
                Account Forwarded for Approval
              </AlertTitle>
              <AlertDescription className="text-blue-800 dark:text-blue-400 text-sm mt-2">
                Your account has been forwarded for admin approval.
              </AlertDescription>
            </Alert>

            <div className="space-y-2 bg-muted/50 p-4 rounded-lg">
              <p className="font-medium text-sm">
                ✓ You will receive a confirmation email once your account is
                approved
              </p>
              <p className="text-xs text-muted-foreground">
                Typical approval time: 24 hours or less
              </p>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 p-3 rounded-lg">
              <p className="text-xs text-amber-900 dark:text-amber-300">
                <strong>Next Steps:</strong> We will review your business
                profile and send you an approval confirmation email. Once
                approved, you'll have full access to the dashboard.
              </p>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowCompletionModal(false)}
              disabled={submitVerificationMutation.isPending}
              className="flex-1"
            >
              Close
            </Button>
            <Button
              onClick={() =>
                submitVerificationMutation.mutate()
              }
              disabled={submitVerificationMutation.isPending}
              className="flex-1"
            >
              {submitVerificationMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Submit for Verification
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
