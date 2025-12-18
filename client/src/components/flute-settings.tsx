import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface FluteSetting {
  id?: string;
  fluteType: string;
  flutingFactor: number;
  fluteHeightMm: number;
}

const FLUTE_TYPES = [
  { type: 'A', name: 'A Flute', description: 'Largest flute, best cushioning' },
  { type: 'B', name: 'B Flute', description: 'Medium size, good printability' },
  { type: 'C', name: 'C Flute', description: 'Most common, balanced performance' },
  { type: 'E', name: 'E Flute', description: 'Thin, excellent printing surface' },
  { type: 'F', name: 'F Flute', description: 'Micro flute, superior printability' },
];

const DEFAULT_FLUTE_VALUES: Record<string, { factor: number; height: number }> = {
  A: { factor: 1.54, height: 4.8 },
  B: { factor: 1.35, height: 2.5 },
  C: { factor: 1.43, height: 3.6 },
  E: { factor: 1.27, height: 1.2 },
  F: { factor: 1.25, height: 0.8 },
};

export default function FluteSettings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Record<string, FluteSetting>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const { data: existingSettings, isLoading } = useQuery<FluteSetting[]>({
    queryKey: ['/api/flute-settings'],
  });

  useEffect(() => {
    if (existingSettings) {
      const settingsMap: Record<string, FluteSetting> = {};
      
      FLUTE_TYPES.forEach(({ type }) => {
        const existing = existingSettings.find(s => s.fluteType === type);
        if (existing) {
          settingsMap[type] = existing;
        } else {
          settingsMap[type] = {
            fluteType: type,
            flutingFactor: DEFAULT_FLUTE_VALUES[type].factor,
            fluteHeightMm: DEFAULT_FLUTE_VALUES[type].height,
          };
        }
      });
      
      setSettings(settingsMap);
    }
  }, [existingSettings]);

  const saveMutation = useMutation({
    mutationFn: async (settingsToSave: FluteSetting[]) => {
      return await apiRequest('POST', '/api/flute-settings', { settings: settingsToSave });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/flute-settings'] });
      setHasChanges(false);
      toast({
        title: "Settings Saved",
        description: "Flute settings have been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save flute settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleValueChange = (fluteType: string, field: 'flutingFactor' | 'fluteHeightMm', value: string) => {
    const numValue = parseFloat(value) || 0;
    setSettings(prev => ({
      ...prev,
      [fluteType]: {
        ...prev[fluteType],
        [field]: numValue,
      },
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    const settingsArray = Object.values(settings);
    
    const isValid = settingsArray.every(s => 
      s.flutingFactor > 0 && s.fluteHeightMm > 0
    );
    
    if (!isValid) {
      toast({
        title: "Validation Error",
        description: "All fluting factors and heights must be greater than 0.",
        variant: "destructive",
      });
      return;
    }
    
    saveMutation.mutate(settingsArray);
  };

  const handleReset = () => {
    const resetSettings: Record<string, FluteSetting> = {};
    FLUTE_TYPES.forEach(({ type }) => {
      resetSettings[type] = {
        fluteType: type,
        flutingFactor: DEFAULT_FLUTE_VALUES[type].factor,
        fluteHeightMm: DEFAULT_FLUTE_VALUES[type].height,
      };
    });
    setSettings(resetSettings);
    setHasChanges(true);
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
          Flute settings are global technical constants used in every box costing calculation. 
          Changes here will apply to <strong>new quotes only</strong> – existing quotes preserve their original values.
        </AlertDescription>
      </Alert>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Flute Configuration</CardTitle>
          <CardDescription>
            Set the fluting factor (paper weight multiplier) and flute height (mm) for each flute type
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="grid gap-4">
              <div className="grid grid-cols-12 gap-4 text-sm font-medium text-muted-foreground border-b pb-2">
                <div className="col-span-3">Flute Type</div>
                <div className="col-span-4">Fluting Factor</div>
                <div className="col-span-4">Flute Height (mm)</div>
              </div>
              
              {FLUTE_TYPES.map(({ type, name, description }) => (
                <div key={type} className="grid grid-cols-12 gap-4 items-center">
                  <div className="col-span-3">
                    <div className="font-medium">{name}</div>
                    <div className="text-xs text-muted-foreground">{description}</div>
                  </div>
                  <div className="col-span-4">
                    <Input
                      type="number"
                      step="0.01"
                      min="1"
                      max="3"
                      value={settings[type]?.flutingFactor || ''}
                      onChange={(e) => handleValueChange(type, 'flutingFactor', e.target.value)}
                      data-testid={`input-fluting-factor-${type}`}
                      className="w-full"
                    />
                  </div>
                  <div className="col-span-4">
                    <Input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="10"
                      value={settings[type]?.fluteHeightMm || ''}
                      onChange={(e) => handleValueChange(type, 'fluteHeightMm', e.target.value)}
                      data-testid={`input-flute-height-${type}`}
                      className="w-full"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <Button
                variant="outline"
                onClick={handleReset}
                data-testid="button-reset-defaults"
              >
                Reset to Defaults
              </Button>
              <Button
                onClick={handleSave}
                disabled={!hasChanges || saveMutation.isPending}
                data-testid="button-save-flute-settings"
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

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">How Board Thickness is Calculated</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              Board thickness is automatically calculated as the <strong>sum of flute heights</strong> for the selected flute combination.
            </p>
            <div className="bg-muted/50 rounded-md p-3 mt-3">
              <div className="font-medium mb-2">Examples:</div>
              <ul className="space-y-1">
                <li>• B Flute → {settings['B']?.fluteHeightMm || 2.5} mm</li>
                <li>• BC Flute → {(settings['B']?.fluteHeightMm || 2.5) + (settings['C']?.fluteHeightMm || 3.6)} mm (B + C)</li>
                <li>• ABC Flute → {(settings['A']?.fluteHeightMm || 4.8) + (settings['B']?.fluteHeightMm || 2.5) + (settings['C']?.fluteHeightMm || 3.6)} mm (A + B + C)</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
