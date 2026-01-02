import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Building2, AlertTriangle, CheckCircle, ChevronLeft } from "lucide-react";
import { Link } from "wouter";

// GST State Codes mapping
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
  '28': 'Andhra Pradesh',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh (New)',
  '38': 'Ladakh',
};

export default function SellerSetup() {
  const { toast } = useToast();

  const [sellerProfile, setSellerProfile] = useState({
    companyName: '',
    gstin: '',
    panNo: '',
    stateCode: '',
    stateName: '',
    address: '',
    email: '',
    phone: '',
    website: '',
  });

  const [gstError, setGstError] = useState('');
  const [isGSTValid, setIsGSTValid] = useState(false);

  // Fetch existing seller profile
  const { data: existingProfile, isLoading } = useQuery({
    queryKey: ['/api/seller-profile'],
    retry: false,
  });

  // Load existing profile if available
  useEffect(() => {
    if (existingProfile) {
      setSellerProfile({
        companyName: existingProfile.companyName || '',
        gstin: existingProfile.gstin || '',
        panNo: existingProfile.panNo || '',
        stateCode: existingProfile.stateCode || '',
        stateName: existingProfile.stateName || '',
        address: existingProfile.address || '',
        email: existingProfile.email || '',
        phone: existingProfile.phone || '',
        website: existingProfile.website || '',
      });
      setIsGSTValid(!!existingProfile.gstin);
    }
  }, [existingProfile]);

  // Validate GSTIN and auto-derive PAN and State
  useEffect(() => {
    if (sellerProfile.gstin && sellerProfile.gstin.length === 15) {
      validateGSTIN(sellerProfile.gstin);
    } else if (sellerProfile.gstin.length > 0 && sellerProfile.gstin.length !== 15) {
      setGstError('GSTIN must be exactly 15 characters');
      setIsGSTValid(false);
    } else {
      setGstError('');
      setIsGSTValid(false);
    }
  }, [sellerProfile.gstin]);

  const validateGSTIN = (gstin: string) => {
    // GSTIN format: 2 digits (state code) + 10 alphanumeric (PAN) + 1 digit + 1 letter + 1 alphanumeric
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

    setSellerProfile(prev => ({
      ...prev,
      panNo: pan,
      stateCode: state,
      stateName: stateName,
    }));

    setGstError('');
    setIsGSTValid(true);
  };

  const saveMutation = useMutation({
    mutationFn: (data: any) => {
      if (existingProfile) {
        return apiRequest('PUT', '/api/seller-profile', data);
      } else {
        return apiRequest('POST', '/api/seller-profile', data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/seller-profile'] });
      toast({
        title: "Seller profile saved",
        description: "Your company details have been saved successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save seller profile",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!sellerProfile.companyName || !sellerProfile.gstin ||
        !sellerProfile.address || !sellerProfile.email || !sellerProfile.phone) {
      toast({
        title: "Validation Error",
        description: "Please fill all required fields",
        variant: "destructive",
      });
      return;
    }

    if (!isGSTValid) {
      toast({
        title: "Invalid GSTIN",
        description: "Please enter a valid GSTIN",
        variant: "destructive",
      });
      return;
    }

    saveMutation.mutate(sellerProfile);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading seller profile...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building2 className="w-8 h-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">Seller Profile Setup</h1>
                <p className="text-sm text-muted-foreground">Configure your company details for invoices</p>
              </div>
            </div>
            <Link href="/admin">
              <Button variant="outline">
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back to Admin
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl">
        <Alert className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Important:</strong> These details will appear on all GST invoices issued to customers.
            Ensure GSTIN and company name match your GST registration exactly.
          </AlertDescription>
        </Alert>

        {existingProfile && (
          <Alert className="mb-6">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Seller profile is already configured. You can update the details below.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Company Information</CardTitle>
            <CardDescription>
              Your company details that will be shown as "Seller" on subscription invoices
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="companyName">
                    Company / Business Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="companyName"
                    value={sellerProfile.companyName}
                    onChange={(e) => setSellerProfile({ ...sellerProfile, companyName: e.target.value })}
                    placeholder="e.g., ABC Enterprises Pvt Ltd"
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Must match your GST registration certificate
                  </p>
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="gstin">
                    GSTIN <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="gstin"
                    maxLength={15}
                    value={sellerProfile.gstin}
                    onChange={(e) => setSellerProfile({ ...sellerProfile, gstin: e.target.value.toUpperCase() })}
                    placeholder="e.g., 29ABCDE1234F1Z5"
                    className={isGSTValid ? 'border-green-500' : gstError ? 'border-red-500' : ''}
                    required
                  />
                  {gstError && <p className="text-xs text-red-500 mt-1">{gstError}</p>}
                  {isGSTValid && <p className="text-xs text-green-600 mt-1">✓ Valid GSTIN</p>}
                </div>

                <div>
                  <Label htmlFor="panNo">PAN Number</Label>
                  <Input
                    id="panNo"
                    value={sellerProfile.panNo}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Auto-derived from GSTIN</p>
                </div>

                <div>
                  <Label htmlFor="stateName">State</Label>
                  <Input
                    id="stateName"
                    value={sellerProfile.stateName}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Auto-derived from GSTIN</p>
                </div>

                <div>
                  <Label htmlFor="email">
                    Email Address <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={sellerProfile.email}
                    onChange={(e) => setSellerProfile({ ...sellerProfile, email: e.target.value })}
                    placeholder="e.g., billing@yourcompany.com"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="phone">
                    Phone Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={sellerProfile.phone}
                    onChange={(e) => setSellerProfile({ ...sellerProfile, phone: e.target.value })}
                    placeholder="e.g., +91 1234567890"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="website">Website (Optional)</Label>
                  <Input
                    id="website"
                    type="url"
                    value={sellerProfile.website}
                    onChange={(e) => setSellerProfile({ ...sellerProfile, website: e.target.value })}
                    placeholder="e.g., https://yourcompany.com"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="address">
                    Full Business Address <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="address"
                    value={sellerProfile.address}
                    onChange={(e) => setSellerProfile({ ...sellerProfile, address: e.target.value })}
                    rows={3}
                    placeholder="Enter complete address with pincode"
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Must match your GST registration address
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <Button
                  type="submit"
                  disabled={!isGSTValid || saveMutation.isPending}
                  className="flex-1"
                >
                  {saveMutation.isPending ? 'Saving...' : existingProfile ? 'Update Seller Profile' : 'Save Seller Profile'}
                </Button>
                <Link href="/admin">
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        <Alert className="mt-6">
          <AlertDescription>
            <strong>Why is this needed?</strong> When customers sign up and make payments, the system automatically
            generates GST-compliant invoices. These invoices show your company as the "Seller" and the customer
            as the "Buyer". This seller information is legally required on all tax invoices.
          </AlertDescription>
        </Alert>
      </main>
    </div>
  );
}
