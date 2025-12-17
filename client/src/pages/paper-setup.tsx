import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertCircle, Plus, Pencil, Trash2, ArrowRight, Package } from "lucide-react";
import type { PaperPrice, PaperPricingRules } from "@shared/schema";

const SHADE_OPTIONS = ["Kraft", "White", "Semi-Kraft", "Golden", "Duplex", "Grey Back"];
const BF_OPTIONS = [14, 16, 18, 20, 22, 24, 25, 28, 30, 32, 35, 40];

export default function PaperSetup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingPrice, setEditingPrice] = useState<PaperPrice | null>(null);
  
  const [newPrice, setNewPrice] = useState({
    gsm: "",
    bf: "",
    shade: "",
    basePrice: ""
  });

  const [rules, setRules] = useState({
    lowGsmLimit: 100,
    lowGsmAdjustment: 1,
    highGsmLimit: 201,
    highGsmAdjustment: 1,
    marketAdjustment: 0
  });

  const { data: paperPrices = [], isLoading: pricesLoading } = useQuery<PaperPrice[]>({
    queryKey: ["/api/paper-prices"]
  });

  const { data: pricingRules, isLoading: rulesLoading } = useQuery<PaperPricingRules>({
    queryKey: ["/api/paper-pricing-rules"]
  });

  useEffect(() => {
    if (pricingRules) {
      setRules({
        lowGsmLimit: pricingRules.lowGsmLimit ?? 100,
        lowGsmAdjustment: pricingRules.lowGsmAdjustment ?? 1,
        highGsmLimit: pricingRules.highGsmLimit ?? 201,
        highGsmAdjustment: pricingRules.highGsmAdjustment ?? 1,
        marketAdjustment: pricingRules.marketAdjustment ?? 0
      });
    }
  }, [pricingRules]);

  const createPriceMutation = useMutation({
    mutationFn: async (data: { gsm: number; bf: number; shade: string; basePrice: number }) => {
      return await apiRequest("POST", "/api/paper-prices", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/paper-prices"] });
      setIsAddDialogOpen(false);
      setNewPrice({ gsm: "", bf: "", shade: "", basePrice: "" });
      toast({ title: "Paper price added successfully" });
    },
    onError: (error: any) => {
      console.error("Paper price creation failed:", error);
      toast({ 
        title: "Failed to add paper price", 
        description: error?.message || "Please try again",
        variant: "destructive" 
      });
    }
  });

  const updatePriceMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PaperPrice> }) => {
      return await apiRequest("PATCH", `/api/paper-prices/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/paper-prices"] });
      setEditingPrice(null);
      toast({ title: "Paper price updated successfully" });
    }
  });

  const deletePriceMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/paper-prices/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/paper-prices"] });
      toast({ title: "Paper price deleted" });
    }
  });

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

  const calculateFinalPrice = (basePrice: number, gsm: number) => {
    let gsmAdjustment = 0;
    if (gsm <= rules.lowGsmLimit) {
      gsmAdjustment = rules.lowGsmAdjustment;
    } else if (gsm >= rules.highGsmLimit) {
      gsmAdjustment = rules.highGsmAdjustment;
    }
    return basePrice + gsmAdjustment + rules.marketAdjustment;
  };

  const pricesWithCalculations = useMemo(() => {
    return paperPrices.map(price => ({
      ...price,
      gsmAdjustment: price.gsm <= rules.lowGsmLimit 
        ? rules.lowGsmAdjustment 
        : price.gsm >= rules.highGsmLimit 
          ? rules.highGsmAdjustment 
          : 0,
      finalPrice: calculateFinalPrice(price.basePrice, price.gsm)
    }));
  }, [paperPrices, rules]);

  const handleAddPrice = () => {
    const gsm = parseInt(newPrice.gsm);
    const bf = parseInt(newPrice.bf);
    const basePrice = parseFloat(newPrice.basePrice);

    if (!gsm || !bf || !newPrice.shade || !basePrice) {
      toast({ title: "Please fill all fields", variant: "destructive" });
      return;
    }

    createPriceMutation.mutate({ gsm, bf, shade: newPrice.shade, basePrice });
  };

  const handleSaveAndContinue = () => {
    if (paperPrices.length === 0) {
      toast({ title: "Please add at least one paper price", variant: "destructive" });
      return;
    }
    saveRulesMutation.mutate({ ...rules, paperSetupCompleted: true });
  };

  if (pricesLoading || rulesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-primary">
            <Package className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Paper Price Setup</h1>
          <p className="text-muted-foreground">
            Configure your paper prices and pricing rules before using the calculator
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              GSM Adjustment Rules
            </CardTitle>
            <CardDescription>
              Define automatic price adjustments based on GSM ranges. These rules apply to all paper prices.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                <h4 className="font-medium">Low GSM Rule</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>If GSM ≤</Label>
                    <Input
                      type="number"
                      value={rules.lowGsmLimit}
                      onChange={(e) => setRules({ ...rules, lowGsmLimit: parseInt(e.target.value) || 100 })}
                      data-testid="input-low-gsm-limit"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Add ₹</Label>
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
                    <Label>Add ₹</Label>
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
            </div>

            <div className="space-y-4 p-4 border rounded-lg">
              <h4 className="font-medium">Market Adjustment (Global)</h4>
              <p className="text-sm text-muted-foreground">
                This adjustment applies to ALL paper prices. Use positive values to increase prices, negative to decrease.
              </p>
              <div className="flex items-center gap-2 max-w-xs">
                <Label className="whitespace-nowrap">Adjustment:</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={rules.marketAdjustment}
                  onChange={(e) => setRules({ ...rules, marketAdjustment: parseFloat(e.target.value) || 0 })}
                  data-testid="input-market-adjustment"
                />
                <span className="text-muted-foreground whitespace-nowrap">₹/kg</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Paper Prices</CardTitle>
              <CardDescription>
                Add your paper inventory with base prices. Final prices are calculated automatically.
              </CardDescription>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-paper">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Paper
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Paper Price</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>GSM</Label>
                      <Input
                        type="number"
                        placeholder="e.g. 120"
                        value={newPrice.gsm}
                        onChange={(e) => setNewPrice({ ...newPrice, gsm: e.target.value })}
                        data-testid="input-new-gsm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>BF (Bursting Factor)</Label>
                      <Select value={newPrice.bf} onValueChange={(v) => setNewPrice({ ...newPrice, bf: v })}>
                        <SelectTrigger data-testid="select-new-bf">
                          <SelectValue placeholder="Select BF" />
                        </SelectTrigger>
                        <SelectContent>
                          {BF_OPTIONS.map(bf => (
                            <SelectItem key={bf} value={bf.toString()}>{bf}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Shade</Label>
                      <Select value={newPrice.shade} onValueChange={(v) => setNewPrice({ ...newPrice, shade: v })}>
                        <SelectTrigger data-testid="select-new-shade">
                          <SelectValue placeholder="Select Shade" />
                        </SelectTrigger>
                        <SelectContent>
                          {SHADE_OPTIONS.map(shade => (
                            <SelectItem key={shade} value={shade}>{shade}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Base Price (₹/kg)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="e.g. 42.50"
                        value={newPrice.basePrice}
                        onChange={(e) => setNewPrice({ ...newPrice, basePrice: e.target.value })}
                        data-testid="input-new-base-price"
                      />
                    </div>
                  </div>
                  {newPrice.gsm && newPrice.basePrice && (
                    <div className="p-3 bg-muted rounded-lg text-sm">
                      <span className="text-muted-foreground">Calculated Final Price: </span>
                      <span className="font-semibold">
                        ₹{calculateFinalPrice(parseFloat(newPrice.basePrice) || 0, parseInt(newPrice.gsm) || 0).toFixed(2)}/kg
                      </span>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button 
                    onClick={handleAddPrice} 
                    disabled={createPriceMutation.isPending}
                    data-testid="button-save-paper"
                  >
                    Add Paper
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {pricesWithCalculations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No paper prices added yet.</p>
                <p className="text-sm">Click "Add Paper" to add your first paper price.</p>
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>GSM</TableHead>
                      <TableHead>BF</TableHead>
                      <TableHead>Shade</TableHead>
                      <TableHead className="text-right">Base Price</TableHead>
                      <TableHead className="text-right">GSM Adj</TableHead>
                      <TableHead className="text-right">Market Adj</TableHead>
                      <TableHead className="text-right font-semibold">Final Price</TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pricesWithCalculations.map((price) => (
                      <TableRow key={price.id} data-testid={`row-paper-${price.id}`}>
                        <TableCell>{price.gsm}</TableCell>
                        <TableCell>{price.bf}</TableCell>
                        <TableCell>{price.shade}</TableCell>
                        <TableCell className="text-right">₹{price.basePrice.toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          {price.gsmAdjustment > 0 ? `+₹${price.gsmAdjustment.toFixed(2)}` : "₹0.00"}
                        </TableCell>
                        <TableCell className="text-right">
                          {rules.marketAdjustment >= 0 
                            ? `+₹${rules.marketAdjustment.toFixed(2)}` 
                            : `-₹${Math.abs(rules.marketAdjustment).toFixed(2)}`
                          }
                        </TableCell>
                        <TableCell className="text-right font-semibold text-primary">
                          ₹{price.finalPrice.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingPrice(price)}
                              data-testid={`button-edit-paper-${price.id}`}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deletePriceMutation.mutate(price.id)}
                              data-testid={`button-delete-paper-${price.id}`}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button 
            size="lg" 
            onClick={handleSaveAndContinue}
            disabled={saveRulesMutation.isPending || paperPrices.length === 0}
            data-testid="button-save-continue"
          >
            {saveRulesMutation.isPending ? "Saving..." : "Save & Continue"}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>

        <Dialog open={!!editingPrice} onOpenChange={() => setEditingPrice(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Paper Price</DialogTitle>
            </DialogHeader>
            {editingPrice && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>GSM</Label>
                    <Input
                      type="number"
                      value={editingPrice.gsm}
                      onChange={(e) => setEditingPrice({ ...editingPrice, gsm: parseInt(e.target.value) || 0 })}
                      data-testid="input-edit-gsm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>BF</Label>
                    <Select 
                      value={editingPrice.bf.toString()} 
                      onValueChange={(v) => setEditingPrice({ ...editingPrice, bf: parseInt(v) })}
                    >
                      <SelectTrigger data-testid="select-edit-bf">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BF_OPTIONS.map(bf => (
                          <SelectItem key={bf} value={bf.toString()}>{bf}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Shade</Label>
                    <Select 
                      value={editingPrice.shade} 
                      onValueChange={(v) => setEditingPrice({ ...editingPrice, shade: v })}
                    >
                      <SelectTrigger data-testid="select-edit-shade">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SHADE_OPTIONS.map(shade => (
                          <SelectItem key={shade} value={shade}>{shade}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Base Price (₹/kg)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editingPrice.basePrice}
                      onChange={(e) => setEditingPrice({ ...editingPrice, basePrice: parseFloat(e.target.value) || 0 })}
                      data-testid="input-edit-base-price"
                    />
                  </div>
                </div>
                <div className="p-3 bg-muted rounded-lg text-sm">
                  <span className="text-muted-foreground">Calculated Final Price: </span>
                  <span className="font-semibold">
                    ₹{calculateFinalPrice(editingPrice.basePrice, editingPrice.gsm).toFixed(2)}/kg
                  </span>
                </div>
              </div>
            )}
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button
                onClick={() => {
                  if (editingPrice) {
                    updatePriceMutation.mutate({
                      id: editingPrice.id,
                      data: {
                        gsm: editingPrice.gsm,
                        bf: editingPrice.bf,
                        shade: editingPrice.shade,
                        basePrice: editingPrice.basePrice
                      }
                    });
                  }
                }}
                disabled={updatePriceMutation.isPending}
                data-testid="button-update-paper"
              >
                Update
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
