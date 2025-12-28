import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Phone, Loader2, Package, User, Building2, CheckCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

const COUNTRY_CODES = [
  { code: "+91", country: "India", flag: "IN" },
  { code: "+1", country: "United States", flag: "US" },
  { code: "+44", country: "United Kingdom", flag: "UK" },
  { code: "+971", country: "UAE", flag: "AE" },
  { code: "+966", country: "Saudi Arabia", flag: "SA" },
  { code: "+65", country: "Singapore", flag: "SG" },
  { code: "+60", country: "Malaysia", flag: "MY" },
  { code: "+61", country: "Australia", flag: "AU" },
  { code: "+49", country: "Germany", flag: "DE" },
  { code: "+33", country: "France", flag: "FR" },
];

const profileSchema = z.object({
  firstName: z.string().min(2, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  companyName: z.string().optional(),
  countryCode: z.string().min(1, "Country code is required"),
  mobileNumber: z.string()
    .min(8, "Enter a valid mobile number")
    .max(12, "Mobile number too long")
    .regex(/^[0-9]+$/, "Only digits allowed"),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export default function CompleteProfilePage() {
  const [, navigate] = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: user } = useQuery<any>({
    queryKey: ['/api/auth/user'],
  });

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: { 
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      companyName: "",
      countryCode: "+91",
      mobileNumber: "",
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      return apiRequest('POST', '/api/user/complete-profile', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user-profile'] });
      toast({
        title: "Profile Complete!",
        description: "Welcome to PaperBox ERP.",
      });
      navigate("/");
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (data: ProfileFormData) => {
    setIsSubmitting(true);
    try {
      await updateProfileMutation.mutateAsync(data);
    } finally {
      setIsSubmitting(false);
    }
  };

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
          <CardTitle>Complete Your Profile</CardTitle>
          <CardDescription>
            Just a few more details to get you started
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center mb-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Account Created</span>
              </div>
              <span className="text-muted-foreground/50">-</span>
              <div className="flex items-center gap-1">
                <div className="h-4 w-4 rounded-full border-2 border-primary bg-primary/20 flex items-center justify-center">
                  <span className="text-xs text-primary font-bold">2</span>
                </div>
                <span className="font-medium text-foreground">Profile Details</span>
              </div>
            </div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input 
                            placeholder="First" 
                            className="pl-10"
                            {...field} 
                            data-testid="input-firstname"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Last" 
                          {...field} 
                          data-testid="input-lastname"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name (Optional)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                          placeholder="Your company name" 
                          className="pl-10"
                          {...field} 
                          data-testid="input-company"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <FormLabel>Mobile Number</FormLabel>
                <div className="flex gap-2">
                  <FormField
                    control={form.control}
                    name="countryCode"
                    render={({ field }) => (
                      <FormItem className="w-[120px]">
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger data-testid="select-country-code">
                              <SelectValue placeholder="+91" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {COUNTRY_CODES.map((country) => (
                              <SelectItem key={country.code} value={country.code}>
                                {country.code} {country.flag}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="mobileNumber"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                              type="tel"
                              placeholder="9876543210" 
                              className="pl-10"
                              {...field} 
                              data-testid="input-mobile"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              
              <div className="bg-muted p-3 rounded-lg text-sm text-muted-foreground">
                <p>Your mobile number helps us verify your identity and send important notifications about your account.</p>
              </div>
              
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isSubmitting}
                data-testid="button-complete-profile"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Complete Profile'
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
