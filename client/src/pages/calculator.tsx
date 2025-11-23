import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calculator as CalculatorIcon, Package, FileText, Plus, Trash2, Save, Building2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { QuoteItem, CompanyProfile, Quote } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PLY_OPTIONS = ["1", "3", "5", "7", "9"] as const;

const GLUE_FLAP_DEFAULTS: Record<string, number> = {
  '1': 50.0,
  '3': 50.0,
  '5': 60.0,
  '7': 70.0,
  '9': 80.0,
};

interface CalculationResult {
  sheetLength: number;
  sheetWidth: number;
  sheetWeight: number;
  bs: number;
  paperCost: number;
}

export default function Calculator() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"rsc" | "sheet">("rsc");
  const [ply, setPly] = useState<string>("5");
  const [boxName, setBoxName] = useState<string>("");
  
  // RSC dimensions (mm)
  const [rscLength, setRscLength] = useState<string>("");
  const [rscWidth, setRscWidth] = useState<string>("");
  const [rscHeight, setRscHeight] = useState<string>("");
  
  // Sheet dimensions (mm)
  const [sheetLength, setSheetLength] = useState<string>("");
  const [sheetWidth, setSheetWidth] = useState<string>("");
  
  // Allowances
  const [glueFlap, setGlueFlap] = useState<string>("50");
  const [deckleAllowance, setDeckleAllowance] = useState<string>("30");
  const [sheetAllowance, setSheetAllowance] = useState<string>("10");
  
  // Paper specifications
  const [gsmL1, setGsmL1] = useState<string>("180");
  const [bfL1, setBfL1] = useState<string>("12");
  const [rateL1, setRateL1] = useState<string>("55.00");
  
  const [quantity, setQuantity] = useState<string>("1000");
  
  // Quote management
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [partyName, setPartyName] = useState<string>("");
  const [customerCompany, setCustomerCompany] = useState<string>("");
  const [customerEmail, setCustomerEmail] = useState<string>("");
  const [customerMobile, setCustomerMobile] = useState<string>("");
  
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showQuotesDialog, setShowQuotesDialog] = useState(false);
  
  // Fetch default company profile
  const { data: companyProfile, isLoading: isLoadingProfile } = useQuery<CompanyProfile>({
    queryKey: ["/api/company-profiles/default"],
  });
  
  // Fetch all quotes
  const { data: savedQuotes = [], isLoading: isLoadingQuotes } = useQuery<Quote[]>({
    queryKey: ["/api/quotes"],
  });
  
  // Save quote mutation
  const saveQuoteMutation = useMutation({
    mutationFn: async (data: {
      partyName: string;
      customerCompany: string;
      customerEmail: string;
      customerMobile: string;
      totalValue: number;
      items: QuoteItem[];
    }) => {
      return await apiRequest("POST", "/api/quotes", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({
        title: "Quote saved",
        description: "Your quote has been saved successfully.",
      });
      setShowSaveDialog(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save quote.",
        variant: "destructive",
      });
    },
  });
  
  const calculateRSC = (): CalculationResult | null => {
    const L = parseFloat(rscLength);
    const W = parseFloat(rscWidth);
    const H = parseFloat(rscHeight);
    const gf = parseFloat(glueFlap) || 50;
    const da = parseFloat(deckleAllowance) || 30;
    
    if (!L || !W || !H) return null;
    
    const sheetLen = (2 * (L + W)) + gf;
    const sheetWid = W + H + da;
    const area_m2 = (sheetLen / 1000) * (sheetWid / 1000);
    
    const gsm = parseFloat(gsmL1) || 180;
    const plyNum = parseInt(ply);
    const weight = area_m2 * gsm * (plyNum === 1 ? 1 : plyNum / 2) / 1000;
    
    const bf = parseFloat(bfL1) || 12;
    const bs = (gsm * bf) / 500;
    
    const rate = parseFloat(rateL1) || 55;
    const paperCost = weight * rate;
    
    return {
      sheetLength: sheetLen,
      sheetWidth: sheetWid,
      sheetWeight: weight,
      bs,
      paperCost,
    };
  };
  
  const calculateSheet = (): CalculationResult | null => {
    const L = parseFloat(sheetLength);
    const W = parseFloat(sheetWidth);
    const allowance = parseFloat(sheetAllowance) || 10;
    
    if (!L || !W) return null;
    
    const sheetLen = L + allowance;
    const sheetWid = W + allowance;
    const area_m2 = (sheetLen / 1000) * (sheetWid / 1000);
    
    const gsm = parseFloat(gsmL1) || 180;
    const plyNum = parseInt(ply);
    const weight = area_m2 * gsm * (plyNum === 1 ? 1 : plyNum / 2) / 1000;
    
    const bf = parseFloat(bfL1) || 12;
    const bs = (gsm * bf) / 500;
    
    const rate = parseFloat(rateL1) || 55;
    const paperCost = weight * rate;
    
    return {
      sheetLength: sheetLen,
      sheetWidth: sheetWid,
      sheetWeight: weight,
      bs,
      paperCost,
    };
  };
  
  const result = activeTab === "rsc" ? calculateRSC() : calculateSheet();
  const costPerUnit = result ? result.paperCost * 1.15 : 0;
  const qty = parseFloat(quantity) || 1000;
  const totalValue = costPerUnit * qty;
  
  const handleAddToQuote = () => {
    if (!result) {
      toast({
        title: "Error",
        description: "Please enter valid dimensions first.",
        variant: "destructive",
      });
      return;
    }
    
    const item: QuoteItem = {
      type: activeTab,
      boxName: boxName || `${ply}-Ply ${activeTab === "rsc" ? "Box" : "Sheet"}`,
      ply: ply as "1" | "3" | "5" | "7" | "9",
      length: activeTab === "rsc" ? parseFloat(rscLength) : parseFloat(sheetLength),
      width: activeTab === "rsc" ? parseFloat(rscWidth) : parseFloat(sheetWidth),
      height: activeTab === "rsc" ? parseFloat(rscHeight) : undefined,
      sheetLength: result.sheetLength,
      sheetWidth: result.sheetWidth,
      sheetWeight: result.sheetWeight,
      bs: result.bs,
      paperSpecs: {
        L1: {
          gsm: parseFloat(gsmL1),
          bf: parseFloat(bfL1),
          shade: "Brown",
          rate: parseFloat(rateL1),
        },
      },
      paperCost: result.paperCost,
      additionalCosts: {},
      totalCostPerBox: costPerUnit,
      quantity: qty,
      totalValue: totalValue,
    };
    
    setQuoteItems([...quoteItems, item]);
    
    // Reset form
    setBoxName("");
    if (activeTab === "rsc") {
      setRscLength("");
      setRscWidth("");
      setRscHeight("");
    } else {
      setSheetLength("");
      setSheetWidth("");
    }
    setQuantity("1000");
    
    toast({
      title: "Item added",
      description: "Item has been added to your quote.",
    });
  };
  
  const handleRemoveItem = (index: number) => {
    setQuoteItems(quoteItems.filter((_, i) => i !== index));
  };
  
  const handleSaveQuote = () => {
    if (quoteItems.length === 0) {
      toast({
        title: "Error",
        description: "Add at least one item to the quote.",
        variant: "destructive",
      });
      return;
    }
    
    if (!partyName && !customerCompany) {
      toast({
        title: "Error",
        description: "Please enter party name or company name.",
        variant: "destructive",
      });
      return;
    }
    
    const total = quoteItems.reduce((sum, item) => sum + item.totalValue, 0);
    
    saveQuoteMutation.mutate({
      partyName: partyName,
      customerCompany: customerCompany || "",
      customerEmail: customerEmail || "",
      customerMobile: customerMobile || "",
      totalValue: total,
      items: quoteItems,
    });
  };
  
  const handleLoadQuote = (quote: Quote) => {
    setQuoteItems(quote.items as QuoteItem[]);
    setPartyName(quote.partyName);
    setCustomerCompany(quote.customerCompany || "");
    setCustomerEmail(quote.customerEmail || "");
    setCustomerMobile(quote.customerMobile || "");
    setShowQuotesDialog(false);
    
    toast({
      title: "Quote loaded",
      description: "Quote has been loaded successfully.",
    });
  };
  
  const grandTotal = quoteItems.reduce((sum, item) => sum + item.totalValue, 0);
  
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CalculatorIcon className="w-8 h-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold" data-testid="text-app-title">
                  Box Costing Calculator
                </h1>
                <p className="text-sm text-muted-foreground">
                  {isLoadingProfile ? "Loading..." : companyProfile?.companyName || "Company"}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Dialog open={showQuotesDialog} onOpenChange={setShowQuotesDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" data-testid="button-load-quote">
                    <FileText className="w-4 h-4 mr-2" />
                    Load Quote
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Saved Quotes</DialogTitle>
                    <DialogDescription>
                      Load a previously saved quote
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2">
                    {isLoadingQuotes ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        Loading quotes...
                      </p>
                    ) : savedQuotes.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No saved quotes found
                      </p>
                    ) : (
                      savedQuotes.map((quote) => (
                        <Card
                          key={quote.id}
                          className="cursor-pointer hover-elevate"
                          onClick={() => handleLoadQuote(quote)}
                          data-testid={`quote-item-${quote.id}`}
                        >
                          <CardHeader className="p-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <CardTitle className="text-base">{quote.partyName}</CardTitle>
                                <CardDescription>
                                  {quote.customerCompany} • {new Date(quote.createdAt || "").toLocaleDateString()}
                                </CardDescription>
                              </div>
                              <Badge variant="secondary">
                                ₹{quote.totalValue.toFixed(2)}
                              </Badge>
                            </div>
                          </CardHeader>
                        </Card>
                      ))
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "rsc" | "sheet")} className="space-y-6">
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="rsc" data-testid="tab-rsc">
                  <Package className="w-4 h-4 mr-2" />
                  RSC Box
                </TabsTrigger>
                <TabsTrigger value="sheet" data-testid="tab-sheet">
                  <FileText className="w-4 h-4 mr-2" />
                  Sheet
                </TabsTrigger>
              </TabsList>

              <TabsContent value="rsc" className="mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle>RSC Box Dimensions</CardTitle>
                    <CardDescription>Enter dimensions in millimeters (OD)</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="box-name-rsc">Box Name</Label>
                      <Input
                        id="box-name-rsc"
                        placeholder="e.g., 10kg Apple Box"
                        value={boxName}
                        onChange={(e) => setBoxName(e.target.value)}
                        data-testid="input-box-name"
                      />
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="rsc-length">Length (mm)</Label>
                        <Input
                          id="rsc-length"
                          type="number"
                          placeholder="400"
                          value={rscLength}
                          onChange={(e) => setRscLength(e.target.value)}
                          data-testid="input-rsc-length"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="rsc-width">Width (mm)</Label>
                        <Input
                          id="rsc-width"
                          type="number"
                          placeholder="300"
                          value={rscWidth}
                          onChange={(e) => setRscWidth(e.target.value)}
                          data-testid="input-rsc-width"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="rsc-height">Height (mm)</Label>
                        <Input
                          id="rsc-height"
                          type="number"
                          placeholder="200"
                          value={rscHeight}
                          onChange={(e) => setRscHeight(e.target.value)}
                          data-testid="input-rsc-height"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="glue-flap">Glue Flap (mm)</Label>
                        <Input
                          id="glue-flap"
                          type="number"
                          value={glueFlap}
                          onChange={(e) => setGlueFlap(e.target.value)}
                          data-testid="input-glue-flap"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="deckle-allowance">Deckle Allowance (mm)</Label>
                        <Input
                          id="deckle-allowance"
                          type="number"
                          value={deckleAllowance}
                          onChange={(e) => setDeckleAllowance(e.target.value)}
                          data-testid="input-deckle-allowance"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="sheet" className="mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle>Sheet Dimensions</CardTitle>
                    <CardDescription>Enter sheet size in millimeters</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="box-name-sheet">Sheet Name</Label>
                      <Input
                        id="box-name-sheet"
                        placeholder="e.g., Custom Sheet"
                        value={boxName}
                        onChange={(e) => setBoxName(e.target.value)}
                        data-testid="input-box-name"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="sheet-length">Length (mm)</Label>
                        <Input
                          id="sheet-length"
                          type="number"
                          placeholder="1000"
                          value={sheetLength}
                          onChange={(e) => setSheetLength(e.target.value)}
                          data-testid="input-sheet-length"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sheet-width">Width (mm)</Label>
                        <Input
                          id="sheet-width"
                          type="number"
                          placeholder="800"
                          value={sheetWidth}
                          onChange={(e) => setSheetWidth(e.target.value)}
                          data-testid="input-sheet-width"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="sheet-allowance">Allowance (mm)</Label>
                      <Input
                        id="sheet-allowance"
                        type="number"
                        value={sheetAllowance}
                        onChange={(e) => setSheetAllowance(e.target.value)}
                        data-testid="input-sheet-allowance"
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <Card>
              <CardHeader>
                <CardTitle>Paper Specifications</CardTitle>
                <CardDescription>Configure paper properties</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ply">Ply</Label>
                  <Select value={ply} onValueChange={(v) => {
                    setPly(v);
                    setGlueFlap(GLUE_FLAP_DEFAULTS[v].toString());
                  }}>
                    <SelectTrigger id="ply" data-testid="select-ply">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PLY_OPTIONS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p === "1" ? "MONO" : `${p}-Ply`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="gsm">GSM</Label>
                    <Input
                      id="gsm"
                      type="number"
                      value={gsmL1}
                      onChange={(e) => setGsmL1(e.target.value)}
                      data-testid="input-gsm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bf">BF</Label>
                    <Input
                      id="bf"
                      type="number"
                      value={bfL1}
                      onChange={(e) => setBfL1(e.target.value)}
                      data-testid="input-bf"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rate">Rate (₹/kg)</Label>
                    <Input
                      id="rate"
                      type="number"
                      value={rateL1}
                      onChange={(e) => setRateL1(e.target.value)}
                      data-testid="input-rate"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Calculated Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {result ? (
                  <>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Sheet Length:</span>
                        <span className="font-medium" data-testid="text-sheet-length">
                          {result.sheetLength.toFixed(2)} mm
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Sheet Width:</span>
                        <span className="font-medium" data-testid="text-sheet-width">
                          {result.sheetWidth.toFixed(2)} mm
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Weight:</span>
                        <span className="font-medium" data-testid="text-sheet-weight">
                          {result.sheetWeight.toFixed(3)} kg
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">BS:</span>
                        <span className="font-medium" data-testid="text-bs">
                          {result.bs.toFixed(2)} kg/cm²
                        </span>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Cost/unit:</span>
                        <span className="font-bold text-lg" data-testid="text-cost-per-unit">
                          ₹{costPerUnit.toFixed(2)}
                        </span>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="quantity">Quantity</Label>
                        <Input
                          id="quantity"
                          type="number"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                          data-testid="input-quantity"
                        />
                      </div>
                      
                      <div className="flex justify-between pt-2 border-t">
                        <span className="font-semibold">Total:</span>
                        <span className="font-bold text-xl text-primary" data-testid="text-total-value">
                          ₹{totalValue.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    
                    <Button 
                      className="w-full" 
                      size="lg" 
                      onClick={handleAddToQuote}
                      data-testid="button-add-to-quote"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add to Quote
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Enter dimensions to calculate
                  </p>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Quote Items</CardTitle>
                    <CardDescription>{quoteItems.length} items</CardDescription>
                  </div>
                  {quoteItems.length > 0 && (
                    <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
                      <DialogTrigger asChild>
                        <Button size="sm" data-testid="button-save-quote">
                          <Save className="w-4 h-4 mr-2" />
                          Save
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Save Quote</DialogTitle>
                          <DialogDescription>
                            Enter customer details to save this quote
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="party-name">Party Name *</Label>
                            <Input
                              id="party-name"
                              placeholder="Mr. John Doe"
                              value={partyName}
                              onChange={(e) => setPartyName(e.target.value)}
                              data-testid="input-party-name"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="customer-company">Company Name</Label>
                            <Input
                              id="customer-company"
                              placeholder="ABC Enterprises"
                              value={customerCompany}
                              onChange={(e) => setCustomerCompany(e.target.value)}
                              data-testid="input-customer-company"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="customer-email">Email</Label>
                            <Input
                              id="customer-email"
                              type="email"
                              placeholder="contact@company.com"
                              value={customerEmail}
                              onChange={(e) => setCustomerEmail(e.target.value)}
                              data-testid="input-customer-email"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="customer-mobile">Mobile</Label>
                            <Input
                              id="customer-mobile"
                              placeholder="9876543210"
                              value={customerMobile}
                              onChange={(e) => setCustomerMobile(e.target.value)}
                              data-testid="input-customer-mobile"
                            />
                          </div>
                          <Button
                            onClick={handleSaveQuote}
                            className="w-full"
                            disabled={saveQuoteMutation.isPending}
                            data-testid="button-confirm-save"
                          >
                            {saveQuoteMutation.isPending ? "Saving..." : "Save Quote"}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {quoteItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No items in quote
                  </p>
                ) : (
                  <div className="space-y-2">
                    {quoteItems.map((item, index) => (
                      <div 
                        key={index} 
                        className="flex justify-between items-start p-3 border rounded-lg"
                        data-testid={`quote-item-${index}`}
                      >
                        <div className="flex-1">
                          <p className="font-medium text-sm">{item.boxName}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.ply}-Ply • {item.quantity.toLocaleString()} pcs
                          </p>
                          <p className="text-sm font-bold mt-1">
                            ₹{item.totalValue.toFixed(2)}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveItem(index)}
                          data-testid={`button-remove-${index}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    <Separator />
                    <div className="flex justify-between items-center pt-2">
                      <span className="font-semibold">Grand Total:</span>
                      <span className="font-bold text-xl text-primary" data-testid="text-grand-total">
                        ₹{grandTotal.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
