import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import EmailConfigurationTab from "@/components/EmailConfigurationTab";
import EmailAnalyticsTab from "@/components/EmailAnalyticsTab";
import type { QuoteTemplate } from "@shared/schema";
import { Mail, MessageSquare, Columns3, Eye, Edit2, Copy, Star, Trash2, Loader2, Check } from "lucide-react";

export default function MasterSettings() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("email");
  const [templateChannel, setTemplateChannel] = useState<"whatsapp" | "email">("whatsapp");
  const [selectedTemplate, setSelectedTemplate] = useState<QuoteTemplate | null>(null);
  const [previewContent, setPreviewContent] = useState<string>("");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [editName, setEditName] = useState("");

  const markQuoteTermsStep = async () => {
    try {
      await apiRequest("POST", "/api/user/setup/update", { stepKey: "quoteTerms" });
      queryClient.invalidateQueries({ queryKey: ["/api/user/setup/status"] });
    } catch (error) {
      console.error("Failed to mark quote terms setup step", error);
    }
  };

  const { data: templates = [], isLoading: templatesLoading } = useQuery<QuoteTemplate[]>({
    queryKey: ["/api/quote-templates", templateChannel],
    queryFn: async () => {
      const res = await fetch(`/api/quote-templates?channel=${templateChannel}`, { credentials: "include" });
      const data = await res.json().catch(() => []);
      return Array.isArray(data) ? data : [];
    }
  });

  const { data: showColumns = {} } = useQuery<Record<string, boolean>>({
    queryKey: ["/api/show-columns"],
  });

  const duplicateTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      return apiRequest("POST", `/api/quote-templates/${templateId}/duplicate`);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quote-templates", templateChannel] });
      await markQuoteTermsStep();
      toast({ title: "Template Duplicated", description: "You can now customize this template." });
    },
    onError: () => toast({ title: "Error", description: "Failed to duplicate template", variant: "destructive" })
  });

  const setDefaultTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      return apiRequest("POST", `/api/quote-templates/${templateId}/set-default`);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quote-templates", templateChannel] });
      await markQuoteTermsStep();
      toast({ title: "Default Set", description: "This template will be used by default." });
    },
    onError: () => toast({ title: "Error", description: "Failed to set default template", variant: "destructive" })
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      return apiRequest("DELETE", `/api/quote-templates/${templateId}`);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quote-templates", templateChannel] });
      await markQuoteTermsStep();
      toast({ title: "Template Deleted" });
    },
    onError: () => toast({ title: "Error", description: "Failed to delete template", variant: "destructive" })
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("PATCH", `/api/quote-templates/${id}`, data);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quote-templates", templateChannel] });
      await markQuoteTermsStep();
      toast({ title: "Template Updated" });
      setIsEditOpen(false);
    },
    onError: () => toast({ title: "Error", description: "Failed to update template", variant: "destructive" })
  });

  const updateShowColumnsMutation = useMutation({
    mutationFn: async (columns: Record<string, boolean>) => {
      return apiRequest("POST", "/api/show-columns", columns);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/show-columns"] });
      await markQuoteTermsStep();
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

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2" data-testid="master-settings-tabs">
          <TabsTrigger value="email" className="gap-2" data-testid="tab-email">
            <Mail className="h-4 w-4" />
            <span className="hidden sm:inline">Email</span>
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2" data-testid="tab-templates">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Templates</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="email" className="mt-6">
          <Tabs defaultValue="config" className="w-full">
            <TabsList className="w-full justify-start mb-4">
              <TabsTrigger value="config" className="gap-2" data-testid="tab-email-config">
                <Mail className="h-4 w-4" />
                Configuration
              </TabsTrigger>
              <TabsTrigger value="analytics" className="gap-2" data-testid="tab-email-analytics">
                <MessageSquare className="h-4 w-4" />
                Analytics
              </TabsTrigger>
            </TabsList>
            <TabsContent value="config">
              <EmailConfigurationTab />
            </TabsContent>
            <TabsContent value="analytics">
              <EmailAnalyticsTab />
            </TabsContent>
          </Tabs>
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

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Preview: {selectedTemplate?.name}
            </DialogTitle>
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
              Available placeholders: {"{{BusinessName}}"}, {"{{PartyName}}"}, {"{{QuoteNo}}"}, {"{{QuoteDate}}"}, {"{{ItemsList}}"}, {"{{Subtotal}}"}, {"{{GST}}"}, {"{{GSTAmount}}"}, {"{{GrandTotal}}"}, {"{{PaymentTerms}}"}, {"{{DeliveryTimeline}}"}
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
