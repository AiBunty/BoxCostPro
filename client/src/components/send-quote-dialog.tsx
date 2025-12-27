import { useState, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import DOMPurify from "dompurify";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, ExternalLink, Copy, Check, Star, AlertTriangle } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { QuoteTemplate } from "@shared/schema";

interface SendQuoteDialogProps {
  quoteId: string;
  partyPhone?: string;
  partyEmail?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function SendQuoteDialog({ quoteId, partyPhone, partyEmail, isOpen, onClose }: SendQuoteDialogProps) {
  const { toast } = useToast();
  const [channel, setChannel] = useState<"whatsapp" | "email">("whatsapp");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [recipientInfo, setRecipientInfo] = useState(channel === "whatsapp" ? partyPhone || "" : partyEmail || "");
  const [previewContent, setPreviewContent] = useState<string>("");
  const [isCopied, setIsCopied] = useState(false);

  const { data: templates = [], isLoading: templatesLoading } = useQuery<QuoteTemplate[]>({
    queryKey: ["/api/quote-templates", channel],
    queryFn: async () => {
      const res = await fetch(`/api/quote-templates?channel=${channel}`, { credentials: "include" });
      return res.json();
    },
    enabled: isOpen
  });

  const { data: bouncedRecipients = [] } = useQuery<string[]>({
    queryKey: ["/api/email-analytics/bounced-recipients"],
    enabled: isOpen && channel === "email"
  });

  const isRecipientBounced = useMemo(() => {
    if (channel !== "email" || !recipientInfo) return false;
    const normalizedInput = recipientInfo.toLowerCase().trim();
    return bouncedRecipients.some(email => email.toLowerCase() === normalizedInput);
  }, [channel, recipientInfo, bouncedRecipients]);

  const previewMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const res = await fetch(`/api/quote-templates/${templateId}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId }),
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to preview");
      return res.json();
    },
    onSuccess: (data) => {
      setPreviewContent(data.rendered);
    },
    onError: () => {
      toast({ title: "Preview Failed", variant: "destructive" });
    }
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/quotes/${quoteId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, templateId: selectedTemplateId, recipientInfo }),
        credentials: "include"
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to send quote");
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      if (channel === "whatsapp" && data.whatsappUrl) {
        window.open(data.whatsappUrl, "_blank");
        toast({ title: "Opening WhatsApp", description: "Quote message is ready to send." });
      } else if (channel === "email") {
        const subject = encodeURIComponent(data.subject || "Quote");
        const body = encodeURIComponent(data.renderedContent.replace(/<[^>]*>/g, ''));
        window.open(`mailto:${recipientInfo}?subject=${subject}&body=${body}`, "_blank");
        toast({ title: "Opening Email", description: "Quote email is ready to send." });
      }
      onClose();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to send quote", variant: "destructive" });
    }
  });

  const handleSelectTemplate = (template: QuoteTemplate) => {
    setSelectedTemplateId(template.id);
    previewMutation.mutate(template.id);
  };

  const handleCopyContent = () => {
    navigator.clipboard.writeText(previewContent);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
    toast({ title: "Copied!", description: "Message copied to clipboard." });
  };

  const handleChannelChange = (newChannel: "whatsapp" | "email") => {
    setChannel(newChannel);
    setSelectedTemplateId(null);
    setPreviewContent("");
    setRecipientInfo(newChannel === "whatsapp" ? partyPhone || "" : partyEmail || "");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {channel === "whatsapp" ? (
              <SiWhatsapp className="h-5 w-5 text-green-600" />
            ) : (
              <Mail className="h-5 w-5 text-blue-600" />
            )}
            Send Quote via {channel === "whatsapp" ? "WhatsApp" : "Email"}
          </DialogTitle>
          <DialogDescription>
            Choose a template and preview before sending
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 mb-4">
          <Button
            variant={channel === "whatsapp" ? "default" : "outline"}
            size="sm"
            onClick={() => handleChannelChange("whatsapp")}
            className="gap-2"
            data-testid="button-channel-whatsapp"
          >
            <SiWhatsapp className="h-4 w-4" />
            WhatsApp
          </Button>
          <Button
            variant={channel === "email" ? "default" : "outline"}
            size="sm"
            onClick={() => handleChannelChange("email")}
            className="gap-2"
            data-testid="button-channel-email"
          >
            <Mail className="h-4 w-4" />
            Email
          </Button>
        </div>

        <div className="space-y-4 flex-1 overflow-hidden">
          <div>
            <Label>{channel === "whatsapp" ? "Phone Number" : "Email Address"}</Label>
            <div className="relative">
              <Input
                value={recipientInfo}
                onChange={(e) => setRecipientInfo(e.target.value)}
                placeholder={channel === "whatsapp" ? "+91 98765 43210" : "customer@example.com"}
                className={isRecipientBounced ? "pr-10 border-orange-500" : ""}
                data-testid="input-recipient"
              />
              {isRecipientBounced && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>This email has bounced before</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            {isRecipientBounced && (
              <Alert variant="destructive" className="mt-2 py-2 border-orange-200 bg-orange-50 dark:bg-orange-950/20">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                <AlertDescription className="text-sm text-orange-700 dark:text-orange-400">
                  This email address has bounced previously. Consider verifying the address or using an alternative.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <div>
            <Label className="mb-2 block">Select Template</Label>
            {templatesLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {templates.map((template) => (
                  <Button
                    key={template.id}
                    variant={selectedTemplateId === template.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleSelectTemplate(template)}
                    className="gap-1"
                    data-testid={`button-template-${template.id}`}
                  >
                    {template.isDefault && <Star className="h-3 w-3" />}
                    {template.name}
                    {template.templateType === "system" && (
                      <Badge variant="secondary" className="ml-1 text-xs">System</Badge>
                    )}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {previewMutation.isPending && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}

          {previewContent && (
            <div className="flex-1 min-h-0">
              <div className="flex items-center justify-between mb-2">
                <Label>Preview</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyContent}
                  className="gap-1 h-7"
                  data-testid="button-copy-content"
                >
                  {isCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {isCopied ? "Copied" : "Copy"}
                </Button>
              </div>
              <ScrollArea className="h-[200px] border rounded-lg p-3 bg-muted/30">
                {channel === "email" ? (
                  <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewContent) }} className="text-sm" />
                ) : (
                  <pre className="whitespace-pre-wrap text-sm font-sans">{previewContent}</pre>
                )}
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => sendMutation.mutate()}
            disabled={!selectedTemplateId || !recipientInfo || sendMutation.isPending}
            className="gap-2"
            data-testid="button-send-quote"
          >
            {sendMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ExternalLink className="h-4 w-4" />
            )}
            {channel === "whatsapp" ? "Open WhatsApp" : "Send Email"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
