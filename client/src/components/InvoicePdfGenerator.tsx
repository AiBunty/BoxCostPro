/**
 * Invoice PDF Generator Component
 * Allows users to generate GST-compliant invoice PDFs from quotes
 */

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileText, Download, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface InvoiceTemplate {
  id: string;
  name: string;
  templateKey: string;
  description: string;
  isDefault: boolean;
  status: string;
}

interface InvoicePdfGeneratorProps {
  quoteId: string;
  quoteNumber: string;
  isPdfGenerated?: boolean;
  pdfPath?: string;
}

export function InvoicePdfGenerator({
  quoteId,
  quoteNumber,
  isPdfGenerated = false,
  pdfPath,
}: InvoicePdfGeneratorProps) {
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");

  // Fetch available invoice templates
  const {
    data: templates,
    isLoading: templatesLoading,
  } = useQuery<InvoiceTemplate[]>({
    queryKey: ["/api/invoice-templates"],
  });

  // Generate PDF mutation
  const generatePdf = useMutation({
    mutationFn: async (templateKey?: string) => {
      const response = await fetch(`/api/quotes/${quoteId}/generate-invoice-pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ templateKey }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error || "Failed to generate PDF");
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.alreadyGenerated ? "PDF Already Exists" : "PDF Generated",
        description: data.alreadyGenerated
          ? "Invoice PDF was already generated for this quote"
          : `Invoice PDF generated successfully using ${data.templateUsed}`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "PDF Generation Failed",
        description: error.message,
      });
    },
  });

  // Download PDF function
  const handleDownload = async () => {
    try {
      const response = await fetch(`/api/quotes/${quoteId}/invoice-pdf`, {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to download PDF");
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Invoice_${quoteNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download Started",
        description: `Downloading Invoice_${quoteNumber}.pdf`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Download Failed",
        description: error.message,
      });
    }
  };

  const handleGenerate = () => {
    generatePdf.mutate(selectedTemplate || undefined);
  };

  // Get default template
  const defaultTemplate = templates?.find((t) => t.isDefault);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-lg font-semibold">Invoice PDF</h3>
      </div>

      {isPdfGenerated && pdfPath ? (
        <Alert className="border-green-500/50 bg-green-500/10">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <span className="text-sm">Invoice PDF has been generated</span>
              <Button
                onClick={handleDownload}
                variant="outline"
                size="sm"
                className="ml-4"
              >
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Generate a GST-compliant invoice PDF for this quote. Once generated, the PDF
              cannot be regenerated to ensure invoice immutability.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <label className="text-sm font-medium">Select Invoice Template</label>
            <Select
              value={selectedTemplate}
              onValueChange={setSelectedTemplate}
              disabled={templatesLoading}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    templatesLoading
                      ? "Loading templates..."
                      : defaultTemplate
                      ? `${defaultTemplate.name} (Default)`
                      : "Select a template"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {templates?.map((template) => (
                  <SelectItem key={template.id} value={template.templateKey}>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {template.name}
                        {template.isDefault && " (Default)"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {template.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!selectedTemplate && defaultTemplate && (
              <p className="text-xs text-muted-foreground">
                Leave blank to use the default template: {defaultTemplate.name}
              </p>
            )}
          </div>

          <Button
            onClick={handleGenerate}
            disabled={generatePdf.isPending || templatesLoading}
            className="w-full"
          >
            {generatePdf.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating PDF...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Generate Invoice PDF
              </>
            )}
          </Button>
        </div>
      )}

      {generatePdf.isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {generatePdf.error?.message || "Failed to generate PDF"}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
