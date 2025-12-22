import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, User, Building2, ImageIcon, Upload, Loader2, Save, MessageSquare, Mail, Copy, Star, Trash2, Eye, Edit2, Check, Columns3 } from "lucide-react";
import { Link } from "wouter";
import type { User as UserType, CompanyProfile, QuoteTemplate } from "@shared/schema";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function Settings() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("personal");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [templateChannel, setTemplateChannel] = useState<"whatsapp" | "email">("whatsapp");
  const [selectedTemplate, setSelectedTemplate] = useState<QuoteTemplate | null>(null);
  const [previewContent, setPreviewContent] = useState<string>("");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [editName, setEditName] = useState("");

  const { data: user, isLoading: userLoading } = useQuery<UserType>({
    queryKey: ["/api/auth/user"],
  });

  const { data: companyProfiles = [], isLoading: profilesLoading } = useQuery<CompanyProfile[]>({
    queryKey: ["/api/company-profiles"],
  });
  
  const { data: templates = [], isLoading: templatesLoading } = useQuery<QuoteTemplate[]>({
    queryKey: ["/api/quote-templates", templateChannel],
    queryFn: async () => {
      const res = await fetch(`/api/quote-templates?channel=${templateChannel}`, {
        credentials: "include"
      });
      return res.json();
    }
  });
  
  const { data: showColumns = {} } = useQuery<Record<string, boolean>>({
    queryKey: ["/api/show-columns"],
  });

  const defaultProfile = companyProfiles.find(p => p.isDefault) || companyProfiles[0];

  const personalForm = useForm({
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      mobileNo: "",
    },
  });

  const businessForm = useForm({
    defaultValues: {
      companyName: "",
      address: "",
      phone: "",
      email: "",
      gstNo: "",
    },
  });

  useEffect(() => {
    if (user) {
      personalForm.reset({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        mobileNo: user.mobileNo || "",
      });
    }
  }, [user]);

  useEffect(() => {
    if (defaultProfile) {
      businessForm.reset({
        companyName: defaultProfile.companyName || "",
        address: defaultProfile.address || "",
        phone: defaultProfile.phone || "",
        email: defaultProfile.email || "",
        gstNo: defaultProfile.gstNo || "",
      });
      if (defaultProfile.logoUrl) {
        setLogoPreview(defaultProfile.logoUrl);
      }
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
      toast({
        title: "Settings Saved",
        description: "Your business details have been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
    },
  });

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file size (max 500KB for database storage)
      if (file.size > 500 * 1024) {
        toast({
          title: "File Too Large",
          description: "Logo must be less than 500KB for optimal performance",
          variant: "destructive",
        });
        return;
      }
      
      // Validate file type
      const allowedTypes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Invalid File Type",
          description: "Please upload a PNG, JPG, SVG, or WebP image",
          variant: "destructive",
        });
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setLogoPreview(base64);
      };
      reader.onerror = () => {
        toast({
          title: "Upload Failed",
          description: "Failed to read the file",
          variant: "destructive",
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBusinessSave = (data: any) => {
    updateProfileMutation.mutate({
      ...data,
      logoUrl: logoPreview,
    });
  };
  
  // Template mutations
  const duplicateTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      return apiRequest("POST", `/api/quote-templates/${templateId}/duplicate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quote-templates", templateChannel] });
      toast({ title: "Template Duplicated", description: "You can now customize this template." });
    },
    onError: () => toast({ title: "Error", description: "Failed to duplicate template", variant: "destructive" })
  });
  
  const setDefaultTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      return apiRequest("POST", `/api/quote-templates/${templateId}/set-default`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quote-templates", templateChannel] });
      toast({ title: "Default Set", description: "This template will be used by default." });
    },
    onError: () => toast({ title: "Error", description: "Failed to set default template", variant: "destructive" })
  });
  
  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      return apiRequest("DELETE", `/api/quote-templates/${templateId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quote-templates", templateChannel] });
      toast({ title: "Template Deleted" });
    },
    onError: () => toast({ title: "Error", description: "Failed to delete template", variant: "destructive" })
  });
  
  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("PATCH", `/api/quote-templates/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quote-templates", templateChannel] });
      toast({ title: "Template Updated" });
      setIsEditOpen(false);
    },
    onError: () => toast({ title: "Error", description: "Failed to update template", variant: "destructive" })
  });
  
  const updateShowColumnsMutation = useMutation({
    mutationFn: async (columns: Record<string, boolean>) => {
      return apiRequest("POST", "/api/show-columns", columns);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/show-columns"] });
      toast({ title: "Columns Updated" });
    },
    onError: () => toast({ title: "Error", description: "Failed to update columns", variant: "destructive" })
  });
  
  const handlePreviewTemplate = (template: QuoteTemplate) => {
    setSelectedTemplate(template);
    setPreviewContent(template.content);
    setIsPreviewOpen(true);
  };
  
  const handleEditTemplate = (template: QuoteTemplate) => {
    if (template.templateType === 'system') {
      toast({ title: "Cannot Edit System Templates", description: "Duplicate this template to customize it.", variant: "destructive" });
      return;
    }
    setSelectedTemplate(template);
    setEditName(template.name);
    setEditContent(template.content);
    setIsEditOpen(true);
  };
  
  const handleSaveEdit = () => {
    if (selectedTemplate) {
      updateTemplateMutation.mutate({ id: selectedTemplate.id, data: { name: editName, content: editContent } });
    }
  };

  if (userLoading || profilesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">Settings</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4" data-testid="settings-tabs">
            <TabsTrigger value="personal" className="gap-2" data-testid="tab-personal">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Personal</span>
            </TabsTrigger>
            <TabsTrigger value="business" className="gap-2" data-testid="tab-business">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Business</span>
            </TabsTrigger>
            <TabsTrigger value="branding" className="gap-2" data-testid="tab-branding">
              <ImageIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Branding</span>
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-2" data-testid="tab-templates">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Templates</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="personal" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Personal Details</CardTitle>
                <CardDescription>Your account information</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...personalForm}>
                  <form className="space-y-4">
                    <div className="flex items-center gap-4 mb-6">
                      <Avatar className="h-20 w-20">
                        <AvatarImage src={user?.profileImageUrl || ""} />
                        <AvatarFallback className="text-xl">
                          {user?.firstName?.[0] || user?.email?.[0] || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{user?.firstName} {user?.lastName}</p>
                        <p className="text-sm text-muted-foreground">{user?.email}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          Account type: {user?.authProvider || "google"}
                        </p>
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <FormField
                        control={personalForm.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name</FormLabel>
                            <FormControl>
                              <Input {...field} disabled data-testid="input-first-name" />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={personalForm.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last Name</FormLabel>
                            <FormControl>
                              <Input {...field} disabled data-testid="input-last-name" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={personalForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input {...field} disabled data-testid="input-email" />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={personalForm.control}
                      name="mobileNo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Mobile Number</FormLabel>
                          <FormControl>
                            <Input {...field} disabled data-testid="input-mobile" />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <p className="text-sm text-muted-foreground">
                      Personal details are managed through your authentication provider.
                    </p>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="business" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Business Details</CardTitle>
                <CardDescription>Your company information for quotes</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...businessForm}>
                  <form onSubmit={businessForm.handleSubmit(handleBusinessSave)} className="space-y-4">
                    <FormField
                      control={businessForm.control}
                      name="companyName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Ventura Packagers Pvt. Ltd." {...field} data-testid="input-company-name" />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={businessForm.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address</FormLabel>
                          <FormControl>
                            <Input placeholder="Full business address" {...field} data-testid="input-address" />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <div className="grid sm:grid-cols-2 gap-4">
                      <FormField
                        control={businessForm.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone</FormLabel>
                            <FormControl>
                              <Input placeholder="+91 98765 43210" {...field} data-testid="input-phone" />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={businessForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Business Email</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="sales@company.com" {...field} data-testid="input-business-email" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={businessForm.control}
                      name="gstNo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>GST Number</FormLabel>
                          <FormControl>
                            <Input placeholder="22AAAAA0000A1Z5" {...field} data-testid="input-gst" />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <Button 
                      type="submit" 
                      className="gap-2"
                      disabled={updateProfileMutation.isPending}
                      data-testid="button-save-business"
                    >
                      {updateProfileMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Save Changes
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="branding" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Company Branding</CardTitle>
                <CardDescription>Upload your logo for quotes and messages</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    {logoPreview ? (
                      <div className="w-32 h-32 rounded-lg border-2 border-dashed border-primary/50 overflow-hidden bg-muted">
                        <img 
                          src={logoPreview} 
                          alt="Company Logo" 
                          className="w-full h-full object-contain"
                          data-testid="img-logo-preview"
                        />
                      </div>
                    ) : (
                      <div className="w-32 h-32 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center bg-muted">
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml"
                    onChange={handleLogoUpload}
                    className="hidden"
                    data-testid="input-logo-file"
                  />

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="gap-2"
                      data-testid="button-upload-logo"
                    >
                      <Upload className="h-4 w-4" />
                      Upload Logo
                    </Button>
                    {logoPreview && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setLogoPreview(null)}
                        data-testid="button-remove-logo"
                      >
                        Remove
                      </Button>
                    )}
                  </div>

                  <p className="text-sm text-muted-foreground text-center">
                    PNG, JPG, SVG, or WebP. Max 500KB. Recommended: 200x200px
                  </p>
                </div>

                <Button 
                  onClick={() => handleBusinessSave(businessForm.getValues())}
                  className="w-full gap-2"
                  disabled={updateProfileMutation.isPending}
                  data-testid="button-save-branding"
                >
                  {updateProfileMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save Branding
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="templates" className="mt-6 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Columns3 className="h-5 w-5" />
                  Quote Display Columns
                </CardTitle>
                <CardDescription>
                  Choose which columns to show in WhatsApp, Email, and PDF outputs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { key: 'boxSize', label: 'Box Size' },
                    { key: 'board', label: 'Board Type' },
                    { key: 'flute', label: 'Flute' },
                    { key: 'paper', label: 'Paper Details' },
                    { key: 'printing', label: 'Printing' },
                    { key: 'lamination', label: 'Lamination' },
                    { key: 'varnish', label: 'Varnish' },
                    { key: 'weight', label: 'Weight' },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between gap-2 p-2 rounded border">
                      <Label htmlFor={`col-${key}`} className="text-sm">{label}</Label>
                      <Switch
                        id={`col-${key}`}
                        checked={(showColumns as Record<string, boolean>)[key] ?? true}
                        onCheckedChange={(checked) => {
                          updateShowColumnsMutation.mutate({ ...showColumns, [key]: checked });
                        }}
                        data-testid={`switch-column-${key}`}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <CardTitle>Message Templates</CardTitle>
                    <CardDescription>Customize templates for sharing quotes</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant={templateChannel === 'whatsapp' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTemplateChannel('whatsapp')}
                      className="gap-2"
                      data-testid="button-channel-whatsapp"
                    >
                      <MessageSquare className="h-4 w-4" />
                      WhatsApp
                    </Button>
                    <Button
                      variant={templateChannel === 'email' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTemplateChannel('email')}
                      className="gap-2"
                      data-testid="button-channel-email"
                    >
                      <Mail className="h-4 w-4" />
                      Email
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {templatesLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : templates.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No templates found</p>
                ) : (
                  <div className="space-y-3">
                    {templates.map((template) => (
                      <div
                        key={template.id}
                        className="flex items-center justify-between gap-4 p-4 border rounded-lg"
                        data-testid={`template-card-${template.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium truncate">{template.name}</p>
                            {template.templateType === 'system' && (
                              <Badge variant="secondary" className="text-xs">System</Badge>
                            )}
                            {template.isDefault && (
                              <Badge className="text-xs gap-1">
                                <Star className="h-3 w-3" />
                                Default
                              </Badge>
                            )}
                          </div>
                          {template.description && (
                            <p className="text-sm text-muted-foreground truncate">{template.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handlePreviewTemplate(template)}
                            data-testid={`button-preview-${template.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {template.templateType === 'custom' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditTemplate(template)}
                              data-testid={`button-edit-${template.id}`}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => duplicateTemplateMutation.mutate(template.id)}
                            disabled={duplicateTemplateMutation.isPending}
                            data-testid={`button-duplicate-${template.id}`}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          {!template.isDefault && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDefaultTemplateMutation.mutate(template.id)}
                              disabled={setDefaultTemplateMutation.isPending}
                              data-testid={`button-set-default-${template.id}`}
                            >
                              <Star className="h-4 w-4" />
                            </Button>
                          )}
                          {template.templateType === 'custom' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteTemplateMutation.mutate(template.id)}
                              disabled={deleteTemplateMutation.isPending}
                              className="text-destructive hover:text-destructive"
                              data-testid={`button-delete-${template.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
      
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Preview: {selectedTemplate?.name}
            </DialogTitle>
            <DialogDescription>
              This is the raw template content with placeholders
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 border rounded-lg p-4 bg-muted/50">
            <pre className="whitespace-pre-wrap text-sm font-mono">
              {previewContent}
            </pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5" />
              Edit Template
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            <div>
              <Label htmlFor="edit-name">Template Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                data-testid="input-edit-template-name"
              />
            </div>
            <div className="flex-1 min-h-0">
              <Label htmlFor="edit-content">Content</Label>
              <Textarea
                id="edit-content"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="h-[300px] font-mono text-sm"
                data-testid="textarea-edit-template-content"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Available placeholders: {`{{BusinessName}}, {{PartyName}}, {{QuoteNo}}, {{QuoteDate}}, {{ItemsList}}, {{Subtotal}}, {{GST}}, {{GSTAmount}}, {{GrandTotal}}, {{PaymentTerms}}, {{DeliveryTimeline}}`}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleSaveEdit}
              disabled={updateTemplateMutation.isPending}
              className="gap-2"
              data-testid="button-save-template"
            >
              {updateTemplateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Save Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
