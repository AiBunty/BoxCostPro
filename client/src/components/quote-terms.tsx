import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Save, FileCheck } from "lucide-react";

export default function QuoteTerms() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [paymentTerms, setPaymentTerms] = useState("Payment due within 30 days of invoice date.");
  const [deliveryTerms, setDeliveryTerms] = useState("Delivery within 7-10 business days from order confirmation.");
  const [otherTerms, setOtherTerms] = useState("All prices are subject to change without notice. Goods once sold will not be taken back.");

  const saveTermsMutation = useMutation({
    mutationFn: async () => {
      // Save to backend (you can add an API endpoint if you want to persist these)
      // For now, just mark the setup step as complete
      await apiRequest("POST", "/api/user/setup/update", { stepKey: "quoteTerms" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/setup/status"] });
      toast({
        title: "Quote Terms Saved",
        description: "Your default quote terms have been configured.",
      });
      
      // Redirect back to onboarding
      navigate("/onboarding");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to save quote terms",
        variant: "destructive",
      });
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveTermsMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-primary" />
            <CardTitle>Default Quote Terms & Conditions</CardTitle>
          </div>
          <CardDescription>
            Configure default terms that will appear on all your quotes and invoices.
            You can customize these for individual quotes later.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="paymentTerms">Payment Terms</Label>
              <Textarea
                id="paymentTerms"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                placeholder="Enter payment terms (e.g., Payment due within 30 days)"
                rows={3}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Standard payment terms for your customers
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deliveryTerms">Delivery Terms</Label>
              <Textarea
                id="deliveryTerms"
                value={deliveryTerms}
                onChange={(e) => setDeliveryTerms(e.target.value)}
                placeholder="Enter delivery terms (e.g., Delivery within 7-10 business days)"
                rows={3}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Expected delivery timeline and conditions
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="otherTerms">Other Terms & Conditions</Label>
              <Textarea
                id="otherTerms"
                value={otherTerms}
                onChange={(e) => setOtherTerms(e.target.value)}
                placeholder="Enter any other terms and conditions"
                rows={5}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Additional terms, warranties, return policies, etc.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/onboarding")}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saveTermsMutation.isPending}
              >
                <Save className="mr-2 h-4 w-4" />
                {saveTermsMutation.isPending ? "Saving..." : "Save Quote Terms"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Preview</CardTitle>
          <CardDescription>
            How these terms will appear on your quotes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <h4 className="font-semibold mb-1">Payment Terms:</h4>
            <p className="text-muted-foreground">{paymentTerms || "Not set"}</p>
          </div>
          <div>
            <h4 className="font-semibold mb-1">Delivery Terms:</h4>
            <p className="text-muted-foreground">{deliveryTerms || "Not set"}</p>
          </div>
          <div>
            <h4 className="font-semibold mb-1">Other Terms:</h4>
            <p className="text-muted-foreground whitespace-pre-wrap">{otherTerms || "Not set"}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
