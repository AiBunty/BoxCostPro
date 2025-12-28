import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  User,
  Building2,
  Palette,
  Mail,
  Phone,
  MapPin,
  Globe,
  Upload,
  Save,
} from "lucide-react";

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
  website?: string;
  logoUrl?: string;
  isDefault: boolean;
}

export default function Account() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [companyName, setCompanyName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [address, setAddress] = useState("");

  const { data: companyProfiles, isLoading: profilesLoading } = useQuery<CompanyProfile[]>({
    queryKey: ["/api/company-profiles"],
  });

  const defaultProfile = companyProfiles?.find((p) => p.isDefault) || companyProfiles?.[0];

  useEffect(() => {
    if (defaultProfile) {
      setCompanyName(defaultProfile.companyName || "");
      setOwnerName(defaultProfile.ownerName || "");
      setPhone(defaultProfile.phone || "");
      setWebsite(defaultProfile.website || "");
      setGstNumber(defaultProfile.gstNo || "");
      setPanNumber(defaultProfile.panNo || "");
      setAddress(defaultProfile.address || "");
    }
  }, [defaultProfile]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      if (defaultProfile) {
        return apiRequest("PATCH", `/api/company-profiles/${defaultProfile.id}`, data);
      } else {
        return apiRequest("POST", "/api/company-profiles", { ...data, isDefault: true });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company-profiles"] });
      toast({ title: "Business Profile Saved", description: "Your company details have been updated." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to save business profile", variant: "destructive" });
    }
  });

  const handleSaveBusiness = () => {
    // Validate required fields: Owner Name, Mobile No (phone), Company Name, GST No
    if (!companyName.trim() || !ownerName.trim() || !phone.trim() || !gstNumber.trim()) {
      toast({
        title: "Missing Required Fields",
        description: "Owner Name, Mobile No, Company Name, and GST No are required.",
        variant: "destructive",
      });
      return;
    }
    updateProfileMutation.mutate({
      companyName,
      ownerName,
      phone,
      email: user?.email || "",
      website,
      gstNo: gstNumber,
      panNo: panNumber,
      address,
    });
  };

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
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Account</h1>
        <p className="text-muted-foreground">
          Manage your personal and business settings
        </p>
      </div>

      {/* Personal Details */}
        <div className="mt-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Personal Details</CardTitle>
              <CardDescription>Your account information (read-only)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={user?.profileImageUrl || undefined} />
                  <AvatarFallback className="text-xl">{getInitials()}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-semibold">
                    {user?.firstName} {user?.lastName}
                  </h3>
                  <p className="text-muted-foreground">{user?.email}</p>
                  <Badge variant="secondary" className="mt-1">
                    {user?.role || "User"}
                  </Badge>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Email</Label>
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{user?.email || "—"}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-foreground">Mobile</Label>
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{user?.mobileNo || "—"}</span>
                  </div>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label className="text-muted-foreground">Company</Label>
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>{user?.companyName || "—"}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      {/* Business Profile - Single source of truth */}
        <div className="mt-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Business Details</CardTitle>
              <CardDescription>Master business profile used in quotes and documents</CardDescription>
            </CardHeader>
            <CardContent>
              {profilesLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : (
                <div className="space-y-4">
                   <div className="grid gap-4 sm:grid-cols-2">
                     <div className="space-y-2">
                       <Label htmlFor="ownerName">Owner / Contact Name<span className="text-red-600">*</span></Label>
                       <Input
                         id="ownerName"
                         value={ownerName}
                         onChange={(e) => setOwnerName(e.target.value)}
                         placeholder="Owner or primary contact"
                       />
                     </div>
                    <div className="space-y-2">
                       <Label htmlFor="companyName">Company Name<span className="text-red-600">*</span></Label>
                      <Input
                        id="companyName"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Your company name"
                      />
                    </div>

                    <div className="space-y-2">
                       <Label htmlFor="phone">Mobile No<span className="text-red-600">*</span></Label>
                      <Input
                        id="phone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Contact number"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={user?.email || ""}
                        disabled
                        className="bg-muted"
                        placeholder="Fetched from signup"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="website">Website</Label>
                      <Input
                        id="website"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        placeholder="https://yourwebsite.com"
                      />
                    </div>

                    <div className="space-y-2">
                       <Label htmlFor="gst">GST No<span className="text-red-600">*</span></Label>
                      <Input
                        id="gst"
                        value={gstNumber}
                        onChange={(e) => setGstNumber(e.target.value)}
                        placeholder="GST number"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="pan">PAN Number</Label>
                      <Input
                        id="pan"
                        value={panNumber}
                        onChange={(e) => setPanNumber(e.target.value)}
                        placeholder="PAN number"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Textarea
                      id="address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Full business address"
                      rows={3}
                    />
                  </div>

                  <Button className="gap-2" onClick={handleSaveBusiness} disabled={updateProfileMutation.isPending}>
                    <Save className="h-4 w-4" />
                    Save Changes
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      {/* Branding */}
        <div className="mt-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Branding</CardTitle>
              <CardDescription>Customize your logo for quotes and documents</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row items-start gap-6">
                  <div className="shrink-0">
                    <div className="h-24 w-24 rounded-lg border-2 border-dashed flex items-center justify-center bg-muted/30">
                      {defaultProfile?.logo ? (
                        <img
                          src={defaultProfile.logo}
                          alt="Logo"
                          className="h-full w-full object-contain rounded-lg"
                        />
                      ) : (
                        <Upload className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <h4 className="font-medium">Company Logo</h4>
                    <p className="text-sm text-muted-foreground">
                      Upload your logo to display on quotes and documents. Maximum file size: 500KB.
                      Recommended: Square image, PNG or JPEG format.
                    </p>
                    <Button variant="outline" className="gap-2">
                      <Upload className="h-4 w-4" />
                      Upload Logo
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
    </div>
  );
}
