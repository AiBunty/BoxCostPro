import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Settings, Save } from "lucide-react";
import type { FlutingSetting } from "@shared/schema";

// Default fluting factors for different flute types
const DEFAULT_FLUTING_FACTORS: Record<string, { factor: number; height: number; description: string }> = {
  'A': { factor: 1.55, height: 4.8, description: 'A Flute (Largest)' },
  'B': { factor: 1.35, height: 2.5, description: 'B Flute (Medium)' },
  'C': { factor: 1.45, height: 3.6, description: 'C Flute (Large)' },
  'E': { factor: 1.25, height: 1.2, description: 'E Flute (Small)' },
  'F': { factor: 1.20, height: 0.8, description: 'F Flute (Micro)' },
};

// Flute combinations for different plies
export const FLUTE_COMBINATIONS: Record<string, string[]> = {
  '3': ['A', 'B', 'C', 'E', 'F'],
  '5': ['AA', 'AB', 'AC', 'AE', 'BB', 'BC', 'BE', 'CC', 'CE', 'EE', 'EF', 'FF'],
  '7': ['AAA', 'AAB', 'ABC', 'ABB', 'BBC', 'BCC', 'BCB', 'BCE', 'BBE', 'CCE', 'CEE'],
  '9': ['AAAA', 'AABB', 'ABBC', 'BBCC', 'BCCE', 'BBCE', 'CCEE'],
};

interface FlutingSettingsProps {
  onSettingsChange?: (settings: Record<string, number>) => void;
}

export function FlutingSettings({ onSettingsChange }: FlutingSettingsProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [localSettings, setLocalSettings] = useState<Record<string, { factor: string; height: string }>>({
    'A': { factor: '1.55', height: '4.8' },
    'B': { factor: '1.35', height: '2.5' },
    'C': { factor: '1.45', height: '3.6' },
    'E': { factor: '1.25', height: '1.2' },
    'F': { factor: '1.20', height: '0.8' },
  });

  const { data: savedSettings = [], isLoading } = useQuery<FlutingSetting[]>({
    queryKey: ['/api/fluting-settings'],
  });

  // Load saved settings
  useEffect(() => {
    if (savedSettings.length > 0) {
      const newSettings = { ...localSettings };
      savedSettings.forEach(setting => {
        newSettings[setting.fluteType] = {
          factor: setting.flutingFactor.toString(),
          height: setting.fluteHeight?.toString() || DEFAULT_FLUTING_FACTORS[setting.fluteType]?.height.toString() || '0',
        };
      });
      setLocalSettings(newSettings);
      
      // Notify parent of settings
      if (onSettingsChange) {
        const factorMap: Record<string, number> = {};
        Object.entries(newSettings).forEach(([type, val]) => {
          factorMap[type] = parseFloat(val.factor) || 1;
        });
        onSettingsChange(factorMap);
      }
    }
  }, [savedSettings]);

  const saveSettingMutation = useMutation({
    mutationFn: (data: { fluteType: string; flutingFactor: number; fluteHeight?: number }) => 
      apiRequest('POST', '/api/fluting-settings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/fluting-settings'] });
    },
  });

  const handleSaveAll = async () => {
    try {
      for (const [fluteType, values] of Object.entries(localSettings)) {
        await saveSettingMutation.mutateAsync({
          fluteType,
          flutingFactor: parseFloat(values.factor) || DEFAULT_FLUTING_FACTORS[fluteType].factor,
          fluteHeight: parseFloat(values.height) || undefined,
        });
      }
      
      // Notify parent of settings
      if (onSettingsChange) {
        const factorMap: Record<string, number> = {};
        Object.entries(localSettings).forEach(([type, val]) => {
          factorMap[type] = parseFloat(val.factor) || 1;
        });
        onSettingsChange(factorMap);
      }
      
      toast({ title: "Settings saved", description: "Fluting factors have been saved to your profile." });
      setOpen(false);
    } catch (error) {
      toast({ title: "Error", description: "Failed to save settings", variant: "destructive" });
    }
  };

  const resetToDefaults = () => {
    const defaults: Record<string, { factor: string; height: string }> = {};
    Object.entries(DEFAULT_FLUTING_FACTORS).forEach(([type, val]) => {
      defaults[type] = { factor: val.factor.toString(), height: val.height.toString() };
    });
    setLocalSettings(defaults);
    toast({ title: "Reset", description: "Values reset to defaults. Click Save to apply." });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid="button-fluting-settings">
          <Settings className="w-4 h-4 mr-2" />
          Fluting Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Machine Fluting Settings</DialogTitle>
          <DialogDescription>
            Configure fluting factors for your corrugator machine. These values will be automatically applied based on the flute combination you select.
          </DialogDescription>
        </DialogHeader>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Flute Type Configuration</CardTitle>
            <CardDescription>Set the fluting factor and height for each flute type on your machine</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Flute Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-32">Fluting Factor</TableHead>
                  <TableHead className="w-32">Height (mm)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(DEFAULT_FLUTING_FACTORS).map(([type, defaults]) => (
                  <TableRow key={type}>
                    <TableCell className="font-bold text-lg">{type}</TableCell>
                    <TableCell className="text-muted-foreground">{defaults.description}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        value={localSettings[type]?.factor || defaults.factor}
                        onChange={(e) => setLocalSettings(prev => ({
                          ...prev,
                          [type]: { ...prev[type], factor: e.target.value }
                        }))}
                        data-testid={`input-flute-factor-${type}`}
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
                        data-testid={`input-flute-height-${type}`}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="flex justify-between gap-2 mt-4">
          <Button variant="outline" onClick={resetToDefaults} data-testid="button-reset-defaults">
            Reset to Defaults
          </Button>
          <Button onClick={handleSaveAll} disabled={saveSettingMutation.isPending} data-testid="button-save-fluting">
            <Save className="w-4 h-4 mr-2" />
            Save Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Helper function to calculate combined fluting factor for a combination
export function getFlutingFactorForCombination(
  combination: string,
  settings: Record<string, number>
): number[] {
  const factors: number[] = [];
  for (const char of combination) {
    factors.push(settings[char] || DEFAULT_FLUTING_FACTORS[char]?.factor || 1.35);
  }
  return factors;
}

// Helper function to calculate board thickness based on flute combination
// Board thickness = sum of flute heights only (as per domain specification)
export function calculateBoardThicknessFromFlutes(
  combination: string,
  ply: string,
  fluteHeights: Record<string, number>
): number {
  if (ply === '1') return 0; // Mono - no flutes
  
  // Sum up flute heights only
  let totalFluteHeight = 0;
  for (const char of combination) {
    totalFluteHeight += fluteHeights[char] || DEFAULT_FLUTING_FACTORS[char]?.height || 2.5;
  }
  
  return totalFluteHeight;
}

// Get flute combinations for a specific ply
export function getFluteCombinationsForPly(ply: string): string[] {
  return FLUTE_COMBINATIONS[ply] || [];
}

// Export default fluting factors for external use
export { DEFAULT_FLUTING_FACTORS };
