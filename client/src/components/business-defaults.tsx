import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface BusinessDefaults {
  id?: string;
  userId?: string;
  defaultGstPercent: number;
  gstRegistered: boolean;
  gstNumber: string | null;
  igstApplicable: boolean;
  roundOffEnabled: boolean;
}

export default function BusinessDefaultsSettings() {
  const { toast } = useToast();
  const [formData, setFormData] = useState<BusinessDefaults>({
    defaultGstPercent: 5,
    gstRegistered: true,
    gstNumber: null,
    igstApplicable: false,
    roundOffEnabled: true,
  });
  const [hasChanges, setHasChanges] = useState(false);

  const markTaxDefaultsStep = async () => {
    try {
      await apiRequest('POST', '/api/user/setup/update', { stepKey: 'taxDefaults' });
      queryClient.invalidateQueries({ queryKey: ['/api/user/setup/status'] });
    } catch (error) {
      console.error('Failed to mark tax defaults setup step', error);
    }
  };

  const { data: existingDefaults, isLoading } = useQuery<BusinessDefaults>({
    queryKey: ['/api/business-defaults'],
  });

  useEffect(() => {
    if (existingDefaults) {
      setFormData(existingDefaults);
    }
  }, [existingDefaults]);

  const saveMutation = useMutation({
    mutationFn: async (data: BusinessDefaults) => {
      return await apiRequest('POST', '/api/business-defaults', data);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['/api/business-defaults'] });
      await markTaxDefaultsStep();
      setHasChanges(false);
      toast({
        title: "Settings Saved",
        description: "Business defaults have been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleChange = (field: keyof BusinessDefaults, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    if (formData.defaultGstPercent < 0 || formData.defaultGstPercent > 100) {
      toast({
        title: "Validation Error",
        description: "GST percentage must be between 0 and 100.",
        variant: "destructive",
      });
      return;
    }
    
    saveMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          These are the default tax settings used when creating new quotes. 
          The GST percentage is snapshotted at quote creation and will not change for saved quotes.
        </AlertDescription>
      </Alert>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>GST Settings</CardTitle>
          <CardDescription>
            Configure your default GST rate and registration details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="space-y-2 max-w-md">
              <Label htmlFor="gstPercent">Default GST Rate (%)</Label>
              <Input
                id="gstPercent"
                type="number"
                step="0.5"
                min="0"
                max="100"
                value={formData.defaultGstPercent}
                onChange={(e) => handleChange('defaultGstPercent', parseFloat(e.target.value) || 0)}
                data-testid="input-gst-percent"
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                This rate will be applied to all new quotes. GST Number is managed in Business Profile.
              </p>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="gstRegistered">GST Registered</Label>
                  <p className="text-xs text-muted-foreground">
                    Your business is registered under GST
                  </p>
                </div>
                <Switch
                  id="gstRegistered"
                  checked={formData.gstRegistered}
                  onCheckedChange={(checked) => handleChange('gstRegistered', checked)}
                  data-testid="switch-gst-registered"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="igstApplicable">IGST Applicable</Label>
                  <p className="text-xs text-muted-foreground">
                    Apply IGST for inter-state transactions
                  </p>
                </div>
                <Switch
                  id="igstApplicable"
                  checked={formData.igstApplicable}
                  onCheckedChange={(checked) => handleChange('igstApplicable', checked)}
                  data-testid="switch-igst-applicable"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="roundOffEnabled">Round Off Totals</Label>
                  <p className="text-xs text-muted-foreground">
                    Round grand total to nearest rupee for cleaner invoices
                  </p>
                </div>
                <Switch
                  id="roundOffEnabled"
                  checked={formData.roundOffEnabled}
                  onCheckedChange={(checked) => handleChange('roundOffEnabled', checked)}
                  data-testid="switch-round-off-enabled"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button
                onClick={handleSave}
                disabled={!hasChanges || saveMutation.isPending}
                data-testid="button-save-business-defaults"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Settings
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
