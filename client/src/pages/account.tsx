import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  gstNumber?: string;
  panNumber?: string;
  website?: string;
  logo?: string;
  isDefault: boolean;
}

export default function Account() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("personal");

  const { data: companyProfiles, isLoading: profilesLoading } = useQuery<CompanyProfile[]>({
    queryKey: ["/api/company-profiles"],
  });

  const defaultProfile = companyProfiles?.find((p) => p.isDefault) || companyProfiles?.[0];

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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="personal" className="gap-2">
            <User className="h-4 w-4 hidden sm:inline" />
            Personal
          </TabsTrigger>
          <TabsTrigger value="business" className="gap-2">
            <Building2 className="h-4 w-4 hidden sm:inline" />
            Business
          </TabsTrigger>
          <TabsTrigger value="branding" className="gap-2">
            <Palette className="h-4 w-4 hidden sm:inline" />
            Branding
          </TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="mt-6">
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
        </TabsContent>

        <TabsContent value="business" className="mt-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Business Details</CardTitle>
              <CardDescription>Your company profile used in quotes</CardDescription>
            </CardHeader>
            <CardContent>
              {profilesLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : defaultProfile ? (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="companyName">Company Name</Label>
                      <Input
                        id="companyName"
                        defaultValue={defaultProfile.name}
                        placeholder="Your company name"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        defaultValue={defaultProfile.phone || ""}
                        placeholder="Contact number"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        defaultValue={defaultProfile.email || ""}
                        placeholder="Business email"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="website">Website</Label>
                      <Input
                        id="website"
                        defaultValue={defaultProfile.website || ""}
                        placeholder="https://yourwebsite.com"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="gst">GST Number</Label>
                      <Input
                        id="gst"
                        defaultValue={defaultProfile.gstNumber || ""}
                        placeholder="GST number"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="pan">PAN Number</Label>
                      <Input
                        id="pan"
                        defaultValue={defaultProfile.panNumber || ""}
                        placeholder="PAN number"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Textarea
                      id="address"
                      defaultValue={defaultProfile.address || ""}
                      placeholder="Full business address"
                      rows={3}
                    />
                  </div>

                  <Button className="gap-2">
                    <Save className="h-4 w-4" />
                    Save Changes
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Building2 className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="text-muted-foreground mb-4">No business profile found</p>
                  <Button>Create Profile</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branding" className="mt-6">
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
