import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calculator as CalculatorIcon, Package, FileText, Plus, Trash2, Save, Building2, MessageCircle, Mail } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { QuoteItem, CompanyProfile, Quote, AppSettings, LayerSpec } from "@shared/schema";
import { generateWhatsAppMessage, generateEmailContent } from "@/lib/messageGenerator";
import {
  mmToInches,
  inchesToMm,
  calculateRSCSheet,
  calculateFlatSheet,
  calculateSheetWeight,
  calculateBurstStrength,
  calculatePaperCost,
  calculateTotalCost,
  calculateBoardThickness,
  calculateECT,
  calculateMcKeeFormula,
} from "@/lib/calculations";
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

const PLY_THICKNESS: Record<string, number> = {
  '1': 0.45,
  '3': 2.5,
  '5': 3.5,
  '7': 5.5,
  '9': 6.5,
};

interface CalculationResult {
  sheetLength: number;
  sheetWidth: number;
  sheetWeight: number;
  bs: number;
  paperCost: number;
  boardThickness: number;
  boxPerimeter: number;
  ect: number;
  bct: number;
}

// Helper function to create layers for a given ply count
const createLayersForPly = (plyNum: number) => {
  const defaultLayers = [];
  for (let i = 0; i < plyNum; i++) {
    // For 5-ply: L1, L3, L5 are Liner (odd indices 0, 2, 4), L2, L4 are Flute (even indices 1, 3)
    // For other plies: alternate or use standard pattern
    let isFlute = false;
    let flutingFactorValue = "1.0";
    
    if (plyNum === 5) {
      // 5-ply specific: Liner at L1, L3, L5 (indices 0, 2, 4), Flute at L2, L4 (indices 1, 3)
      isFlute = i === 1 || i === 3;
      flutingFactorValue = isFlute ? "1.5" : "1.0";
    } else if (plyNum === 7) {
      // 7-ply: L1, L3, L5, L7 Liner (indices 0, 2, 4, 6), L2, L4, L6 Flute (indices 1, 3, 5)
      isFlute = i === 1 || i === 3 || i === 5;
      flutingFactorValue = isFlute ? "1.5" : "1.0";
    } else if (plyNum === 9) {
      // 9-ply: L1, L3, L5, L7, L9 Liner, others Flute
      isFlute = i === 1 || i === 3 || i === 5 || i === 7;
      flutingFactorValue = isFlute ? "1.5" : "1.0";
    } else {
      // 1-ply and 3-ply: standard alternating pattern
      isFlute = i > 0 && i < plyNum - 1;
      flutingFactorValue = isFlute ? "1.5" : "1.0";
    }
    
    defaultLayers.push({
      gsm: "180",
      bf: "12",
      flutingFactor: flutingFactorValue,
      rctValue: "0",
      rate: "55.00",
      layerType: isFlute ? "flute" as const : "liner" as const,
      shade: "Brown",
    });
  }
  return defaultLayers;
};

export default function Calculator() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"rsc" | "sheet">("rsc");
  const [ply, setPly] = useState<string>("5");
  const [boxName, setBoxName] = useState<string>("");
  const [boxDescription, setBoxDescription] = useState<string>("");
  
  // Dimension settings
  const [inputUnit, setInputUnit] = useState<"mm" | "inches">("mm");
  const [measuredOn, setMeasuredOn] = useState<"ID" | "OD">("ID");
  
  // RSC dimensions (stored internally as mm)
  const [rscLength, setRscLength] = useState<string>("");
  const [rscWidth, setRscWidth] = useState<string>("");
  const [rscHeight, setRscHeight] = useState<string>("");
  
  // Sheet dimensions (stored internally as mm)
  const [sheetLength, setSheetLength] = useState<string>("");
  const [sheetWidth, setSheetWidth] = useState<string>("");
  
  // Allowances
  const [glueFlap, setGlueFlap] = useState<string>("60");
  const [deckleAllowance, setDeckleAllowance] = useState<string>("30");
  const [sheetAllowance, setSheetAllowance] = useState<string>("10");
  const [maxLengthThreshold, setMaxLengthThreshold] = useState<string>("1500");
  
  // Paper specifications - Layer by layer (initialized with 5 layers for default ply=5)
  const [layers, setLayers] = useState<Array<{ gsm: string; bf: string; flutingFactor: string; rctValue: string; rate: string; layerType: "liner" | "flute"; shade: string }>>(
    createLayersForPly(5)
  );
  
  // Paper Mill and Board Thickness
  const [paperMill, setPaperMill] = useState<string>("");
  const [customBoardThickness, setCustomBoardThickness] = useState<string>("");
  
  // Update layers when ply changes
  const updateLayersForPly = (newPly: string) => {
    const plyNum = parseInt(newPly);
    setLayers(createLayersForPly(plyNum));
  };
  
  // Printing Cost Details
  const [costPerPrint, setCostPerPrint] = useState<string>("0");
  const [plateCost, setPlateCost] = useState<string>("0");
  const [printMoq, setPrintMoq] = useState<string>("0");
  
  // Lamination Cost Details
  const [laminationRate, setLaminationRate] = useState<string>("0"); // Rate per sq inch
  const [customLaminationL, setCustomLaminationL] = useState<string>("");
  const [customLaminationW, setCustomLaminationW] = useState<string>("");
  const [showLaminationCustomize, setShowLaminationCustomize] = useState(false);
  
  // Die Cost Details
  const [dieDevelopmentCharge, setDieDevelopmentCharge] = useState<string>("0");
  
  // Varnish and Punching costs
  const [varnishCost, setVarnishCost] = useState<string>("0");
  const [punchingCost, setPunchingCost] = useState<string>("0");
  
  const [quantity, setQuantity] = useState<string>("1000");
  
  // Quote management
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [partyName, setPartyName] = useState<string>("");
  const [customerCompany, setCustomerCompany] = useState<string>("");
  const [customerEmail, setCustomerEmail] = useState<string>("");
  const [customerMobile, setCustomerMobile] = useState<string>("");
  
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showQuotesDialog, setShowQuotesDialog] = useState(false);
  const [showMessageDialog, setShowMessageDialog] = useState<"whatsapp" | "email" | null>(null);
  
  // Fetch default company profile
  const { data: companyProfile, isLoading: isLoadingProfile } = useQuery<CompanyProfile>({
    queryKey: ["/api/company-profiles/default"],
  });
  
  // Fetch all quotes
  const { data: savedQuotes = [], isLoading: isLoadingQuotes } = useQuery<Quote[]>({
    queryKey: ["/api/quotes"],
  });
  
  // Fetch app settings
  const { data: appSettings } = useQuery<AppSettings>({
    queryKey: ["/api/settings"],
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
  
  // Helper to convert input dimensions to mm if needed
  const toMm = (value: number) => inputUnit === "inches" ? inchesToMm(value) : value;
  
  // Helper to adjust dimensions for ID/OD
  const adjustForMeasurement = (length: number, width: number, height?: number) => {
    if (measuredOn === "OD") {
      const thickness = (appSettings?.plyThicknessMap as any)?.[ply] || PLY_THICKNESS[ply];
      return {
        length: length - (2 * thickness),
        width: width - (2 * thickness),
        height: height ? height - thickness : undefined,
      };
    }
    return { length, width, height };
  };
  
  const calculateRSC = (): CalculationResult | null => {
    const L = parseFloat(rscLength);
    const W = parseFloat(rscWidth);
    const H = parseFloat(rscHeight);
    
    if (!L || !W || !H) return null;
    
    // Convert to mm and adjust for ID/OD
    const adjusted = adjustForMeasurement(toMm(L), toMm(W), toMm(H));
    
    const gf = parseFloat(glueFlap) || 50;
    const da = parseFloat(deckleAllowance) || 30;
    const maxThreshold = parseFloat(maxLengthThreshold) || undefined;
    
    // Calculate sheet dimensions
    const { sheetLength: sheetLen, sheetWidth: sheetWid, additionalFlapApplied } = calculateRSCSheet({
      length: adjusted.length,
      width: adjusted.width,
      height: adjusted.height!,
      glueFlap: gf,
      deckleAllowance: da,
      maxLengthThreshold: maxThreshold,
      ply,
    });
    
    // Create layer specs from all layers
    const layerSpecs: LayerSpec[] = layers.map((layer, idx) => ({
      layerIndex: idx,
      layerType: layer.layerType,
      gsm: parseFloat(layer.gsm) || 180,
      bf: parseFloat(layer.bf) || 12,
      flutingFactor: parseFloat(layer.flutingFactor) || 1.5,
      rctValue: parseFloat(layer.rctValue) || 0,
      shade: layer.shade,
      rate: parseFloat(layer.rate) || 55,
    }));
    
    // Calculate weight, BS, and costs
    const weight = calculateSheetWeight({ sheetLength: sheetLen, sheetWidth: sheetWid, layerSpecs, ply });
    const bs = calculateBurstStrength(layerSpecs);
    const paperCost = calculatePaperCost(weight, layerSpecs);
    
    // Calculate strength metrics
    const boardThickness = customBoardThickness ? parseFloat(customBoardThickness) : calculateBoardThickness(ply, layerSpecs, appSettings?.plyThicknessMap as any || PLY_THICKNESS);
    const boxPerimeter = 2 * (adjusted.length + adjusted.width);
    const ect = calculateECT(layerSpecs);
    const bct = calculateMcKeeFormula({ ect, boardThickness, boxPerimeter });
    
    return {
      sheetLength: sheetLen,
      sheetWidth: sheetWid,
      sheetWeight: weight,
      bs,
      paperCost,
      boardThickness,
      boxPerimeter,
      ect,
      bct,
    };
  };
  
  const calculateSheet = (): CalculationResult | null => {
    const L = parseFloat(sheetLength);
    const W = parseFloat(sheetWidth);
    
    if (!L || !W) return null;
    
    // Convert to mm
    const lengthMm = toMm(L);
    const widthMm = toMm(W);
    
    const allowance = parseFloat(sheetAllowance) || 10;
    
    // Calculate sheet dimensions
    const { sheetLength: sheetLen, sheetWidth: sheetWid } = calculateFlatSheet({
      length: lengthMm,
      width: widthMm,
      allowance,
    });
    
    // Create layer specs from all layers
    const layerSpecs: LayerSpec[] = layers.map((layer, idx) => ({
      layerIndex: idx,
      layerType: layer.layerType,
      gsm: parseFloat(layer.gsm) || 180,
      bf: parseFloat(layer.bf) || 12,
      flutingFactor: parseFloat(layer.flutingFactor) || 1.5,
      rctValue: parseFloat(layer.rctValue) || 0,
      shade: layer.shade,
      rate: parseFloat(layer.rate) || 55,
    }));
    
    // Calculate weight, BS, and costs
    const weight = calculateSheetWeight({ sheetLength: sheetLen, sheetWidth: sheetWid, layerSpecs, ply });
    const bs = calculateBurstStrength(layerSpecs);
    const paperCost = calculatePaperCost(weight, layerSpecs);
    
    // Calculate strength metrics (for reference, though less relevant for sheets)
    const boardThickness = customBoardThickness ? parseFloat(customBoardThickness) : calculateBoardThickness(ply, layerSpecs, appSettings?.plyThicknessMap as any || PLY_THICKNESS);
    const boxPerimeter = 2 * (lengthMm + widthMm);
    const ect = calculateECT(layerSpecs);
    const bct = calculateMcKeeFormula({ ect, boardThickness, boxPerimeter });
    
    return {
      sheetLength: sheetLen,
      sheetWidth: sheetWid,
      sheetWeight: weight,
      bs,
      paperCost,
      boardThickness,
      boxPerimeter,
      ect,
      bct,
    };
  };
  
  const result = activeTab === "rsc" ? calculateRSC() : calculateSheet();
  
  // Calculate detailed manufacturing costs
  const calculateManufacturingCosts = () => {
    if (!result) return { printing: 0, lamination: 0, varnish: 0, die: 0, punching: 0 };
    
    const qty = parseFloat(quantity) || 1;
    
    // Printing Cost: costPerPrint + (plateCost / qty) + MOQ adjustment
    let printingTotal = 0;
    const costPer = parseFloat(costPerPrint) || 0;
    const plateCharge = parseFloat(plateCost) || 0;
    const moq = parseFloat(printMoq) || 0;
    printingTotal = costPer + (plateCharge / qty);
    if (moq > qty) {
      printingTotal += (costPer * (moq - qty)) / qty;
    }
    
    // Lamination Cost: (L inches * W inches * Rate per sq inch) / 100
    let laminationTotal = 0;
    const laminationRateValue = parseFloat(laminationRate) || 0;
    if (laminationRateValue > 0) {
      const useCustom = showLaminationCustomize && customLaminationL && customLaminationW;
      const L = useCustom ? parseFloat(customLaminationL) : mmToInches(result.sheetLength);
      const W = useCustom ? parseFloat(customLaminationW) : mmToInches(result.sheetWidth);
      laminationTotal = (L * W * laminationRateValue) / 100;
    }
    
    // Die Cost: dieDevelopmentCharge / qty
    const dieCharge = parseFloat(dieDevelopmentCharge) || 0;
    const dieTotal = dieCharge / qty;
    
    const varnishTotal = parseFloat(varnishCost) || 0;
    const punchingTotal = parseFloat(punchingCost) || 0;
    
    return { printing: printingTotal, lamination: laminationTotal, varnish: varnishTotal, die: dieTotal, punching: punchingTotal };
  };
  
  const mfgCosts = calculateManufacturingCosts();
  
  // Calculate total cost including manufacturing costs
  const totalCostPerBox = result ? calculateTotalCost({
    paperCost: result.paperCost,
    printingCost: mfgCosts.printing,
    laminationCost: mfgCosts.lamination,
    varnishCost: mfgCosts.varnish,
    dieCost: mfgCosts.die,
    punchingCost: mfgCosts.punching,
    markup: 15,
  }) : 0;
  
  const qty = parseFloat(quantity) || 1000;
  const totalValue = totalCostPerBox * qty;
  
  const handleAddToQuote = () => {
    if (!result) {
      toast({
        title: "Error",
        description: "Please enter valid dimensions first.",
        variant: "destructive",
      });
      return;
    }
    
    // Create layer specs from all layers
    const layerSpecs: LayerSpec[] = layers.map((layer, idx) => ({
      layerIndex: idx,
      layerType: layer.layerType,
      gsm: parseFloat(layer.gsm) || 180,
      bf: parseFloat(layer.bf) || 12,
      flutingFactor: parseFloat(layer.flutingFactor) || 1.5,
      rctValue: parseFloat(layer.rctValue) || 0,
      shade: layer.shade,
      rate: parseFloat(layer.rate) || 55,
    }));
    
    const item: QuoteItem = {
      type: activeTab,
      boxName: boxName || `${ply}-Ply ${activeTab === "rsc" ? "Box" : "Sheet"}`,
      boxDescription: boxDescription || undefined,
      ply: ply as "1" | "3" | "5" | "7" | "9",
      
      // Dimensional metadata
      inputUnit,
      measuredOn,
      plyThicknessUsed: (appSettings?.plyThicknessMap as any)?.[ply] || PLY_THICKNESS[ply],
      
      // Dimensions (stored in mm)
      length: activeTab === "rsc" ? toMm(parseFloat(rscLength)) : toMm(parseFloat(sheetLength)),
      width: activeTab === "rsc" ? toMm(parseFloat(rscWidth)) : toMm(parseFloat(sheetWidth)),
      height: activeTab === "rsc" ? toMm(parseFloat(rscHeight)) : undefined,
      
      // Allowances and thresholds
      glueFlap: parseFloat(glueFlap) || 50,
      deckleAllowance: parseFloat(deckleAllowance) || 30,
      sheetAllowance: parseFloat(sheetAllowance) || 10,
      maxLengthThreshold: parseFloat(maxLengthThreshold) || undefined,
      additionalFlapApplied: false,
      
      // Calculated sheet sizes
      sheetLength: result.sheetLength,
      sheetWidth: result.sheetWidth,
      sheetLengthInches: mmToInches(result.sheetLength),
      sheetWidthInches: mmToInches(result.sheetWidth),
      sheetWeight: result.sheetWeight,
      
      // Strength analysis
      boardThickness: result.boardThickness,
      boxPerimeter: result.boxPerimeter,
      ect: result.ect,
      bct: result.bct,
      bs: result.bs,
      
      // Paper specifications
      layerSpecs,
      
      // Costs
      paperCost: result.paperCost,
      printingCost: mfgCosts.printing,
      laminationCost: mfgCosts.lamination,
      varnishCost: mfgCosts.varnish,
      dieCost: mfgCosts.die,
      punchingCost: mfgCosts.punching,
      totalCostPerBox,
      quantity: qty,
      totalValue: totalValue,
    };
    
    setQuoteItems([...quoteItems, item]);
    
    // Reset form
    setBoxName("");
    setBoxDescription("");
    if (activeTab === "rsc") {
      setRscLength("");
      setRscWidth("");
      setRscHeight("");
    } else {
      setSheetLength("");
      setSheetWidth("");
    }
    setQuantity("1000");
    // Reset manufacturing costs
    setCostPerPrint("0");
    setPlateCost("0");
    setPrintMoq("0");
    setLaminationRate("0");
    setCustomLaminationL("");
    setCustomLaminationW("");
    setShowLaminationCustomize(false);
    setDieDevelopmentCharge("0");
    setVarnishCost("0");
    setPunchingCost("0");
    
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
                  {appSettings?.appTitle || "Box Costing Calculator"}
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
                    <CardDescription>
                      Enter dimensions ({inputUnit}) - Measured on {measuredOn}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
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
                      <div className="space-y-2">
                        <Label htmlFor="box-description-rsc">Box Description (Optional)</Label>
                        <Input
                          id="box-description-rsc"
                          placeholder="e.g., Heavy duty corrugated"
                          value={boxDescription}
                          onChange={(e) => setBoxDescription(e.target.value)}
                          data-testid="input-box-description"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="input-unit">Input Unit</Label>
                        <Select value={inputUnit} onValueChange={(v: "mm" | "inches") => setInputUnit(v)}>
                          <SelectTrigger id="input-unit" data-testid="select-input-unit">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="mm">Millimeters (mm)</SelectItem>
                            <SelectItem value="inches">Inches (in)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="measured-on">Measured On</Label>
                        <Select value={measuredOn} onValueChange={(v: "ID" | "OD") => setMeasuredOn(v)}>
                          <SelectTrigger id="measured-on" data-testid="select-measured-on">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ID">Inside Dimension (ID)</SelectItem>
                            <SelectItem value="OD">Outside Dimension (OD)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="rsc-length">Length ({inputUnit})</Label>
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
                        <Label htmlFor="rsc-width">Width ({inputUnit})</Label>
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
                        <Label htmlFor="rsc-height">Height ({inputUnit})</Label>
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
                    
                    <div className="grid grid-cols-3 gap-4">
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
                      <div className="space-y-2">
                        <Label htmlFor="max-length-threshold">Max Length Threshold (mm)</Label>
                        <Input
                          id="max-length-threshold"
                          type="number"
                          value={maxLengthThreshold}
                          onChange={(e) => setMaxLengthThreshold(e.target.value)}
                          data-testid="input-max-length-threshold"
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
                <CardTitle>Paper Specifications (Layer by Layer)</CardTitle>
                <CardDescription>Configure paper properties for each layer</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ply">Ply Configuration</Label>
                    <Select value={ply} onValueChange={(v) => {
                      setPly(v);
                      setGlueFlap(GLUE_FLAP_DEFAULTS[v].toString());
                      updateLayersForPly(v);
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
                  <div className="space-y-2">
                    <Label htmlFor="paper-mill">Paper Mill Name</Label>
                    <Input
                      id="paper-mill"
                      placeholder="e.g., Smurfit India"
                      value={paperMill}
                      onChange={(e) => setPaperMill(e.target.value)}
                      data-testid="input-paper-mill"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="board-thickness">Board Thickness (mm)</Label>
                    <Input
                      id="board-thickness"
                      type="number"
                      step="0.01"
                      placeholder="3.5"
                      value={customBoardThickness}
                      onChange={(e) => setCustomBoardThickness(e.target.value)}
                      data-testid="input-board-thickness"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Layer</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>GSM</TableHead>
                        <TableHead>BF</TableHead>
                        <TableHead>Fluting Factor</TableHead>
                        <TableHead>RCT Value</TableHead>
                        <TableHead>Rate (₹/kg)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {layers.map((layer, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">L{idx + 1}</TableCell>
                          <TableCell className="capitalize">{layer.layerType}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={layer.gsm}
                              onChange={(e) => {
                                const newLayers = [...layers];
                                newLayers[idx].gsm = e.target.value;
                                setLayers(newLayers);
                              }}
                              className="w-20"
                              data-testid={`input-gsm-${idx}`}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={layer.bf}
                              onChange={(e) => {
                                const newLayers = [...layers];
                                newLayers[idx].bf = e.target.value;
                                setLayers(newLayers);
                              }}
                              className="w-16"
                              data-testid={`input-bf-${idx}`}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.1"
                              value={layer.flutingFactor}
                              onChange={(e) => {
                                const newLayers = [...layers];
                                newLayers[idx].flutingFactor = e.target.value;
                                setLayers(newLayers);
                              }}
                              disabled={layer.layerType === "liner"}
                              className="w-20 disabled:opacity-50 disabled:cursor-not-allowed"
                              data-testid={`input-fluting-factor-${idx}`}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={layer.rctValue}
                              onChange={(e) => {
                                const newLayers = [...layers];
                                newLayers[idx].rctValue = e.target.value;
                                setLayers(newLayers);
                              }}
                              className="w-16"
                              data-testid={`input-rct-${idx}`}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={layer.rate}
                              onChange={(e) => {
                                const newLayers = [...layers];
                                newLayers[idx].rate = e.target.value;
                                setLayers(newLayers);
                              }}
                              className="w-20"
                              data-testid={`input-rate-${idx}`}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Fixed & Manufacturing Costs</CardTitle>
                <CardDescription>Detailed cost breakdown per unit (₹)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label className="font-semibold mb-3 block">Printing Cost</Label>
                  <div className="grid grid-cols-2 gap-4 pl-4 border-l-2 border-muted">
                    <div className="space-y-2">
                      <Label htmlFor="cost-per-print" className="text-sm">Cost Per Print (₹)</Label>
                      <Input
                        id="cost-per-print"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={costPerPrint}
                        onChange={(e) => setCostPerPrint(e.target.value)}
                        data-testid="input-cost-per-print"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="plate-cost" className="text-sm">Plates Development Charge (₹)</Label>
                      <Input
                        id="plate-cost"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={plateCost}
                        onChange={(e) => setPlateCost(e.target.value)}
                        data-testid="input-plate-cost"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="print-moq" className="text-sm">MOQ (Minimum Order Qty)</Label>
                      <Input
                        id="print-moq"
                        type="number"
                        placeholder="0"
                        value={printMoq}
                        onChange={(e) => setPrintMoq(e.target.value)}
                        data-testid="input-print-moq"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Total Cost Per Print</Label>
                      <div className="px-3 py-2 bg-muted rounded text-sm font-medium">
                        ₹{mfgCosts.printing.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="font-semibold mb-3 block">Lamination Cost</Label>
                  <div className="space-y-4 pl-4 border-l-2 border-muted">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="lamination-rate" className="text-sm">Rate per Sq Inch (₹)</Label>
                        <Input
                          id="lamination-rate"
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={laminationRate}
                          onChange={(e) => setLaminationRate(e.target.value)}
                          data-testid="input-lamination-rate"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-muted-foreground">Calculated Cost</Label>
                        <div className="px-3 py-2 bg-muted rounded text-sm font-medium">
                          ₹{mfgCosts.lamination.toFixed(2)}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowLaminationCustomize(!showLaminationCustomize)}
                      data-testid="button-customize-lamination"
                    >
                      {showLaminationCustomize ? "Use Auto Dimensions" : "Customize Dimensions"}
                    </Button>
                    {showLaminationCustomize && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="custom-lam-l" className="text-sm">Custom Length (inches)</Label>
                          <Input
                            id="custom-lam-l"
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={customLaminationL}
                            onChange={(e) => setCustomLaminationL(e.target.value)}
                            data-testid="input-custom-lamination-l"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="custom-lam-w" className="text-sm">Custom Width (inches)</Label>
                          <Input
                            id="custom-lam-w"
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={customLaminationW}
                            onChange={(e) => setCustomLaminationW(e.target.value)}
                            data-testid="input-custom-lamination-w"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <Label className="font-semibold mb-3 block">Die Cost</Label>
                  <div className="grid grid-cols-2 gap-4 pl-4 border-l-2 border-muted">
                    <div className="space-y-2">
                      <Label htmlFor="die-charge" className="text-sm">Die Development Charge (₹)</Label>
                      <Input
                        id="die-charge"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={dieDevelopmentCharge}
                        onChange={(e) => setDieDevelopmentCharge(e.target.value)}
                        data-testid="input-die-charge"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Cost Per Box</Label>
                      <div className="px-3 py-2 bg-muted rounded text-sm font-medium">
                        ₹{mfgCosts.die.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="varnish-cost">Varnish Cost (₹/unit)</Label>
                    <Input
                      id="varnish-cost"
                      type="number"
                      step="0.01"
                      value={varnishCost}
                      onChange={(e) => setVarnishCost(e.target.value)}
                      data-testid="input-varnish-cost"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="punching-cost">Punching Cost (₹/unit)</Label>
                    <Input
                      id="punching-cost"
                      type="number"
                      step="0.01"
                      value={punchingCost}
                      onChange={(e) => setPunchingCost(e.target.value)}
                      data-testid="input-punching-cost"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Calculated Sheet Blank Size</CardTitle>
                <CardDescription>Dimensions and specifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {result ? (
                  <>
                    <div className="space-y-2">
                      <div className="text-sm font-semibold text-foreground mb-2">Sheet Cut Length (L-blank):</div>
                      <div className="flex justify-between text-sm pl-2">
                        <span className="text-muted-foreground">Length (mm):</span>
                        <span className="font-medium" data-testid="text-sheet-length-mm">
                          {result.sheetLength.toFixed(2)} mm
                        </span>
                      </div>
                      <div className="flex justify-between text-sm pl-2">
                        <span className="text-muted-foreground">Length (inches):</span>
                        <span className="font-medium" data-testid="text-sheet-length-in">
                          {mmToInches(result.sheetLength).toFixed(2)} in
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="text-sm font-semibold text-foreground mb-2">Reel Size / Deckle (W-blank):</div>
                      <div className="flex justify-between text-sm pl-2">
                        <span className="text-muted-foreground">Width (mm):</span>
                        <span className="font-medium" data-testid="text-sheet-width-mm">
                          {result.sheetWidth.toFixed(2)} mm
                        </span>
                      </div>
                      <div className="flex justify-between text-sm pl-2">
                        <span className="text-muted-foreground">Width (inches):</span>
                        <span className="font-medium" data-testid="text-sheet-width-in">
                          {mmToInches(result.sheetWidth).toFixed(2)} in
                        </span>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Calculated Sheet Weight:</span>
                        <span className="font-medium" data-testid="text-sheet-weight">
                          {result.sheetWeight.toFixed(3)} Kg
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Calculated Box BS:</span>
                        <span className="font-medium" data-testid="text-bs">
                          {result.bs.toFixed(2)} kg/cm
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Enter dimensions to see calculated values</p>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Strength Analysis (McKee Formula)</CardTitle>
                <CardDescription>Box compression test predictions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {result ? (
                  <>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Board Thickness (mm):</span>
                        <span className="font-medium" data-testid="text-board-thickness">
                          {result.boardThickness.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Box Perimeter (mm):</span>
                        <span className="font-medium" data-testid="text-box-perimeter">
                          {result.boxPerimeter.toFixed(0)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Calculated ECT:</span>
                        <span className="font-medium" data-testid="text-ect">
                          {result.ect.toFixed(2)} kN/m
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Predicted BCT:</span>
                        <span className="font-medium" data-testid="text-bct">
                          {result.bct.toFixed(1)} Kg
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Enter dimensions to see strength analysis</p>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Cost Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {result ? (
                  <>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Cost/unit:</span>
                        <span className="font-bold text-lg" data-testid="text-cost-per-unit">
                          ₹{totalCostPerBox.toFixed(2)}
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
                <div className="flex justify-between items-center gap-4">
                  <div>
                    <CardTitle>Quote Items</CardTitle>
                    <CardDescription>{quoteItems.length} items</CardDescription>
                  </div>
                  {quoteItems.length > 0 && <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        const message = generateWhatsAppMessage(quoteItems, partyName || "Customer", customerCompany || "Company");
                        navigator.clipboard.writeText(message);
                        toast({ title: "Copied to clipboard", description: "WhatsApp message ready to share" });
                        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
                      }}
                      data-testid="button-whatsapp"
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      WhatsApp
                    </Button>
                    
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        const { subject, body } = generateEmailContent(quoteItems, partyName || "Customer", customerCompany || "Company", companyProfile);
                        window.location.href = `mailto:${customerEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                      }}
                      data-testid="button-email"
                    >
                      <Mail className="w-4 h-4 mr-2" />
                      Email
                    </Button>

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
                          <DialogDescription>Enter customer details to save this quote</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="party-name">Party Name *</Label>
                            <Input id="party-name" placeholder="Mr. John Doe" value={partyName} onChange={(e) => setPartyName(e.target.value)} data-testid="input-party-name" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="customer-company">Company Name</Label>
                            <Input id="customer-company" placeholder="ABC Enterprises" value={customerCompany} onChange={(e) => setCustomerCompany(e.target.value)} data-testid="input-customer-company" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="customer-email">Email</Label>
                            <Input id="customer-email" type="email" placeholder="contact@company.com" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} data-testid="input-customer-email" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="customer-mobile">Mobile</Label>
                            <Input id="customer-mobile" placeholder="9876543210" value={customerMobile} onChange={(e) => setCustomerMobile(e.target.value)} data-testid="input-customer-mobile" />
                          </div>
                          <Button onClick={handleSaveQuote} className="w-full" disabled={saveQuoteMutation.isPending} data-testid="button-confirm-save">
                            {saveQuoteMutation.isPending ? "Saving..." : "Save Quote"}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>}
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
