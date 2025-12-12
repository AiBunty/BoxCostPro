import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Settings, ArrowRight, Check, Info } from "lucide-react";
import type { FlutingSetting } from "@shared/schema";

const DEFAULT_FLUTING_FACTORS: Record<string, { factor: number; height: number; description: string }> = {
  'A': { factor: 1.55, height: 4.8, description: 'A Flute - Largest flute, best cushioning' },
  'B': { factor: 1.35, height: 2.5, description: 'B Flute - Medium, good printing surface' },
  'C': { factor: 1.45, height: 3.6, description: 'C Flute - Most common, good balance' },
  'E': { factor: 1.25, height: 1.2, description: 'E Flute - Small, excellent print quality' },
  'F': { factor: 1.20, height: 0.8, description: 'F Flute - Micro, thin packaging' },
};

interface FlutingOnboardingProps {
  onComplete: () => void;
}

export function FlutingOnboarding({ onComplete }: FlutingOnboardingProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'intro' | 'configure'>('intro');
  const [localSettings, setLocalSettings] = useState<Record<string, { factor: string; height: string }>>({
    'A': { factor: '1.55', height: '4.8' },
    'B': { factor: '1.35', height: '2.5' },
    'C': { factor: '1.45', height: '3.6' },
    'E': { factor: '1.25', height: '1.2' },
    'F': { factor: '1.20', height: '0.8' },
  });
  const [isSaving, setIsSaving] = useState(false);
  const [settingsInitialized, setSettingsInitialized] = useState(false);

  const { data: status, isLoading: isLoadingStatus } = useQuery<{ configured: boolean; missingTypes: string[] }>({
    queryKey: ['/api/fluting-settings/status'],
  });

  const { data: existingSettings = [], isLoading: isLoadingSettings } = useQuery<FlutingSetting[]>({
    queryKey: ['/api/fluting-settings'],
  });

  useEffect(() => {
    if (!isLoadingStatus && status && !status.configured) {
      setOpen(true);
    }
  }, [status, isLoadingStatus]);

  useEffect(() => {
    if (!isLoadingSettings && existingSettings.length > 0 && !settingsInitialized) {
      const newSettings = { ...localSettings };
      existingSettings.forEach(setting => {
        newSettings[setting.fluteType] = {
          factor: setting.flutingFactor.toString(),
          height: setting.fluteHeight?.toString() || DEFAULT_FLUTING_FACTORS[setting.fluteType]?.height.toString() || '0',
        };
      });
      setLocalSettings(newSettings);
      setSettingsInitialized(true);
    }
  }, [existingSettings, isLoadingSettings, settingsInitialized]);

  const saveAllSettings = async () => {
    setIsSaving(true);
    const errors: string[] = [];
    const savedTypes: string[] = [];
    
    try {
      for (const [fluteType, values] of Object.entries(localSettings)) {
        try {
          const factor = parseFloat(values.factor);
          const height = parseFloat(values.height);
          
          if (isNaN(factor) || factor <= 0) {
            errors.push(`${fluteType}: Invalid fluting factor`);
            continue;
          }
          
          await apiRequest('POST', '/api/fluting-settings', {
            fluteType,
            flutingFactor: factor,
            fluteHeight: isNaN(height) ? DEFAULT_FLUTING_FACTORS[fluteType].height : height,
          });
          savedTypes.push(fluteType);
        } catch (err) {
          errors.push(`${fluteType}: Failed to save`);
        }
      }
      
      await queryClient.invalidateQueries({ queryKey: ['/api/fluting-settings'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/fluting-settings/status'] });
      
      const requiredTypes = ['A', 'B', 'C', 'E', 'F'];
      const allSaved = requiredTypes.every(t => savedTypes.includes(t));
      
      if (allSaved) {
        toast({ 
          title: "Machine settings saved", 
          description: "Your corrugator machine fluting factors have been configured successfully." 
        });
        setOpen(false);
        onComplete();
      } else if (errors.length > 0) {
        toast({ 
          title: "Partial save", 
          description: `Some settings failed: ${errors.join(', ')}. Please try again.`,
          variant: "destructive" 
        });
      }
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "Failed to save settings. Please try again.", 
        variant: "destructive" 
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingStatus || status?.configured) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen && !status?.configured) {
        toast({ 
          title: "Setup Required", 
          description: "Please complete the fluting factor setup before using the calculator.",
          variant: "destructive"
        });
        return;
      }
      setOpen(newOpen);
    }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" onPointerDownOutside={(e) => e.preventDefault()}>
        {step === 'intro' ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Settings className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-2xl">Welcome! Let's Set Up Your Machine</DialogTitle>
                  <DialogDescription className="text-base mt-1">
                    Configure your corrugator machine's fluting factors for accurate calculations
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            
            <div className="space-y-6 mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Info className="w-5 h-5 text-blue-500" />
                    Why Configure Fluting Factors?
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    Every corrugator machine has unique characteristics that affect the fluting factor - 
                    the ratio of paper consumed to create the corrugated medium.
                  </p>
                  <p>
                    <strong>What is Fluting Factor?</strong> It's the multiplier applied to calculate 
                    how much paper is used in fluted layers. A factor of 1.35 means 35% more paper 
                    is consumed due to the corrugation process.
                  </p>
                  <p>
                    <strong>Why it matters:</strong> Accurate fluting factors ensure your cost 
                    calculations match actual material consumption, leading to precise quotations.
                  </p>
                </CardContent>
              </Card>

              <div className="grid grid-cols-5 gap-2">
                {Object.entries(DEFAULT_FLUTING_FACTORS).map(([type, info]) => (
                  <Card key={type} className="text-center">
                    <CardContent className="pt-4 pb-3">
                      <div className="text-2xl font-bold text-primary">{type}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Default: {info.factor}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Button onClick={() => setStep('configure')} className="w-full" size="lg" data-testid="button-start-setup">
                Configure My Machine
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Configure Your Machine's Fluting Factors</DialogTitle>
              <DialogDescription>
                Enter the fluting factors specific to your corrugator machine. If unsure, use the default values.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 mt-4">
              <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg text-sm">
                <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />
                <span>
                  <strong>Tip:</strong> Check your machine specifications or consult your corrugator 
                  supplier for exact fluting factors. These values affect cost calculations.
                </span>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Flute</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-32">Fluting Factor</TableHead>
                    <TableHead className="w-32">Height (mm)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(DEFAULT_FLUTING_FACTORS).map(([type, defaults]) => (
                    <TableRow key={type}>
                      <TableCell>
                        <Badge variant="outline" className="text-lg font-bold">{type}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{defaults.description}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={localSettings[type]?.factor || defaults.factor}
                          onChange={(e) => setLocalSettings(prev => ({
                            ...prev,
                            [type]: { ...prev[type], factor: e.target.value }
                          }))}
                          data-testid={`input-onboard-factor-${type}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.1"
                          value={localSettings[type]?.height || defaults.height}
                          onChange={(e) => setLocalSettings(prev => ({
                            ...prev,
                            [type]: { ...prev[type], height: e.target.value }
                          }))}
                          data-testid={`input-onboard-height-${type}`}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep('intro')} className="flex-1">
                  Back
                </Button>
                <Button onClick={saveAllSettings} className="flex-1" disabled={isSaving} data-testid="button-complete-setup">
                  {isSaving ? (
                    "Saving..."
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Complete Setup
                    </>
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
