import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { calculatePaperRate } from "@/lib/paperPricing";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertCircle, Plus, Pencil, Trash2, ArrowRight, Package, Calculator, Sparkles, TrendingUp } from "lucide-react";
import type { PaperBfPrice, ShadePremium, PaperPricingRules } from "@shared/schema";

const BF_OPTIONS = [14, 16, 18, 20, 22, 24, 25, 28, 30, 32, 35, 40];

export default function PaperSetup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [defaultsInitialized, setDefaultsInitialized] = useState(false);
  
  // BF Price dialog state
  const [isBfDialogOpen, setIsBfDialogOpen] = useState(false);
  const [editingBfPrice, setEditingBfPrice] = useState<PaperBfPrice | null>(null);
  const [newBfPrice, setNewBfPrice] = useState({ bf: "", basePrice: "" });
  
  // Shade Premium dialog state
  const [isShadeDialogOpen, setIsShadeDialogOpen] = useState(false);
  const [editingShade, setEditingShade] = useState<ShadePremium | null>(null);
  const [newShade, setNewShade] = useState({ shade: "", premium: "0" });
  const [isCustomShade, setIsCustomShade] = useState(false);
  const [customShadeName, setCustomShadeName] = useState("");

  // Rules state
  const [rules, setRules] = useState({
    lowGsmLimit: 101,
    lowGsmAdjustment: 1,
    highGsmLimit: 201,
    highGsmAdjustment: 1,
    marketAdjustment: 0
  });

  // Preview calculator state
  const [previewBf, setPreviewBf] = useState<number | null>(null);
  const [previewGsm, setPreviewGsm] = useState<number>(120);
  const [previewShade, setPreviewShade] = useState<string>("");

  // Queries
  const { data: bfPrices = [], isLoading: bfLoading, isFetched: bfFetched } = useQuery<PaperBfPrice[]>({
    queryKey: ["/api/paper-bf-prices"]
  });

  const { data: shadePremiums = [], isLoading: shadesLoading } = useQuery<ShadePremium[]>({
    queryKey: ["/api/shade-premiums"]
  });

  const { data: pricingRules, isLoading: rulesLoading } = useQuery<PaperPricingRules>({
    queryKey: ["/api/paper-pricing-rules"]
  });

  // Mutation to initialize default BF prices and shade types
  const initDefaultsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/paper-bf-prices/init-defaults", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/paper-bf-prices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shade-premiums"] });
      setDefaultsInitialized(true);
    }
  });

  // Initialize defaults if user has no BF prices or no shades
  useEffect(() => {
    const needsBfPrices = bfFetched && bfPrices.length === 0;
    const needsShades = !shadesLoading && shadePremiums.length === 0;
    
    if ((needsBfPrices || needsShades) && !defaultsInitialized && !initDefaultsMutation.isPending) {
      initDefaultsMutation.mutate();
    }
  }, [bfFetched, bfPrices.length, shadesLoading, shadePremiums.length, defaultsInitialized, initDefaultsMutation.isPending]);

  useEffect(() => {
    if (pricingRules) {
      setRules({
        lowGsmLimit: pricingRules.lowGsmLimit ?? 101,
        lowGsmAdjustment: pricingRules.lowGsmAdjustment ?? 1,
        highGsmLimit: pricingRules.highGsmLimit ?? 201,
        highGsmAdjustment: pricingRules.highGsmAdjustment ?? 1,
        marketAdjustment: pricingRules.marketAdjustment ?? 0
      });
    }
  }, [pricingRules]);

  // Set default preview BF and shade when data loads
  useEffect(() => {
    if (bfPrices.length > 0 && previewBf === null) {
      setPreviewBf(bfPrices[0].bf);
    }
  }, [bfPrices, previewBf]);
  
  useEffect(() => {
    if (shadePremiums.length > 0 && !previewShade) {
      setPreviewShade(shadePremiums[0].shade);
    } else if (shadePremiums.length === 0 && !previewShade) {
      setPreviewShade("Kraft");
    }
  }, [shadePremiums, previewShade]);

  // Mutations for BF Prices
  const createBfPriceMutation = useMutation({
    mutationFn: async (data: { bf: number; basePrice: number }) => {
      return await apiRequest("POST", "/api/paper-bf-prices", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/paper-bf-prices"] });
      setIsBfDialogOpen(false);
      setNewBfPrice({ bf: "", basePrice: "" });
      toast({ title: "BF price added successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to add BF price", 
        description: error?.message || "Please try again",
        variant: "destructive" 
      });
    }
  });

  const updateBfPriceMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PaperBfPrice> }) => {
      return await apiRequest("PATCH", `/api/paper-bf-prices/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/paper-bf-prices"] });
      setEditingBfPrice(null);
      toast({ title: "BF price updated successfully" });
    }
  });

  const deleteBfPriceMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/paper-bf-prices/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/paper-bf-prices"] });
      toast({ title: "BF price deleted" });
    }
  });

  // Mutations for Shade Premiums
  const createShadePremiumMutation = useMutation({
    mutationFn: async (data: { shade: string; premium: number }) => {
      return await apiRequest("POST", "/api/shade-premiums", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shade-premiums"] });
      setIsShadeDialogOpen(false);
      setNewShade({ shade: "", premium: "" });
      toast({ title: "Shade premium added successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to add shade premium", 
        description: error?.message || "Please try again",
        variant: "destructive" 
      });
    }
  });

  const updateShadePremiumMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ShadePremium> }) => {
      return await apiRequest("PATCH", `/api/shade-premiums/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shade-premiums"] });
      setEditingShade(null);
      toast({ title: "Shade premium updated successfully" });
    }
  });

  const deleteShadePremiumMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/shade-premiums/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shade-premiums"] });
      toast({ title: "Shade premium deleted" });
    }
  });

  // Save rules mutation
  const saveRulesMutation = useMutation({
    mutationFn: async (data: typeof rules & { paperSetupCompleted: boolean }) => {
      return await apiRequest("POST", "/api/paper-pricing-rules", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/paper-pricing-rules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/paper-setup-status"] });
      toast({ title: "Settings saved successfully" });
      setLocation("/");
    },
    onError: () => {
      toast({ title: "Failed to save settings", variant: "destructive" });
    }
  });

  // Calculate preview price
  const previewCalculation = useMemo(() => {
    if (!previewBf) return null;
    
    const pricingData = {
      bfPrices,
      shadePremiums,
      rules: {
        id: '',
        userId: '',
        lowGsmLimit: rules.lowGsmLimit,
        highGsmLimit: rules.highGsmLimit,
        lowGsmAdjustment: rules.lowGsmAdjustment,
        highGsmAdjustment: rules.highGsmAdjustment,
        marketAdjustment: rules.marketAdjustment
      } as PaperPricingRules
    };
    
    return calculatePaperRate(
      { bf: previewBf, gsm: previewGsm, shade: previewShade || "Kraft" },
      pricingData
    );
  }, [previewBf, previewGsm, previewShade, bfPrices, shadePremiums, rules]);

  const handleAddBfPrice = () => {
    const bf = parseInt(newBfPrice.bf);
    const basePrice = parseFloat(newBfPrice.basePrice);

    if (!bf || !basePrice) {
      toast({ title: "Please fill all fields", variant: "destructive" });
      return;
    }

    createBfPriceMutation.mutate({ bf, basePrice });
  };

  const handleAddShadePremium = () => {
    const premium = parseFloat(newShade.premium);
    const shadeName = isCustomShade ? customShadeName.trim() : newShade.shade;

    if (!shadeName || isNaN(premium)) {
      toast({ title: "Please fill all fields", variant: "destructive" });
      return;
    }
    
    // Check if shade already exists
    const existingShade = shadePremiums.find(sp => sp.shade.toLowerCase() === shadeName.toLowerCase());
    if (existingShade) {
      toast({ title: "This shade already exists. Use edit to change its premium.", variant: "destructive" });
      return;
    }

    createShadePremiumMutation.mutate({ shade: shadeName, premium });
    setIsCustomShade(false);
    setCustomShadeName("");
  };

  const handleSaveAndContinue = () => {
    if (bfPrices.length === 0) {
      toast({ title: "Please add at least one BF price", variant: "destructive" });
      return;
    }
    saveRulesMutation.mutate({ ...rules, paperSetupCompleted: true });
  };

  if (bfLoading || shadesLoading || rulesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-primary">
            <Package className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Paper Price Settings</h1>
          <p className="text-muted-foreground">
            Configure your BF-based pricing, GSM adjustments, and shade premiums
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Section 1: BF Base Prices */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-500" />
                BF Base Prices
              </CardTitle>
              <CardDescription>
                Define base paper price for each Bursting Factor (BF). This is the foundation of all pricing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-end">
                <Button 
                  size="sm" 
                  onClick={() => setIsBfDialogOpen(true)}
                  data-testid="button-add-bf-price"
                >
                  <Plus className="w-4 h-4 mr-1" /> Add BF Price
                </Button>
              </div>
              
              {bfPrices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No BF prices configured yet.</p>
                  <p className="text-sm">Add your first BF price to get started.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>BF</TableHead>
                      <TableHead>Base Price (₹/Kg)</TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bfPrices.sort((a, b) => a.bf - b.bf).map(price => (
                      <TableRow key={price.id} data-testid={`row-bf-price-${price.bf}`}>
                        <TableCell className="font-medium">BF {price.bf}</TableCell>
                        <TableCell>₹{price.basePrice.toFixed(2)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setEditingBfPrice(price)}
                              data-testid={`button-edit-bf-${price.bf}`}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => deleteBfPriceMutation.mutate(price.id)}
                              data-testid={`button-delete-bf-${price.bf}`}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Section 2: GSM Adjustment Rules */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                GSM Adjustment Rules
              </CardTitle>
              <CardDescription>
                Define automatic price adjustments based on GSM ranges. Middle range has zero adjustment.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                <h4 className="font-medium">Low GSM Rule</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>If GSM ≤</Label>
                    <Input
                      type="number"
                      value={rules.lowGsmLimit}
                      onChange={(e) => setRules({ ...rules, lowGsmLimit: parseInt(e.target.value) || 101 })}
                      data-testid="input-low-gsm-limit"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Add ₹/Kg</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={rules.lowGsmAdjustment}
                      onChange={(e) => setRules({ ...rules, lowGsmAdjustment: parseFloat(e.target.value) || 0 })}
                      data-testid="input-low-gsm-adjustment"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                <h4 className="font-medium">High GSM Rule</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>If GSM ≥</Label>
                    <Input
                      type="number"
                      value={rules.highGsmLimit}
                      onChange={(e) => setRules({ ...rules, highGsmLimit: parseInt(e.target.value) || 201 })}
                      data-testid="input-high-gsm-limit"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Add ₹/Kg</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={rules.highGsmAdjustment}
                      onChange={(e) => setRules({ ...rules, highGsmAdjustment: parseFloat(e.target.value) || 0 })}
                      data-testid="input-high-gsm-adjustment"
                    />
                  </div>
                </div>
              </div>

              <div className="text-sm text-muted-foreground text-center p-2 bg-muted/30 rounded">
                GSM between {rules.lowGsmLimit + 1} and {rules.highGsmLimit - 1} has no adjustment
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Shade Premiums */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-yellow-500" />
                Shade Premiums
              </CardTitle>
              <CardDescription>
                Add premium amounts for special paper shades (e.g., Golden paper costs more).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-end">
                <Button 
                  size="sm" 
                  onClick={() => setIsShadeDialogOpen(true)}
                  data-testid="button-add-shade-premium"
                >
                  <Plus className="w-4 h-4 mr-1" /> Add Shade Premium
                </Button>
              </div>
              
              {shadePremiums.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No shade premiums configured.</p>
                  <p className="text-sm">Most shades have zero premium by default.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Shade</TableHead>
                      <TableHead>Premium (₹/Kg)</TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shadePremiums.map(premium => (
                      <TableRow key={premium.id} data-testid={`row-shade-${premium.shade}`}>
                        <TableCell className="font-medium">{premium.shade}</TableCell>
                        <TableCell>+₹{premium.premium.toFixed(2)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setEditingShade(premium)}
                              data-testid={`button-edit-shade-${premium.shade}`}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => deleteShadePremiumMutation.mutate(premium.id)}
                              data-testid={`button-delete-shade-${premium.shade}`}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Section 4: Market Adjustment */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-green-500" />
                Market Adjustment
              </CardTitle>
              <CardDescription>
                Global adjustment that applies to all paper prices (positive or negative).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Market Adjustment (₹/Kg)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={rules.marketAdjustment}
                  onChange={(e) => setRules({ ...rules, marketAdjustment: parseFloat(e.target.value) || 0 })}
                  placeholder="Enter positive or negative value"
                  data-testid="input-market-adjustment"
                />
                <p className="text-sm text-muted-foreground">
                  Use positive values to increase all prices, negative to decrease.
                </p>
              </div>

              {/* Price Preview Calculator */}
              <div className="border-t pt-4">
                <h4 className="font-medium mb-4">Price Preview</h4>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="space-y-1">
                    <Label className="text-xs">BF</Label>
                    <Select
                      value={previewBf?.toString() || ""}
                      onValueChange={(v) => setPreviewBf(parseInt(v))}
                    >
                      <SelectTrigger data-testid="select-preview-bf">
                        <SelectValue placeholder="Select BF" />
                      </SelectTrigger>
                      <SelectContent>
                        {bfPrices.map(p => (
                          <SelectItem key={p.bf} value={p.bf.toString()}>
                            BF {p.bf}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">GSM</Label>
                    <Input
                      type="number"
                      value={previewGsm}
                      onChange={(e) => setPreviewGsm(parseInt(e.target.value) || 100)}
                      data-testid="input-preview-gsm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Shade</Label>
                    <Select
                      value={previewShade}
                      onValueChange={setPreviewShade}
                    >
                      <SelectTrigger data-testid="select-preview-shade">
                        <SelectValue placeholder="Select shade" />
                      </SelectTrigger>
                      <SelectContent>
                        {shadePremiums.length > 0 ? (
                          shadePremiums.map(sp => (
                            <SelectItem key={sp.shade} value={sp.shade}>
                              {sp.shade}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="Kraft">Kraft (default)</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {previewCalculation ? (
                  <div className="bg-muted/50 p-3 rounded-lg space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>BF Base Price:</span>
                      <span>₹{previewCalculation.bfBasePrice.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>+ GSM Adjustment:</span>
                      <span>₹{previewCalculation.gsmAdjustment.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>+ Shade Premium:</span>
                      <span>₹{previewCalculation.shadePremium.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>+ Market Adjustment:</span>
                      <span>₹{previewCalculation.marketAdjustment.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold border-t pt-1 mt-1">
                      <span>Final Rate:</span>
                      <span className="text-primary">₹{previewCalculation.finalRate.toFixed(2)}/Kg</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    Select a BF to see price preview
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Complete Setup Button */}
        <div className="flex justify-center pt-4">
          <Button 
            size="lg" 
            onClick={handleSaveAndContinue}
            disabled={saveRulesMutation.isPending}
            data-testid="button-complete-setup"
          >
            {saveRulesMutation.isPending ? "Saving..." : "Save Settings & Continue"}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>

      {/* Add BF Price Dialog */}
      <Dialog open={isBfDialogOpen} onOpenChange={setIsBfDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add BF Base Price</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Bursting Factor (BF)</Label>
              <Select
                value={newBfPrice.bf}
                onValueChange={(v) => setNewBfPrice({ ...newBfPrice, bf: v })}
              >
                <SelectTrigger data-testid="select-new-bf">
                  <SelectValue placeholder="Select BF" />
                </SelectTrigger>
                <SelectContent>
                  {BF_OPTIONS.filter(bf => !bfPrices.some(p => p.bf === bf)).map(bf => (
                    <SelectItem key={bf} value={bf.toString()}>
                      BF {bf}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Base Price (₹/Kg)</Label>
              <Input
                type="number"
                step="0.01"
                value={newBfPrice.basePrice}
                onChange={(e) => setNewBfPrice({ ...newBfPrice, basePrice: e.target.value })}
                placeholder="e.g., 45.00"
                data-testid="input-new-bf-price"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button 
              onClick={handleAddBfPrice}
              disabled={createBfPriceMutation.isPending}
              data-testid="button-confirm-add-bf"
            >
              Add Price
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit BF Price Dialog */}
      <Dialog open={!!editingBfPrice} onOpenChange={() => setEditingBfPrice(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit BF {editingBfPrice?.bf} Price</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Base Price (₹/Kg)</Label>
              <Input
                type="number"
                step="0.01"
                defaultValue={editingBfPrice?.basePrice}
                onChange={(e) => {
                  if (editingBfPrice) {
                    setEditingBfPrice({ ...editingBfPrice, basePrice: parseFloat(e.target.value) || 0 });
                  }
                }}
                data-testid="input-edit-bf-price"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button 
              onClick={() => {
                if (editingBfPrice) {
                  updateBfPriceMutation.mutate({
                    id: editingBfPrice.id,
                    data: { basePrice: editingBfPrice.basePrice }
                  });
                }
              }}
              disabled={updateBfPriceMutation.isPending}
              data-testid="button-confirm-edit-bf"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Shade Premium Dialog */}
      <Dialog open={isShadeDialogOpen} onOpenChange={(open) => {
        setIsShadeDialogOpen(open);
        if (!open) {
          setIsCustomShade(false);
          setCustomShadeName("");
          setNewShade({ shade: "", premium: "0" });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Paper Shade</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Shade Name</Label>
              {!isCustomShade ? (
                <Select
                  value={newShade.shade}
                  onValueChange={(value) => {
                    if (value === "__custom__") {
                      setIsCustomShade(true);
                      setNewShade({ ...newShade, shade: "" });
                    } else {
                      setNewShade({ ...newShade, shade: value });
                    }
                  }}
                >
                  <SelectTrigger data-testid="select-new-shade">
                    <SelectValue placeholder="Select or add shade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Kraft/Natural">Kraft/Natural</SelectItem>
                    <SelectItem value="Golden Kraft">Golden Kraft</SelectItem>
                    <SelectItem value="Testliner">Testliner</SelectItem>
                    <SelectItem value="Virgin Kraft Liner">Virgin Kraft Liner</SelectItem>
                    <SelectItem value="White Kraft Liner">White Kraft Liner</SelectItem>
                    <SelectItem value="White Top Testliner">White Top Testliner</SelectItem>
                    <SelectItem value="Duplex Grey Back (LWC)">Duplex Grey Back (LWC)</SelectItem>
                    <SelectItem value="Duplex Grey Back (HWC)">Duplex Grey Back (HWC)</SelectItem>
                    <SelectItem value="Semi Chemical Fluting">Semi Chemical Fluting</SelectItem>
                    <SelectItem value="Recycled Fluting">Recycled Fluting</SelectItem>
                    <SelectItem value="Bagass (Agro based)">Bagass (Agro based)</SelectItem>
                    <SelectItem value="__custom__" className="text-primary font-medium">+ Add Custom Shade...</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="space-y-2">
                  <Input
                    value={customShadeName}
                    onChange={(e) => setCustomShadeName(e.target.value)}
                    placeholder="Enter custom shade name"
                    data-testid="input-custom-shade-name"
                  />
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      setIsCustomShade(false);
                      setCustomShadeName("");
                    }}
                    className="text-xs"
                  >
                    ← Back to dropdown
                  </Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Select from common shades or add your own custom shade name
              </p>
            </div>
            <div className="space-y-2">
              <Label>Premium Amount (₹/Kg)</Label>
              <Input
                type="number"
                step="0.01"
                value={newShade.premium}
                onChange={(e) => setNewShade({ ...newShade, premium: e.target.value })}
                placeholder="e.g., 2.00 (use 0 for no premium)"
                data-testid="input-new-shade-premium"
              />
              <p className="text-xs text-muted-foreground">
                Set to 0 if this shade has no additional cost
              </p>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button 
              onClick={handleAddShadePremium}
              disabled={createShadePremiumMutation.isPending}
              data-testid="button-confirm-add-shade"
            >
              Add Shade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Shade Premium Dialog */}
      <Dialog open={!!editingShade} onOpenChange={() => setEditingShade(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {editingShade?.shade} Premium</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Shade Name</Label>
              <Input
                value={editingShade?.shade || ""}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label>Premium Amount (₹/Kg)</Label>
              <Input
                type="number"
                step="0.01"
                value={editingShade?.premium ?? 0}
                onChange={(e) => {
                  if (editingShade) {
                    setEditingShade({ ...editingShade, premium: parseFloat(e.target.value) || 0 });
                  }
                }}
                data-testid="input-edit-shade-premium"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button 
              onClick={() => {
                if (editingShade) {
                  updateShadePremiumMutation.mutate({
                    id: editingShade.id,
                    data: { premium: editingShade.premium }
                  });
                }
              }}
              disabled={updateShadePremiumMutation.isPending}
              data-testid="button-confirm-edit-shade"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
