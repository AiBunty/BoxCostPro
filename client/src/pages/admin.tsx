import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Settings, Users, CreditCard, Tag, Mail, ChevronLeft, Plus, Trash2, Edit, Copy, DollarSign } from "lucide-react";
import { Link } from "wouter";
import type { SubscriptionPlan, Coupon, TrialInvite, UserSubscription, PaymentTransaction } from "@shared/schema";

export default function AdminPanel() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("subscriptions");
  
  // Dialog states
  const [showPlanDialog, setShowPlanDialog] = useState(false);
  const [showCouponDialog, setShowCouponDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  
  // Form states
  const [planName, setPlanName] = useState("");
  const [planDescription, setPlanDescription] = useState("");
  const [planPriceMonthly, setPlanPriceMonthly] = useState("");
  const [planPriceYearly, setPlanPriceYearly] = useState("");
  const [planTrialDays, setPlanTrialDays] = useState("14");
  
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscountType, setCouponDiscountType] = useState("percentage");
  const [couponDiscountValue, setCouponDiscountValue] = useState("");
  const [couponMaxUses, setCouponMaxUses] = useState("");
  
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteCompany, setInviteCompany] = useState("");
  const [inviteTrialDays, setInviteTrialDays] = useState("14");
  
  // Owner settings
  const [razorpayKeyId, setRazorpayKeyId] = useState("");
  const [razorpayKeySecret, setRazorpayKeySecret] = useState("");
  const [defaultTrialDays, setDefaultTrialDays] = useState("14");

  // Data queries
  const { data: plans = [] } = useQuery<SubscriptionPlan[]>({
    queryKey: ['/api/admin/subscription-plans'],
  });

  const { data: subscriptions = [] } = useQuery<UserSubscription[]>({
    queryKey: ['/api/admin/subscriptions'],
  });

  const { data: coupons = [] } = useQuery<Coupon[]>({
    queryKey: ['/api/admin/coupons'],
  });

  const { data: invites = [] } = useQuery<TrialInvite[]>({
    queryKey: ['/api/admin/trial-invites'],
  });

  const { data: transactions = [] } = useQuery<PaymentTransaction[]>({
    queryKey: ['/api/admin/transactions'],
  });

  const { data: ownerSettings } = useQuery({
    queryKey: ['/api/admin/settings'],
  });

  // Mutations
  const createPlanMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/admin/subscription-plans', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/subscription-plans'] });
      setShowPlanDialog(false);
      resetPlanForm();
      toast({ title: "Plan created", description: "Subscription plan has been created." });
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest('PATCH', `/api/admin/subscription-plans/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/subscription-plans'] });
      setShowPlanDialog(false);
      setEditingPlan(null);
      resetPlanForm();
      toast({ title: "Plan updated", description: "Subscription plan has been updated." });
    },
  });

  const deletePlanMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/admin/subscription-plans/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/subscription-plans'] });
      toast({ title: "Plan deleted", description: "Subscription plan has been deleted." });
    },
  });

  const createCouponMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/admin/coupons', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/coupons'] });
      setShowCouponDialog(false);
      resetCouponForm();
      toast({ title: "Coupon created", description: "Coupon code has been created." });
    },
  });

  const deleteCouponMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/admin/coupons/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/coupons'] });
      toast({ title: "Coupon deleted", description: "Coupon code has been deleted." });
    },
  });

  const createInviteMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/admin/trial-invites', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/trial-invites'] });
      setShowInviteDialog(false);
      setInviteEmail("");
      setInviteCompany("");
      toast({ title: "Invite sent", description: "Trial invite has been created." });
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (data: any) => apiRequest('PATCH', '/api/admin/settings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/settings'] });
      toast({ title: "Settings saved", description: "Owner settings have been updated." });
    },
  });

  const resetPlanForm = () => {
    setPlanName("");
    setPlanDescription("");
    setPlanPriceMonthly("");
    setPlanPriceYearly("");
    setPlanTrialDays("14");
  };

  const resetCouponForm = () => {
    setCouponCode("");
    setCouponDiscountType("percentage");
    setCouponDiscountValue("");
    setCouponMaxUses("");
  };

  const handleSavePlan = () => {
    const data = {
      name: planName,
      description: planDescription,
      priceMonthly: parseFloat(planPriceMonthly),
      priceYearly: planPriceYearly ? parseFloat(planPriceYearly) : null,
      trialDays: parseInt(planTrialDays),
    };
    
    if (editingPlan) {
      updatePlanMutation.mutate({ id: editingPlan.id, data });
    } else {
      createPlanMutation.mutate(data);
    }
  };

  const handleSaveCoupon = () => {
    const data = {
      code: couponCode.toUpperCase(),
      discountType: couponDiscountType,
      discountValue: parseFloat(couponDiscountValue),
      maxUses: couponMaxUses ? parseInt(couponMaxUses) : null,
    };
    
    createCouponMutation.mutate(data);
  };

  const handleSendInvite = () => {
    const data = {
      email: inviteEmail,
      companyName: inviteCompany || null,
      trialDays: parseInt(inviteTrialDays),
    };
    
    createInviteMutation.mutate(data);
  };

  const handleSaveSettings = () => {
    updateSettingsMutation.mutate({
      razorpayKeyId,
      razorpayKeySecret: razorpayKeySecret !== '********' ? razorpayKeySecret : undefined,
      defaultTrialDays: parseInt(defaultTrialDays),
    });
  };

  const copyInviteLink = (token: string) => {
    const link = `${window.location.origin}/signup?invite=${token}`;
    navigator.clipboard.writeText(link);
    toast({ title: "Link copied", description: "Invite link copied to clipboard." });
  };

  // Check if user is owner
  if ((user as any)?.role !== 'owner') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You don't have permission to access the admin panel.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/">
              <Button variant="outline" className="w-full">
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back to Calculator
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Settings className="w-8 h-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold" data-testid="text-admin-title">Admin Control Panel</h1>
                <p className="text-sm text-muted-foreground">Manage subscriptions, coupons, and settings</p>
              </div>
            </div>
            <Link href="/">
              <Button variant="outline" data-testid="button-back-calculator">
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back to Calculator
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5 mb-6">
            <TabsTrigger value="subscriptions" data-testid="tab-subscriptions">
              <Users className="w-4 h-4 mr-2" />
              Subscriptions
            </TabsTrigger>
            <TabsTrigger value="plans" data-testid="tab-plans">
              <DollarSign className="w-4 h-4 mr-2" />
              Pricing Plans
            </TabsTrigger>
            <TabsTrigger value="coupons" data-testid="tab-coupons">
              <Tag className="w-4 h-4 mr-2" />
              Coupons
            </TabsTrigger>
            <TabsTrigger value="invites" data-testid="tab-invites">
              <Mail className="w-4 h-4 mr-2" />
              Trial Invites
            </TabsTrigger>
            <TabsTrigger value="settings" data-testid="tab-settings">
              <CreditCard className="w-4 h-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Subscriptions Tab */}
          <TabsContent value="subscriptions">
            <Card>
              <CardHeader>
                <CardTitle>Active Subscriptions</CardTitle>
                <CardDescription>{subscriptions.length} total subscriptions</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User ID</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Billing</TableHead>
                      <TableHead>Expires</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subscriptions.map((sub) => (
                      <TableRow key={sub.id}>
                        <TableCell className="font-mono text-sm">{sub.userId.slice(0, 8)}...</TableCell>
                        <TableCell>{plans.find(p => p.id === sub.planId)?.name || 'N/A'}</TableCell>
                        <TableCell>
                          <Badge variant={sub.status === 'active' ? 'default' : 'secondary'}>{sub.status}</Badge>
                        </TableCell>
                        <TableCell className="capitalize">{sub.billingCycle}</TableCell>
                        <TableCell>{sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : 'N/A'}</TableCell>
                      </TableRow>
                    ))}
                    {subscriptions.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">No subscriptions yet</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pricing Plans Tab */}
          <TabsContent value="plans">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Pricing Plans</CardTitle>
                  <CardDescription>Manage subscription plans and pricing</CardDescription>
                </div>
                <Dialog open={showPlanDialog} onOpenChange={setShowPlanDialog}>
                  <DialogTrigger asChild>
                    <Button onClick={() => { setEditingPlan(null); resetPlanForm(); }} data-testid="button-add-plan">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Plan
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingPlan ? 'Edit Plan' : 'Create Plan'}</DialogTitle>
                      <DialogDescription>Configure subscription plan details</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div>
                        <Label>Plan Name</Label>
                        <Input value={planName} onChange={(e) => setPlanName(e.target.value)} placeholder="e.g., Professional" data-testid="input-plan-name" />
                      </div>
                      <div>
                        <Label>Description</Label>
                        <Input value={planDescription} onChange={(e) => setPlanDescription(e.target.value)} placeholder="Plan description" data-testid="input-plan-description" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Monthly Price (₹)</Label>
                          <Input type="number" value={planPriceMonthly} onChange={(e) => setPlanPriceMonthly(e.target.value)} placeholder="999" data-testid="input-plan-monthly" />
                        </div>
                        <div>
                          <Label>Yearly Price (₹)</Label>
                          <Input type="number" value={planPriceYearly} onChange={(e) => setPlanPriceYearly(e.target.value)} placeholder="9999" data-testid="input-plan-yearly" />
                        </div>
                      </div>
                      <div>
                        <Label>Trial Days</Label>
                        <Input type="number" value={planTrialDays} onChange={(e) => setPlanTrialDays(e.target.value)} placeholder="14" data-testid="input-plan-trial" />
                      </div>
                      <Button onClick={handleSavePlan} className="w-full" disabled={createPlanMutation.isPending || updatePlanMutation.isPending} data-testid="button-save-plan">
                        {editingPlan ? 'Update Plan' : 'Create Plan'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Monthly</TableHead>
                      <TableHead>Yearly</TableHead>
                      <TableHead>Trial Days</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plans.map((plan) => (
                      <TableRow key={plan.id}>
                        <TableCell className="font-medium">{plan.name}</TableCell>
                        <TableCell>₹{plan.priceMonthly}</TableCell>
                        <TableCell>{plan.priceYearly ? `₹${plan.priceYearly}` : '-'}</TableCell>
                        <TableCell>{plan.trialDays} days</TableCell>
                        <TableCell>
                          <Badge variant={plan.isActive ? 'default' : 'secondary'}>{plan.isActive ? 'Active' : 'Inactive'}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="icon" onClick={() => {
                              setEditingPlan(plan);
                              setPlanName(plan.name);
                              setPlanDescription(plan.description || '');
                              setPlanPriceMonthly(plan.priceMonthly.toString());
                              setPlanPriceYearly(plan.priceYearly?.toString() || '');
                              setPlanTrialDays(plan.trialDays?.toString() || '14');
                              setShowPlanDialog(true);
                            }}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => deletePlanMutation.mutate(plan.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {plans.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">No plans created yet</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Coupons Tab */}
          <TabsContent value="coupons">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Coupon Codes</CardTitle>
                  <CardDescription>Manage discount coupons</CardDescription>
                </div>
                <Dialog open={showCouponDialog} onOpenChange={setShowCouponDialog}>
                  <DialogTrigger asChild>
                    <Button onClick={resetCouponForm} data-testid="button-add-coupon">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Coupon
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Coupon</DialogTitle>
                      <DialogDescription>Create a new discount coupon</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div>
                        <Label>Coupon Code</Label>
                        <Input value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} placeholder="e.g., SAVE20" data-testid="input-coupon-code" />
                      </div>
                      <div>
                        <Label>Discount Type</Label>
                        <Select value={couponDiscountType} onValueChange={setCouponDiscountType}>
                          <SelectTrigger data-testid="select-discount-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percentage">Percentage (%)</SelectItem>
                            <SelectItem value="fixed">Fixed Amount (₹)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Discount Value</Label>
                        <Input type="number" value={couponDiscountValue} onChange={(e) => setCouponDiscountValue(e.target.value)} placeholder={couponDiscountType === 'percentage' ? '20' : '500'} data-testid="input-discount-value" />
                      </div>
                      <div>
                        <Label>Max Uses (leave empty for unlimited)</Label>
                        <Input type="number" value={couponMaxUses} onChange={(e) => setCouponMaxUses(e.target.value)} placeholder="100" data-testid="input-max-uses" />
                      </div>
                      <Button onClick={handleSaveCoupon} className="w-full" disabled={createCouponMutation.isPending} data-testid="button-save-coupon">
                        Create Coupon
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Discount</TableHead>
                      <TableHead>Usage</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {coupons.map((coupon) => (
                      <TableRow key={coupon.id}>
                        <TableCell className="font-mono font-bold">{coupon.code}</TableCell>
                        <TableCell>
                          {coupon.discountType === 'percentage' ? `${coupon.discountValue}%` : `₹${coupon.discountValue}`}
                        </TableCell>
                        <TableCell>
                          {coupon.usedCount || 0} / {coupon.maxUses || '∞'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={coupon.isActive ? 'default' : 'secondary'}>{coupon.isActive ? 'Active' : 'Inactive'}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => deleteCouponMutation.mutate(coupon.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {coupons.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">No coupons created yet</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Trial Invites Tab */}
          <TabsContent value="invites">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Trial Invites</CardTitle>
                  <CardDescription>Send trial access invitations</CardDescription>
                </div>
                <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-send-invite">
                      <Mail className="w-4 h-4 mr-2" />
                      Send Invite
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Send Trial Invite</DialogTitle>
                      <DialogDescription>Invite a customer to try the app</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div>
                        <Label>Email Address</Label>
                        <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="customer@example.com" data-testid="input-invite-email" />
                      </div>
                      <div>
                        <Label>Company Name (optional)</Label>
                        <Input value={inviteCompany} onChange={(e) => setInviteCompany(e.target.value)} placeholder="Company Ltd" data-testid="input-invite-company" />
                      </div>
                      <div>
                        <Label>Trial Days</Label>
                        <Input type="number" value={inviteTrialDays} onChange={(e) => setInviteTrialDays(e.target.value)} placeholder="14" data-testid="input-invite-trial" />
                      </div>
                      <Button onClick={handleSendInvite} className="w-full" disabled={createInviteMutation.isPending} data-testid="button-submit-invite">
                        Send Invite
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Trial Days</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sent</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invites.map((invite) => (
                      <TableRow key={invite.id}>
                        <TableCell>{invite.email}</TableCell>
                        <TableCell>{invite.companyName || '-'}</TableCell>
                        <TableCell>{invite.trialDays} days</TableCell>
                        <TableCell>
                          <Badge variant={invite.status === 'accepted' ? 'default' : invite.status === 'pending' ? 'secondary' : 'destructive'}>
                            {invite.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{invite.sentAt ? new Date(invite.sentAt).toLocaleDateString() : '-'}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => copyInviteLink(invite.inviteToken)}>
                            <Copy className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {invites.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">No invites sent yet</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Razorpay Configuration</CardTitle>
                  <CardDescription>Configure payment gateway settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Razorpay Key ID</Label>
                    <Input 
                      value={razorpayKeyId} 
                      onChange={(e) => setRazorpayKeyId(e.target.value)} 
                      placeholder="rzp_live_..." 
                      data-testid="input-razorpay-key" 
                    />
                  </div>
                  <div>
                    <Label>Razorpay Key Secret</Label>
                    <Input 
                      type="password"
                      value={razorpayKeySecret} 
                      onChange={(e) => setRazorpayKeySecret(e.target.value)} 
                      placeholder="Enter new secret to update" 
                      data-testid="input-razorpay-secret" 
                    />
                  </div>
                  <Button onClick={handleSaveSettings} className="w-full" disabled={updateSettingsMutation.isPending} data-testid="button-save-razorpay">
                    Save Razorpay Settings
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>General Settings</CardTitle>
                  <CardDescription>Configure app-wide settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Default Trial Period (days)</Label>
                    <Input 
                      type="number"
                      value={defaultTrialDays} 
                      onChange={(e) => setDefaultTrialDays(e.target.value)} 
                      placeholder="14" 
                      data-testid="input-default-trial" 
                    />
                  </div>
                  <Button onClick={handleSaveSettings} className="w-full" disabled={updateSettingsMutation.isPending} data-testid="button-save-settings">
                    Save Settings
                  </Button>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Recent Transactions</CardTitle>
                  <CardDescription>Payment history</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Transaction ID</TableHead>
                        <TableHead>User ID</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.slice(0, 10).map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell className="font-mono text-sm">{tx.id.slice(0, 8)}...</TableCell>
                          <TableCell className="font-mono text-sm">{tx.userId?.slice(0, 8)}...</TableCell>
                          <TableCell>₹{(tx.amount / 100).toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge variant={tx.status === 'success' ? 'default' : tx.status === 'pending' ? 'secondary' : 'destructive'}>
                              {tx.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : '-'}</TableCell>
                        </TableRow>
                      ))}
                      {transactions.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground">No transactions yet</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
