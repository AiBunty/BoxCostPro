import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Save, Lock, AlertTriangle } from "lucide-react";

// GST State Code to State Name Mapping (subset - matches backend)
const GST_STATE_CODES: Record<string, string> = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
  '97': 'Other Territory',
  '99': 'Centre Jurisdiction',
};

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

export default function Account() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [ownerName, setOwnerName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [gstNo, setGstNo] = useState("");
  const [panNo, setPanNo] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [stateName, setStateName] = useState("");
  const [address, setAddress] = useState("");

  const [gstError, setGstError] = useState<string | null>(null);
  const [isGSTValid, setIsGSTValid] = useState(false);

  const markBusinessProfileStep = async () => {
    try {
      await apiRequest("POST", "/api/user/setup/update", { stepKey: "businessProfile" });
      queryClient.invalidateQueries({ queryKey: ["/api/user/setup/status"] });
    } catch (error) {
      console.error("Failed to mark business profile setup step", error);
    }
  };

  const { data: companyProfiles, isLoading: profilesLoading } = useQuery<CompanyProfile[]>({
    queryKey: ["/api/company-profiles"],
  });

  const defaultProfile = companyProfiles?.find((p) => p.isDefault) || companyProfiles?.[0];

  // Populate form when profile loads
  useEffect(() => {
    if (defaultProfile) {
      setOwnerName(defaultProfile.ownerName || "");
      setCompanyName(defaultProfile.companyName || "");
      setPhone(defaultProfile.phone || "");
      setWebsite(defaultProfile.website || "");
      setGstNo(defaultProfile.gstNo || "");
      setPanNo(defaultProfile.panNo || "");
      setStateCode(defaultProfile.stateCode || "");
      setStateName(defaultProfile.stateName || "");
      setAddress(defaultProfile.address || "");
    }
  }, [defaultProfile]);

  // Real-time GSTIN validation (client-side preview)
  useEffect(() => {
    if (gstNo && gstNo.length === 15) {
      validateGSTINClient(gstNo);
    } else if (gstNo === '') {
      setGstError(null);
      setIsGSTValid(false);
      setPanNo('');
      setStateCode('');
      setStateName('');
    } else if (gstNo.length > 0) {
      setGstError('GSTIN must be exactly 15 characters');
      setIsGSTValid(false);
    }
  }, [gstNo]);

  // Client-side GSTIN validation (mirrors backend logic)
  const validateGSTINClient = (gstin: string) => {
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
      setGstError('Invalid state code in GSTIN');
      setIsGSTValid(false);
      return;
    }

    setPanNo(pan);
    setStateCode(state);
    setStateName(stateName);
    setGstError(null);
    setIsGSTValid(true);
  };

  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      if (defaultProfile) {
        return apiRequest("PATCH", `/api/company-profiles/${defaultProfile.id}`, data);
      } else {
        return apiRequest("POST", "/api/company-profiles", { ...data, isDefault: true });
      }
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company-profiles"] });
      toast({ title: "Business Profile Saved", description: "Your company details have been updated." });
      await markBusinessProfileStep();
    },
    onError: (error: any) => {
      const errorMessage = error?.message || "Failed to save business profile";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    }
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

    if (!gstNo.trim()) {
      toast({
        title: "Missing Required Field",
        description: "GSTIN is required.",
        variant: "destructive",
      });
      return;
    }

    // Validate GSTIN before submit
    if (gstNo && !isGSTValid) {
      toast({
        title: "Invalid GSTIN",
        description: "Please enter a valid GSTIN",
        variant: "destructive",
      });
      return;
    }

    updateProfileMutation.mutate({
      ownerName,
      companyName,
      phone,
      email: user?.email || "",
      website,
      gstNo,
      address,
    });
  };

  // Check if legal fields are locked
  const isLocked = defaultProfile?.hasFinancialDocs || false;
  const adminRoles = ['admin', 'super_admin'];
  const isProfileOwner = defaultProfile?.userId === user?.id;
  const isUnclaimedProfile = !defaultProfile?.userId;
  // Allow edits when admin/super_admin, when profile is unclaimed, or when current user owns it
  const canEdit = adminRoles.includes(user?.role || '') || isProfileOwner || isUnclaimedProfile;

  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user?.firstName) {
      return user.firstName[0].toUpperCase();
    }
    return "U";
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Account</h1>
        <p className="text-muted-foreground">
          Manage your business profile settings
        </p>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Business Account</CardTitle>
          <CardDescription>
            This information will be used across all documents, invoices, and communications.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {profilesLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <>
              {/* User Identity Header (Minimal, Read-Only) */}
              <div className="flex items-center gap-4 pb-6 mb-6 border-b">
                <Avatar className="h-16 w-16">
                  {user?.profileImageUrl ? (
                    <AvatarImage src={user.profileImageUrl} alt={user?.firstName || ''} />
                  ) : (
                    <AvatarFallback className="text-lg bg-primary/10 text-primary">
                      {getInitials()}
                    </AvatarFallback>
                  )}
                </Avatar>

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">
                      {user?.firstName} {user?.lastName}
                    </h3>
                    <Badge variant="secondary" className="text-xs">
                      {user?.role}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                </div>
              </div>

              {/* Invoice Lock Warning */}
              {isLocked && (
                <Alert className="mb-6" variant="destructive">
                  <Lock className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Legal fields locked:</strong> {defaultProfile.lockedReason}
                    <br />
                    GSTIN, PAN, State, Company Name, and Address cannot be modified after financial documents have been issued.
                  </AlertDescription>
                </Alert>
              )}

              {/* Non-Owner Warning */}
              {!canEdit && (
                <Alert className="mb-6">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Only the account owner can edit business profile details. If this profile is unclaimed, contact an admin to assign ownership.
                  </AlertDescription>
                </Alert>
              )}

              {/* Unified Business Profile Form */}
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Row 1: Owner Name + Company Name */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ownerName">Account Owner / Authorized Person<span className="text-red-500">*</span></Label>
                    <Input
                      id="ownerName"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      required
                      disabled={!canEdit}
                      className={!canEdit ? 'bg-muted cursor-not-allowed' : ''}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company / Business Name<span className="text-red-500">*</span></Label>
                    <Input
                      id="companyName"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      required
                      disabled={!canEdit || isLocked}
                      className={!canEdit || isLocked ? 'bg-muted cursor-not-allowed' : ''}
                    />
                    {isLocked && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Lock className="h-3 w-3" /> Locked (used in financial documents)
                      </p>
                    )}
                  </div>
                </div>

                {/* Row 2: Mobile + Email */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Business Mobile Number<span className="text-red-500">*</span></Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                      disabled={!canEdit}
                      className={!canEdit ? 'bg-muted cursor-not-allowed' : ''}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Business Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={user?.email || ""}
                      disabled
                      className="bg-muted cursor-not-allowed"
                    />
                    <p className="text-xs text-muted-foreground">
                      Email is auto-filled from your login account
                    </p>
                  </div>
                </div>

                {/* Row 3: Website + GSTIN */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      type="url"
                      placeholder="https://yourcompany.com"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      disabled={!canEdit}
                      className={!canEdit ? 'bg-muted cursor-not-allowed' : ''}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gstNo">GSTIN<span className="text-red-500">*</span></Label>
                    <Input
                      id="gstNo"
                      maxLength={15}
                      placeholder="27AAACV3467G1ZH"
                      value={gstNo}
                      onChange={(e) => setGstNo(e.target.value.toUpperCase())}
                      required
                      disabled={!canEdit || isLocked}
                      className={`${!canEdit || isLocked ? 'bg-muted cursor-not-allowed' : ''} ${isGSTValid ? 'border-green-500' : gstError ? 'border-red-500' : ''}`}
                    />
                    {gstError && (
                      <p className="text-xs text-red-500">{gstError}</p>
                    )}
                    {isGSTValid && (
                      <p className="text-xs text-green-600">✓ Valid GSTIN</p>
                    )}
                    {isLocked && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Lock className="h-3 w-3" /> Locked (used in financial documents)
                      </p>
                    )}
                  </div>
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
                      Automatically extracted from GSTIN (positions 3-12)
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
                      Automatically determined from GSTIN state code ({stateCode})
                    </p>
                  </div>
                </div>

                {/* Row 5: Address (Full Width) */}
                <div className="space-y-2">
                  <Label htmlFor="address">Full Business Address<span className="text-red-500">*</span></Label>
                  <Textarea
                    id="address"
                    rows={3}
                    placeholder="Complete registered business address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    required
                    disabled={!canEdit || isLocked}
                    className={!canEdit || isLocked ? 'bg-muted cursor-not-allowed' : ''}
                  />
                  {isLocked && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Lock className="h-3 w-3" /> Locked (used in financial documents)
                    </p>
                  )}
                </div>

                {/* Submit Button */}
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={updateProfileMutation.isPending || !canEdit}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
