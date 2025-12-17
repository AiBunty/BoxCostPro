import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, FileText, Plus, Trash2, Save, Building2, MessageCircle, Mail, Copy, Download, Users, Building, Upload, ChevronDown, Settings, FileSpreadsheet, Info, Pencil, LogOut, User, Tag, Percent, DollarSign, History, RotateCcw } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FlutingSettings, FLUTE_COMBINATIONS, getFlutingFactorForCombination } from "@/components/FlutingSettings";
import brandLogo from "@assets/Untitled_(Invitation_(Square))_(2)_1765696414282.png";
import { FlutingOnboarding } from "@/components/FlutingOnboarding";
import { Link } from "wouter";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { QuoteItem, CompanyProfile, Quote, AppSettings, LayerSpec } from "@shared/schema";
import { generateWhatsAppMessage, generateEmailContent } from "@/lib/messageGenerator";
import { downloadExcel, downloadQuotePDF, downloadSampleTemplate, parseExcelUpload } from "@/lib/excelExport";
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
  '3': 45.0,
  '5': 50.0,
  '7': 60.0,
  '9': 70.0,
};

const DECKLE_ALLOWANCE_DEFAULTS: Record<string, number> = {
  '1': 30.0,
  '3': 25.0,
  '5': 30.0,
  '7': 35.0,
  '9': 40.0,
};

const PLY_THICKNESS: Record<string, number> = {
  '1': 0.45,
  '3': 3,
  '5': 5,
  '7': 7,
  '9': 11,
};

interface CalculationResult {
  sheetLength: number;
  sheetWidth: number;
  sheetWeight: number;
  layerWeights: number[];
  bs: number;
  paperCost: number;
  boardThickness: number;
  boxPerimeter: number;
  ect: number;
  bct: number;
  layerSpecs: LayerSpec[];
}

// Helper function to create layers for a given ply count with specific defaults
const createLayersForPly = (plyNum: number) => {
  const defaultLayers = [];
  for (let i = 0; i < plyNum; i++) {
    // Determine layer type (liner vs flute)
    let isFlute = false;
    let flutingFactorValue = "1.0";
    let gsm = "120";
    let bf = "18";
    let shade = "Kraft/Natural";
    
    if (plyNum === 3) {
      // 3-ply: L1 Liner, L2 Flute, L3 Liner
      isFlute = i === 1;
      flutingFactorValue = isFlute ? "1.5" : "1.0";
      gsm = i === 0 ? "180" : "150";
      bf = i === 0 ? "24" : "18";
      shade = i === 0 ? "Golden Kraft" : "Kraft/Natural";
    } else if (plyNum === 5) {
      // 5-ply: L1, L3, L5 Liner (indices 0, 2, 4), L2, L4 Flute (indices 1, 3)
      isFlute = i === 1 || i === 3;
      flutingFactorValue = isFlute ? "1.5" : "1.0";
      gsm = i === 0 ? "180" : "120";
      bf = i === 0 ? "24" : "18";
      shade = i === 0 ? "Golden Kraft" : "Kraft/Natural";
    } else if (plyNum === 7) {
      // 7-ply: L1, L3, L5, L7 Liner (indices 0, 2, 4, 6), L2, L4, L6 Flute (indices 1, 3, 5)
      isFlute = i === 1 || i === 3 || i === 5;
      flutingFactorValue = isFlute ? "1.5" : "1.0";
      gsm = i === 0 ? "180" : "120";
      bf = i === 0 ? "24" : "18";
      shade = i === 0 ? "Golden Kraft" : "Kraft/Natural";
    } else if (plyNum === 9) {
      // 9-ply: L1, L3, L5, L7, L9 Liner (indices 0, 2, 4, 6, 8), L2, L4, L6, L8 Flute (indices 1, 3, 5, 7)
      isFlute = i === 1 || i === 3 || i === 5 || i === 7;
      flutingFactorValue = isFlute ? "1.5" : "1.0";
      gsm = i === 0 ? "180" : "120";
      bf = i === 0 ? "24" : "18";
      shade = i === 0 ? "Golden Kraft" : "Kraft/Natural";
    } else {
      // 1-ply: just liner
      isFlute = false;
      flutingFactorValue = "1.0";
      gsm = "180";
      bf = "24";
      shade = "Golden Kraft";
    }
    
    defaultLayers.push({
      gsm,
      bf,
      flutingFactor: flutingFactorValue,
      rctValue: "0",
      rate: "55.00",
      layerType: isFlute ? "flute" as const : "liner" as const,
      shade,
    });
  }
  return defaultLayers;
};

export default function Calculator() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"rsc" | "sheet">("rsc");
  const [ply, setPly] = useState<string>("5");
  const [fluteCombination, setFluteCombination] = useState<string>("BC");
  const [fluteSettings, setFluteSettings] = useState<Record<string, number>>({
    'A': 1.55, 'B': 1.35, 'C': 1.45, 'E': 1.25, 'F': 1.20
  });
  const [boxName, setBoxName] = useState<string>("");
  const [boxDescription, setBoxDescription] = useState<string>("");
  
  // Dimension settings
  const [inputUnit, setInputUnit] = useState<"mm" | "inches">("mm");
  const [measuredOn, setMeasuredOn] = useState<"ID" | "OD">("OD");
  
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
  
  // Conversion Cost
  const [conversionCost, setConversionCost] = useState<string>("15"); // INR/Kg - Default Rs.15
  
  const [quantity, setQuantity] = useState<string>("1000");
  
  // Quote management
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [partyName, setPartyName] = useState<string>("");
  const [customerCompany, setCustomerCompany] = useState<string>("");
  const [customerEmail, setCustomerEmail] = useState<string>("");
  const [customerMobile, setCustomerMobile] = useState<string>("");
  
  // Payment and Delivery terms
  const [paymentTerms, setPaymentTerms] = useState<string>(localStorage.getItem("lastPaymentTerms") || "");
  const [deliveryDays, setDeliveryDays] = useState<string>(localStorage.getItem("lastDeliveryDays") || "");
  
  // Transport Charge
  const [transportCharge, setTransportCharge] = useState<string>("");
  const [transportRemark, setTransportRemark] = useState<string>("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showQuotesDialog, setShowQuotesDialog] = useState(false);
  const [showMessageDialog, setShowMessageDialog] = useState<"whatsapp" | "email" | null>(null);
  const [showBusinessProfile, setShowBusinessProfile] = useState(false);
  const [showPartyProfile, setShowPartyProfile] = useState(false);
  
  // Business Profile state
  const [businessCompanyName, setBusinessCompanyName] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [businessGst, setBusinessGst] = useState("");
  const [businessWebsite, setBusinessWebsite] = useState("");
  const [businessSocial, setBusinessSocial] = useState("");
  const [businessLocation, setBusinessLocation] = useState("");
  const [editingProfileId, setEditingProfileId] = useState<string>("");
  const [businessSearchTerm, setBusinessSearchTerm] = useState("");
  
  // Party Profile state
  const [partyPersonName, setPartyPersonName] = useState("");
  const [partyCompanyName, setPartyCompanyName] = useState("");
  const [partyMobile, setPartyMobile] = useState("");
  const [partyEmail, setPartyEmail] = useState("");
  const [partyGst, setPartyGst] = useState("");
  const [partyAddress, setPartyAddress] = useState("");
  const [editingPartyId, setEditingPartyId] = useState<string>("");
  const [partySearchTerm, setPartySearchTerm] = useState("");
  
  // Quote search state
  const [quoteSearchCompany, setQuoteSearchCompany] = useState("");
  const [quoteSearchDate, setQuoteSearchDate] = useState("");
  const [quoteSearchBoxSize, setQuoteSearchBoxSize] = useState("");
  const [quoteSearchSheetSize, setQuoteSearchSheetSize] = useState("");
  const [quoteSearchBoxName, setQuoteSearchBoxName] = useState("");
  
  // Multiple profiles support
  const [allCompanyProfiles, setAllCompanyProfiles] = useState<CompanyProfile[]>([]);
  const [selectedCompanyProfileId, setSelectedCompanyProfileId] = useState<string>("");
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [allPartyProfiles, setAllPartyProfiles] = useState<any[]>([]);
  const [selectedPartyProfileId, setSelectedPartyProfileId] = useState<string>("");
  
  // Rate memory by BF + Shade combination
  const [rateMemory, setRateMemory] = useState<Record<string, string>>({});
  
  // Layer edit dialog state
  const [editingLayerIdx, setEditingLayerIdx] = useState<number | null>(null);
  const [editingLayerData, setEditingLayerData] = useState<any>(null);
  
  // Quote item edit dialog state
  const [editingQuoteItemIdx, setEditingQuoteItemIdx] = useState<number | null>(null);
  const [editingQuoteItemData, setEditingQuoteItemData] = useState<Partial<QuoteItem> | null>(null);
  
  // Negotiation dialog state
  const [negotiatingItemIdx, setNegotiatingItemIdx] = useState<number | null>(null);
  const [negotiationMode, setNegotiationMode] = useState<'none' | 'percentage' | 'fixed'>('none');
  const [negotiationValue, setNegotiationValue] = useState<string>('');
  
  // Version history dialog state
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [selectedSpecId, setSelectedSpecId] = useState<string | null>(null);
  
  // Message editing state
  const [editableWhatsAppMessage, setEditableWhatsAppMessage] = useState("");
  const [editableEmailBody, setEditableEmailBody] = useState("");
  const [editableEmailSubject, setEditableEmailSubject] = useState("");
  
  // Quote Items table column visibility
  const [visibleCostColumns, setVisibleCostColumns] = useState({
    paper: true,
    printing: true,
    lamination: true,
    varnish: true,
    die: true,
    punching: true,
  });
  
  // Fetch all company profiles
  const { data: allCompanyProfilesData = [], isLoading: isLoadingProfile } = useQuery<CompanyProfile[]>({
    queryKey: ["/api/company-profiles"],
  });
  
  // Fetch all party profiles
  const { data: allPartyProfilesData = [] } = useQuery<any[]>({
    queryKey: ["/api/party-profiles"],
  });
  
  // Set default company profile if not selected
  useEffect(() => {
    if (allCompanyProfilesData.length > 0) {
      setAllCompanyProfiles(allCompanyProfilesData);
      const defaultProfile = allCompanyProfilesData.find(p => p.isDefault);
      if (defaultProfile && !selectedCompanyProfileId) {
        setSelectedCompanyProfileId(defaultProfile.id);
      }
    }
  }, [allCompanyProfilesData]);
  
  useEffect(() => {
    setAllPartyProfiles(allPartyProfilesData);
  }, [allPartyProfilesData]);
  
  const companyProfile = allCompanyProfiles.find(p => p.id === selectedCompanyProfileId) || allCompanyProfiles[0];
  
  // Fetch all quotes
  const { data: savedQuotes = [], isLoading: isLoadingQuotes } = useQuery<Quote[]>({
    queryKey: ["/api/quotes"],
  });
  
  // Fetch app settings
  const { data: appSettings } = useQuery<AppSettings>({
    queryKey: ["/api/settings"],
  });

  // Fetch rate memory
  const { data: rateMemoryData = [] } = useQuery<any[]>({
    queryKey: ["/api/rate-memory"],
  });

  // Fetch BF prices, shade premiums, and pricing rules for auto-fill (new BF-based system)
  const { data: bfPricesData = [] } = useQuery<any[]>({
    queryKey: ["/api/paper-bf-prices"],
  });
  
  const { data: shadePremiumsData = [] } = useQuery<any[]>({
    queryKey: ["/api/shade-premiums"],
  });
  
  const { data: pricingRulesData } = useQuery<any>({
    queryKey: ["/api/paper-pricing-rules"],
  });

  // Fetch box specifications for history
  const { data: boxSpecifications = [] } = useQuery<any[]>({
    queryKey: ["/api/box-specifications"],
  });
  
  // Fetch versions for selected spec
  const { data: specVersions = [] } = useQuery<any[]>({
    queryKey: ["/api/box-specifications", selectedSpecId, "versions"],
    enabled: !!selectedSpecId,
  });

  // Restore version mutation
  const restoreVersionMutation = useMutation({
    mutationFn: async ({ specId, versionNumber }: { specId: string; versionNumber: number }) => {
      return await apiRequest("POST", `/api/box-specifications/${specId}/restore/${versionNumber}`, {});
    },
    onSuccess: (_, { specId }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/box-specifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/box-specifications", specId, "versions"] });
      toast({
        title: "Version restored",
        description: "The box specification has been restored to the selected version.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to restore version.",
        variant: "destructive",
      });
    }
  });

  // Lookup paper price using BF-based pricing system
  // Formula: BF Base Price + GSM Adjustment + Shade Premium + Market Adjustment
  const lookupPaperPrice = (gsm: number, bf: number, shade: string): number | null => {
    if (!bfPricesData || bfPricesData.length === 0) return null;
    
    // Find BF base price
    const bfMatch = bfPricesData.find((p: any) => p.bf === bf);
    if (!bfMatch) return null;
    
    const bfBasePrice = Number(bfMatch.basePrice) || 0;
    const rules = pricingRulesData || {};
    
    // Apply GSM adjustments
    let gsmAdjustment = 0;
    const lowLimit = rules.lowGsmLimit || 100;
    const highLimit = rules.highGsmLimit || 201;
    
    if (gsm < lowLimit) {
      gsmAdjustment = Number(rules.lowGsmAdjustment) || 0;
    } else if (gsm >= highLimit) {
      gsmAdjustment = Number(rules.highGsmAdjustment) || 0;
    }
    
    // Find shade premium (case-insensitive match)
    const shadeMatch = shadePremiumsData.find(
      (s: any) => s.shade.toLowerCase() === shade.toLowerCase()
    );
    const shadePremium = shadeMatch ? Number(shadeMatch.premium) || 0 : 0;
    
    // Market adjustment
    const marketAdjustment = Number(rules.marketAdjustment) || 0;
    
    return bfBasePrice + gsmAdjustment + shadePremium + marketAdjustment;
  };

  // Mutation to save rate memory
  const saveRateMemoryMutation = useMutation({
    mutationFn: async (data: { bfValue: string; shade: string; rate: number }) => {
      return await apiRequest("POST", "/api/rate-memory", data);
    },
    onError: (error) => {
      console.error("Failed to save rate memory:", error);
    }
  });
  
  // Save quote mutation
  const saveQuoteMutation = useMutation({
    mutationFn: async (data: {
      partyName: string;
      customerCompany: string;
      customerEmail: string;
      customerMobile: string;
      paymentTerms?: string;
      deliveryDays?: string;
      transportCharge?: number;
      transportRemark?: string;
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

  // Save business profile mutation
  const saveBusinessProfileMutation = useMutation({
    mutationFn: async (data: Partial<CompanyProfile>) => {
      if (editingProfileId) {
        return await apiRequest("PATCH", `/api/company-profiles/${editingProfileId}`, data);
      }
      return await apiRequest("POST", "/api/company-profiles", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company-profiles"] });
      toast({
        title: "Saved",
        description: "Business profile saved successfully.",
      });
      setShowBusinessProfile(false);
      setEditingProfileId("");
      setBusinessCompanyName("");
      setBusinessPhone("");
      setBusinessEmail("");
      setBusinessAddress("");
      setBusinessGst("");
      setBusinessWebsite("");
      setBusinessSocial("");
      setBusinessLocation("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save business profile.",
        variant: "destructive",
      });
    },
  });
  
  // Delete business profile mutation
  const deleteBusinessProfileMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/company-profiles/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company-profiles"] });
      toast({
        title: "Deleted",
        description: "Business profile deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete business profile.",
        variant: "destructive",
      });
    },
  });

  // Save party profile mutation
  const savePartyProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingPartyId) {
        return await apiRequest("PATCH", `/api/party-profiles/${editingPartyId}`, data);
      }
      return await apiRequest("POST", "/api/party-profiles", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/party-profiles"] });
      toast({
        title: "Saved",
        description: "Party profile saved successfully.",
      });
      setShowPartyProfile(false);
      setEditingPartyId("");
      setPartyPersonName("");
      setPartyCompanyName("");
      setPartyMobile("");
      setPartyEmail("");
      setPartyGst("");
      setPartyAddress("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save party profile.",
        variant: "destructive",
      });
    },
  });
  
  // Delete party profile mutation
  const deletePartyProfileMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/party-profiles/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/party-profiles"] });
      toast({
        title: "Deleted",
        description: "Party profile deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete party profile.",
        variant: "destructive",
      });
    },
  });
  
  // Sync business profile when company profile loads
  useEffect(() => {
    if (companyProfile && !editingProfileId) {
      setBusinessCompanyName(companyProfile.companyName || "");
      setBusinessPhone(companyProfile.phone || "");
      setBusinessEmail(companyProfile.email || "");
      setBusinessAddress(companyProfile.address || "");
      setBusinessGst(companyProfile.gstNo || "");
      setBusinessWebsite(companyProfile.website || "");
      setBusinessSocial(companyProfile.socialMedia || "");
      setBusinessLocation(companyProfile.googleLocation || "");
    }
  }, [companyProfile, editingProfileId]);

  // Load rate memory from API on mount
  useEffect(() => {
    if (rateMemoryData && rateMemoryData.length > 0) {
      const memoryMap: Record<string, string> = {};
      rateMemoryData.forEach((entry: any) => {
        const key = `${entry.bfValue}|${entry.shade}`;
        memoryMap[key] = entry.rate.toString();
      });
      setRateMemory(memoryMap);
    }
  }, [rateMemoryData]);
  
  // Download sample bulk upload Excel
  const handleDownloadSampleTemplate = () => {
    downloadSampleTemplate();
    toast({ title: "Downloaded", description: "Sample Excel template downloaded successfully." });
  };
  
  // Filter quotes based on search criteria
  const filteredQuotes = savedQuotes.filter(quote => {
    const dateMatch = !quoteSearchDate || new Date(quote.createdAt || "").toLocaleDateString().includes(quoteSearchDate);
    const companyMatch = !quoteSearchCompany || (quote.customerCompany || "").toLowerCase().includes(quoteSearchCompany.toLowerCase());
    const quoteItems = Array.isArray(quote.items) ? quote.items : [];
    const boxNameMatch = !quoteSearchBoxName || quoteItems.some((item: any) => item.boxName?.toLowerCase().includes(quoteSearchBoxName.toLowerCase()));
    return dateMatch && companyMatch && boxNameMatch;
  });
  
  // Copy layer specs (GSM, BF, RCT Value, Shade, Rate, and flutingFactor to even layers only)
  const copyLayerToFollowing = (fromIdx: number) => {
    const sourceLayer = layers[fromIdx];
    const newLayers = [...layers];
    
    for (let i = fromIdx + 1; i < newLayers.length; i++) {
      // Copy: gsm, bf, rctValue, shade, rate
      newLayers[i] = {
        ...newLayers[i],
        gsm: sourceLayer.gsm,
        bf: sourceLayer.bf,
        rctValue: sourceLayer.rctValue,
        shade: sourceLayer.shade,
        rate: sourceLayer.rate,
      };
      
      // Copy flutingFactor only to even layers (flute layers: index 1, 3, 5...)
      if (i % 2 === 1) {
        newLayers[i].flutingFactor = sourceLayer.flutingFactor;
      }
    }
    
    setLayers(newLayers);
    toast({
      title: "Copied",
      description: `Layer L${fromIdx + 1} copied to following layers`,
    });
  };
  
  // Bulk upload handler (Excel)
  const handleBulkUploadFile = async (file: File) => {
    try {
      const parsedData = await parseExcelUpload(file);
      
      if (parsedData.length === 0) {
        toast({ title: "Error", description: "No valid data found in Excel file", variant: "destructive" });
        return;
      }
      
      const items: QuoteItem[] = parsedData.map((row, idx) => {
        const itemLayers: LayerSpec[] = (row.layers || []).map((layer: any, layerIdx: number) => ({
          layerIndex: layerIdx,
          layerType: layer.layerType as "liner" | "flute",
          gsm: parseFloat(layer.gsm) || 180,
          bf: parseFloat(layer.bf) || 16,
          flutingFactor: layer.layerType === 'flute' ? (fluteSettings['B'] || 1.35) : 1.0,
          rctValue: parseFloat(layer.rctValue) || 5,
          shade: layer.shade || "Kraft",
          rate: parseFloat(layer.rate) || 45,
        }));
        
        const itemPly = row.ply || itemLayers.length.toString();
        const itemType = row.type === 'sheet' ? 'sheet' : 'rsc';
        const itemLength = parseFloat(row.length) || 0;
        const itemWidth = parseFloat(row.width) || 0;
        const itemHeight = parseFloat(row.height) || 0;
        const itemQuantity = parseInt(row.quantity) || 1000;
        
        // Calculate sheet dimensions based on type
        let sheetLen = 0;
        let sheetWid = 0;
        
        if (itemType === 'rsc' && itemLength && itemWidth && itemHeight) {
          const gf = GLUE_FLAP_DEFAULTS[itemPly] || 50;
          const da = DECKLE_ALLOWANCE_DEFAULTS[itemPly] || 30;
          const rscResult = calculateRSCSheet({
            length: itemLength,
            width: itemWidth,
            height: itemHeight,
            glueFlap: gf,
            deckleAllowance: da,
            ply: itemPly,
          });
          sheetLen = rscResult.sheetLength;
          sheetWid = rscResult.sheetWidth;
        } else if (itemType === 'sheet' && itemLength && itemWidth) {
          const flatResult = calculateFlatSheet({
            length: itemLength,
            width: itemWidth,
            allowance: 10,
          });
          sheetLen = flatResult.sheetLength;
          sheetWid = flatResult.sheetWidth;
        }
        
        // Calculate weight
        const weightResult = calculateSheetWeight({
          sheetLength: sheetLen,
          sheetWidth: sheetWid,
          layerSpecs: itemLayers,
          ply: itemPly,
        });
        
        // Calculate strength metrics
        const bs = calculateBurstStrength(itemLayers);
        const ect = calculateECT(itemLayers);
        const boardThickness = calculateBoardThickness(itemPly, itemLayers, PLY_THICKNESS);
        const boxPerimeter = 2 * (itemLength + itemWidth);
        const bct = calculateMcKeeFormula({ ect, boardThickness, boxPerimeter });
        
        // Calculate paper cost
        const paperCost = calculatePaperCost(weightResult.totalWeight, itemLayers);
        
        // Calculate conversion cost (default Rs.15/Kg)
        const conversionCostValue = parseFloat(conversionCost) || 15;
        const conversionCostPerItem = weightResult.totalWeight * conversionCostValue;
        
        // Calculate total cost per box (with 15% markup)
        const totalCostPerBox = calculateTotalCost({
          paperCost,
          printingCost: 0,
          laminationCost: 0,
          varnishCost: 0,
          dieCost: 0,
          punchingCost: 0,
          markup: 15,
        }) + conversionCostPerItem;
        
        const totalValue = totalCostPerBox * itemQuantity;
        
        return {
          id: Math.random().toString(36),
          boxName: row.boxName || `Box ${idx + 1}`,
          boxDescription: "",
          type: itemType,
          ply: itemPly,
          inputUnit: 'mm',
          measuredOn: 'ID',
          length: itemLength,
          width: itemWidth,
          height: itemHeight,
          sheetLength: sheetLen,
          sheetWidth: sheetWid,
          layerSpecs: itemLayers,
          quantity: itemQuantity,
          totalValue,
          paperCost,
          printingCost: 0,
          laminationCost: 0,
          varnishCost: 0,
          dieCost: 0,
          punchingCost: 0,
          totalCostPerBox,
          sheetWeight: weightResult.totalWeight,
          ect,
          bct,
          bs,
          selected: true,
        } as unknown as QuoteItem;
      });
      
      setQuoteItems([...quoteItems, ...items]);
      toast({ title: "Success", description: `${items.length} items imported from Excel` });
      setShowBulkUpload(false);
    } catch (error) {
      toast({ title: "Error", description: "Failed to parse Excel file. Please check the format.", variant: "destructive" });
    }
  };
  
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
    const weightResult = calculateSheetWeight({ sheetLength: sheetLen, sheetWidth: sheetWid, layerSpecs, ply });
    const bs = calculateBurstStrength(layerSpecs);
    const paperCost = calculatePaperCost(weightResult.totalWeight, layerSpecs);
    
    // Calculate strength metrics
    const boardThickness = customBoardThickness ? parseFloat(customBoardThickness) : calculateBoardThickness(ply, layerSpecs, appSettings?.plyThicknessMap as any || PLY_THICKNESS);
    const boxPerimeter = 2 * (adjusted.length + adjusted.width);
    const ect = calculateECT(layerSpecs);
    const bct = calculateMcKeeFormula({ ect, boardThickness, boxPerimeter });
    
    return {
      sheetLength: sheetLen,
      sheetWidth: sheetWid,
      sheetWeight: weightResult.totalWeight,
      layerWeights: weightResult.layerWeights,
      bs,
      paperCost,
      boardThickness,
      boxPerimeter,
      ect,
      bct,
      layerSpecs,
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
    const weightResult = calculateSheetWeight({ sheetLength: sheetLen, sheetWidth: sheetWid, layerSpecs, ply });
    const bs = calculateBurstStrength(layerSpecs);
    const paperCost = calculatePaperCost(weightResult.totalWeight, layerSpecs);
    
    // Calculate strength metrics (for reference, though less relevant for sheets)
    const boardThickness = customBoardThickness ? parseFloat(customBoardThickness) : calculateBoardThickness(ply, layerSpecs, appSettings?.plyThicknessMap as any || PLY_THICKNESS);
    const boxPerimeter = 2 * (lengthMm + widthMm);
    const ect = calculateECT(layerSpecs);
    const bct = calculateMcKeeFormula({ ect, boardThickness, boxPerimeter });
    
    return {
      sheetLength: sheetLen,
      sheetWidth: sheetWid,
      sheetWeight: weightResult.totalWeight,
      layerWeights: weightResult.layerWeights,
      bs,
      paperCost,
      boardThickness,
      boxPerimeter,
      ect,
      bct,
      layerSpecs,
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
  
  // Calculate conversion cost (Weight in Kg * Conversion Cost per Kg)
  const conversionCostPerBox = result ? (result.sheetWeight * parseFloat(conversionCost || "0")) : 0;
  
  // Calculate total cost including manufacturing costs
  const totalCostPerBox = result ? calculateTotalCost({
    paperCost: result.paperCost,
    printingCost: mfgCosts.printing,
    laminationCost: mfgCosts.lamination,
    varnishCost: mfgCosts.varnish,
    dieCost: mfgCosts.die,
    punchingCost: mfgCosts.punching,
    markup: 15,
  }) + conversionCostPerBox : 0;
  
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
      
      // Negotiation fields (default values)
      negotiationMode: 'none' as const,
      originalPrice: totalCostPerBox,
      
      selected: true,
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
  
  const handleEditQuoteItem = (index: number) => {
    const item = quoteItems[index];
    setEditingQuoteItemIdx(index);
    setEditingQuoteItemData({
      boxName: item.boxName,
      boxDescription: item.boxDescription,
      quantity: item.quantity,
      printingCost: item.printingCost || 0,
      laminationCost: item.laminationCost || 0,
      varnishCost: item.varnishCost || 0,
      dieCost: item.dieCost || 0,
      punchingCost: item.punchingCost || 0,
    });
  };
  
  const handleSaveEditedQuoteItem = () => {
    if (editingQuoteItemIdx === null || !editingQuoteItemData) return;
    
    const updatedItems = [...quoteItems];
    const item = updatedItems[editingQuoteItemIdx];
    const qty = editingQuoteItemData.quantity ?? item.quantity;
    
    // Get new per-box costs (user-edited values)
    const newPrintingCost = editingQuoteItemData.printingCost ?? item.printingCost ?? 0;
    const newLaminationCost = editingQuoteItemData.laminationCost ?? item.laminationCost ?? 0;
    const newVarnishCost = editingQuoteItemData.varnishCost ?? item.varnishCost ?? 0;
    const newDieCost = editingQuoteItemData.dieCost ?? item.dieCost ?? 0;
    const newPunchingCost = editingQuoteItemData.punchingCost ?? item.punchingCost ?? 0;
    
    // Recalculate total using the same helper as when adding items
    // Uses stored paperCost and newly edited per-box add-on costs
    const conversionCostVal = item.sheetWeight * parseFloat(conversionCost || "15");
    const newTotalCostPerBox = calculateTotalCost({
      paperCost: item.paperCost,
      printingCost: newPrintingCost,
      laminationCost: newLaminationCost,
      varnishCost: newVarnishCost,
      dieCost: newDieCost,
      punchingCost: newPunchingCost,
      markup: 15,
    }) + conversionCostVal;
    
    updatedItems[editingQuoteItemIdx] = {
      ...item,
      boxName: editingQuoteItemData.boxName !== undefined ? editingQuoteItemData.boxName : item.boxName,
      boxDescription: editingQuoteItemData.boxDescription !== undefined ? editingQuoteItemData.boxDescription : item.boxDescription,
      quantity: qty,
      printingCost: newPrintingCost,
      laminationCost: newLaminationCost,
      varnishCost: newVarnishCost,
      dieCost: newDieCost,
      punchingCost: newPunchingCost,
      totalCostPerBox: newTotalCostPerBox,
      totalValue: newTotalCostPerBox * qty,
    };
    
    setQuoteItems(updatedItems);
    setEditingQuoteItemIdx(null);
    setEditingQuoteItemData(null);
    toast({ title: "Updated", description: "Quote item updated successfully." });
  };
  
  const handleToggleItemSelection = (index: number) => {
    setQuoteItems(quoteItems.map((item, i) => 
      i === index ? { ...item, selected: !item.selected } : item
    ));
  };
  
  const handleSelectAllItems = (selected: boolean) => {
    setQuoteItems(quoteItems.map(item => ({ ...item, selected })));
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
    
    if (!paymentTerms.trim()) {
      toast({
        title: "Error",
        description: "Please enter payment terms.",
        variant: "destructive",
      });
      return;
    }
    
    if (!deliveryDays.trim()) {
      toast({
        title: "Error",
        description: "Please enter delivery days.",
        variant: "destructive",
      });
      return;
    }
    
    localStorage.setItem("lastPaymentTerms", paymentTerms);
    localStorage.setItem("lastDeliveryDays", deliveryDays);
    
    const total = quoteItems.reduce((sum, item) => sum + item.totalValue, 0);
    const transportCost = parseFloat(transportCharge) || 0;
    
    saveQuoteMutation.mutate({
      partyName: partyName,
      customerCompany: customerCompany || "",
      customerEmail: customerEmail || "",
      customerMobile: customerMobile || "",
      paymentTerms: paymentTerms,
      deliveryDays: deliveryDays,
      transportCharge: transportCost > 0 ? transportCost : undefined,
      transportRemark: transportCharge ? transportRemark : undefined,
      totalValue: total + transportCost,
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
  
  const grandTotal = quoteItems
    .filter(item => item.selected !== false)
    .reduce((sum, item) => {
      // Use negotiated price if available, otherwise fall back to totalCostPerBox or derive from totalValue
      const perBoxPrice = item.negotiatedPrice || item.totalCostPerBox || (item.totalValue && item.quantity ? item.totalValue / item.quantity : 0);
      const qty = item.quantity || 0;
      return sum + (perBoxPrice * qty);
    }, 0);
  
  return (
    <TooltipProvider>
    <div className="min-h-screen bg-background">
      <FlutingOnboarding onComplete={() => {
        queryClient.invalidateQueries({ queryKey: ['/api/fluting-settings'] });
      }} />
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={brandLogo} alt="Logo" className="w-10 h-10 rounded-md" />
              <div>
                <h1 className="text-2xl font-bold" data-testid="text-app-title">
                  {appSettings?.appTitle || "Box Costing Calculator"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {isLoadingProfile ? "Loading..." : companyProfile?.companyName || "Company"}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              {(user as any)?.role === 'owner' && (
                <Link href="/admin">
                  <Button variant="outline" size="sm" data-testid="button-admin-panel">
                    <Settings className="w-4 h-4 mr-2" />
                    Admin
                  </Button>
                </Link>
              )}
              
              <Link href="/reports">
                <Button variant="outline" size="sm" data-testid="button-reports">
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Reports
                </Button>
              </Link>
              
              <FlutingSettings onSettingsChange={setFluteSettings} />
              
              {allCompanyProfiles.length > 0 && (
                <Select value={selectedCompanyProfileId} onValueChange={setSelectedCompanyProfileId}>
                  <SelectTrigger className="w-48" data-testid="select-company-profile">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allCompanyProfiles.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.companyName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              
              <Dialog open={showBusinessProfile} onOpenChange={setShowBusinessProfile}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="button-business-profile">
                    <Building className="w-4 h-4 mr-2" />
                    Business Profile
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingProfileId ? "Edit" : "Create New"} Business Profile</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    {editingProfileId ? (
                      <div className="mb-4 p-3 bg-muted rounded text-sm">
                        Editing profile: {businessCompanyName}
                      </div>
                    ) : null}
                    <div>
                      <Label htmlFor="business-company">Company Name</Label>
                      <Input id="business-company" value={businessCompanyName} onChange={(e) => setBusinessCompanyName(e.target.value)} data-testid="input-business-company" placeholder="Your Company Name" />
                    </div>
                    <div>
                      <Label htmlFor="business-phone">Phone</Label>
                      <Input id="business-phone" value={businessPhone} onChange={(e) => setBusinessPhone(e.target.value)} data-testid="input-business-phone" />
                    </div>
                    <div>
                      <Label htmlFor="business-email">Email</Label>
                      <Input id="business-email" value={businessEmail} onChange={(e) => setBusinessEmail(e.target.value)} data-testid="input-business-email" />
                    </div>
                    <div>
                      <Label htmlFor="business-address">Address</Label>
                      <Input id="business-address" value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} data-testid="input-business-address" />
                    </div>
                    <div>
                      <Label htmlFor="business-gst">GST</Label>
                      <Input id="business-gst" value={businessGst} onChange={(e) => setBusinessGst(e.target.value)} data-testid="input-business-gst" />
                    </div>
                    <div>
                      <Label htmlFor="business-website">Website</Label>
                      <Input id="business-website" value={businessWebsite} onChange={(e) => setBusinessWebsite(e.target.value)} data-testid="input-business-website" />
                    </div>
                    <div>
                      <Label htmlFor="business-social">Social Media</Label>
                      <Input id="business-social" value={businessSocial} onChange={(e) => setBusinessSocial(e.target.value)} data-testid="input-business-social" />
                    </div>
                    <div>
                      <Label htmlFor="business-location">Location</Label>
                      <Input id="business-location" value={businessLocation} onChange={(e) => setBusinessLocation(e.target.value)} data-testid="input-business-location" />
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        onClick={() => {
                          saveBusinessProfileMutation.mutate({
                            companyName: businessCompanyName,
                            phone: businessPhone,
                            email: businessEmail,
                            address: businessAddress,
                            gstNo: businessGst,
                            website: businessWebsite,
                            socialMedia: businessSocial,
                            googleLocation: businessLocation,
                            isDefault: !editingProfileId,
                          });
                        }}
                        disabled={saveBusinessProfileMutation.isPending}
                        data-testid="button-save-business-profile"
                        className="flex-1"
                      >
                        {saveBusinessProfileMutation.isPending ? "Saving..." : "Save"}
                      </Button>
                      {editingProfileId && (
                        <Button 
                          onClick={() => {
                            if (confirm("Delete this profile?")) {
                              deleteBusinessProfileMutation.mutate(editingProfileId);
                              setShowBusinessProfile(false);
                              setEditingProfileId("");
                            }
                          }}
                          variant="destructive"
                          size="sm"
                          data-testid="button-delete-business-profile"
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                    
                    {!editingProfileId && allCompanyProfiles.length > 0 && (
                      <div>
                        <Label className="text-sm font-semibold mb-2 block">Existing Profiles</Label>
                        <Input 
                          placeholder="Search profiles..." 
                          value={businessSearchTerm} 
                          onChange={(e) => setBusinessSearchTerm(e.target.value)}
                          data-testid="input-search-business-profile"
                          className="mb-2"
                        />
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {allCompanyProfiles.filter(p => p.companyName.toLowerCase().includes(businessSearchTerm.toLowerCase())).map(profile => (
                            <Card key={profile.id} className="p-2 cursor-pointer hover-elevate" onClick={() => {
                              setEditingProfileId(profile.id);
                              setBusinessCompanyName(profile.companyName);
                              setBusinessPhone(profile.phone || "");
                              setBusinessEmail(profile.email || "");
                              setBusinessAddress(profile.address || "");
                              setBusinessGst(profile.gstNo || "");
                              setBusinessWebsite(profile.website || "");
                              setBusinessSocial(profile.socialMedia || "");
                              setBusinessLocation(profile.googleLocation || "");
                            }}>
                              <div className="text-sm font-medium">{profile.companyName}</div>
                              <div className="text-xs text-muted-foreground">{profile.phone} • {profile.email}</div>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>

              {allPartyProfiles.length > 0 && (
                <Select value={selectedPartyProfileId} onValueChange={setSelectedPartyProfileId}>
                  <SelectTrigger className="w-48" data-testid="select-party-profile">
                    <SelectValue placeholder="Select Party..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allPartyProfiles.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.personName} ({p.companyName})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              
              <Dialog open={showPartyProfile} onOpenChange={setShowPartyProfile}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="button-party-profile">
                    <Users className="w-4 h-4 mr-2" />
                    Party Profile
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingPartyId ? "Edit" : "Create New"} Party Profile</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    {editingPartyId ? (
                      <div className="mb-4 p-3 bg-muted rounded text-sm">
                        Editing party: {partyPersonName}
                      </div>
                    ) : null}
                    <div>
                      <Label htmlFor="party-name">Name of Person</Label>
                      <Input id="party-name" value={partyPersonName} onChange={(e) => setPartyPersonName(e.target.value)} data-testid="input-party-name" />
                    </div>
                    <div>
                      <Label htmlFor="party-company">Company Name</Label>
                      <Input id="party-company" value={partyCompanyName} onChange={(e) => setPartyCompanyName(e.target.value)} data-testid="input-party-company" />
                    </div>
                    <div>
                      <Label htmlFor="party-mobile">Mobile No</Label>
                      <Input id="party-mobile" value={partyMobile} onChange={(e) => setPartyMobile(e.target.value)} data-testid="input-party-mobile" />
                    </div>
                    <div>
                      <Label htmlFor="party-email">Email</Label>
                      <Input id="party-email" value={partyEmail} onChange={(e) => setPartyEmail(e.target.value)} data-testid="input-party-email" />
                    </div>
                    <div>
                      <Label htmlFor="party-gst">GST No</Label>
                      <Input id="party-gst" value={partyGst} onChange={(e) => setPartyGst(e.target.value)} data-testid="input-party-gst" />
                    </div>
                    <div>
                      <Label htmlFor="party-address">Address</Label>
                      <Input id="party-address" value={partyAddress} onChange={(e) => setPartyAddress(e.target.value)} data-testid="input-party-address" />
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        onClick={() => {
                          if (!partyPersonName.trim() && !partyCompanyName.trim()) {
                            toast({
                              title: "Error",
                              description: "Please enter at least Party Name or Company Name",
                              variant: "destructive",
                            });
                            return;
                          }
                          savePartyProfileMutation.mutate({
                            personName: partyPersonName || "N/A",
                            companyName: partyCompanyName || "N/A",
                            mobileNo: partyMobile || "",
                            email: partyEmail || "",
                            gstNo: partyGst || "",
                            address: partyAddress || "",
                          });
                        }}
                        disabled={savePartyProfileMutation.isPending}
                        data-testid="button-save-party-profile"
                        className="flex-1"
                      >
                        {savePartyProfileMutation.isPending ? "Saving..." : "Save"}
                      </Button>
                      {editingPartyId && (
                        <Button 
                          onClick={() => {
                            if (confirm("Delete this party profile?")) {
                              deletePartyProfileMutation.mutate(editingPartyId);
                              setShowPartyProfile(false);
                              setEditingPartyId("");
                            }
                          }}
                          variant="destructive"
                          size="sm"
                          data-testid="button-delete-party-profile"
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                    
                    {!editingPartyId && allPartyProfiles.length > 0 && (
                      <div>
                        <Label className="text-sm font-semibold mb-2 block">Existing Parties</Label>
                        <Input 
                          placeholder="Search parties..." 
                          value={partySearchTerm} 
                          onChange={(e) => setPartySearchTerm(e.target.value)}
                          data-testid="input-search-party-profile"
                          className="mb-2"
                        />
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {allPartyProfiles.filter((p: any) => ((p.personName || "") + (p.companyName || "")).toLowerCase().includes(partySearchTerm.toLowerCase())).map((profile: any) => (
                            <Card key={profile.id} className="p-2 cursor-pointer hover-elevate" onClick={() => {
                              setEditingPartyId(profile.id);
                              setPartyPersonName(profile.personName || "");
                              setPartyCompanyName(profile.companyName || "");
                              setPartyMobile(profile.mobileNo || "");
                              setPartyEmail(profile.email || "");
                              setPartyGst(profile.gstNo || "");
                              setPartyAddress(profile.address || "");
                            }}>
                              <div className="text-sm font-medium">{profile.personName} ({profile.companyName})</div>
                              <div className="text-xs text-muted-foreground">{profile.mobileNo} • {profile.email}</div>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
              
              <Dialog open={showBulkUpload} onOpenChange={setShowBulkUpload}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="button-bulk-upload">
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Excel
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Bulk Upload Items from Excel</DialogTitle>
                    <DialogDescription>Import multiple box/sheet items at once</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <Label htmlFor="excel-upload" className="text-base font-semibold">Select Excel File</Label>
                      <div 
                        className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer bg-muted/50"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const file = e.dataTransfer.files?.[0];
                          if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
                            handleBulkUploadFile(file);
                          } else {
                            toast({ title: "Error", description: "Please drop an Excel file (.xlsx or .xls)", variant: "destructive" });
                          }
                        }}
                      >
                        <Input 
                          id="excel-upload" 
                          type="file" 
                          accept=".xlsx,.xls"
                          onChange={(e) => {
                            const file = e.currentTarget.files?.[0];
                            if (file) handleBulkUploadFile(file);
                          }}
                          data-testid="input-excel-upload"
                          className="hidden"
                        />
                        <label htmlFor="excel-upload" className="cursor-pointer">
                          <div className="space-y-2">
                            <div className="text-2xl">📊</div>
                            <p className="font-medium">Drag Excel file here or click to browse</p>
                            <p className="text-xs text-muted-foreground">Supports .xlsx and .xls formats</p>
                          </div>
                        </label>
                      </div>
                    </div>

                    <div className="space-y-3 bg-muted/50 p-4 rounded-lg">
                      <p className="font-semibold text-sm">Excel Format Guide:</p>
                      <div className="text-xs space-y-2 text-muted-foreground font-mono">
                        <p>Required columns:</p>
                        <p className="pl-4">Box Name, Type (rsc/sheet), Ply, Length(mm), Width(mm), Height(mm), Quantity</p>
                        <p className="mt-2">For layers use columns like:</p>
                        <p className="pl-4">L1 GSM, L1 BF, L1 RCT, L1 Shade, L1 Rate (for Liner 1)</p>
                        <p className="pl-4">F1 GSM, F1 BF, F1 RCT, F1 Shade, F1 Rate (for Flute 1)</p>
                        <p className="pl-4">L2 GSM, F2 GSM, L3 GSM... (continue for additional layers)</p>
                      </div>
                    </div>

                    <Button 
                      onClick={handleDownloadSampleTemplate} 
                      variant="outline" 
                      className="w-full"
                      data-testid="button-download-sample-excel"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Sample Excel Template
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={showQuotesDialog} onOpenChange={setShowQuotesDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="button-load-quote">
                    <FileText className="w-4 h-4 mr-2" />
                    Load Quote
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Saved Quotes</DialogTitle>
                    <DialogDescription>
                      Search and load a previously saved quote
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <Input 
                      placeholder="Search by company..." 
                      value={quoteSearchCompany} 
                      onChange={(e) => setQuoteSearchCompany(e.target.value)}
                      data-testid="input-search-quote-company"
                    />
                    <Input 
                      placeholder="Search by box name..." 
                      value={quoteSearchBoxName} 
                      onChange={(e) => setQuoteSearchBoxName(e.target.value)}
                      data-testid="input-search-quote-boxname"
                    />
                    <Input 
                      type="date"
                      value={quoteSearchDate}
                      onChange={(e) => setQuoteSearchDate(e.target.value)}
                      data-testid="input-search-quote-date"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    {isLoadingQuotes ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        Loading quotes...
                      </p>
                    ) : filteredQuotes.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        {savedQuotes.length === 0 ? "No saved quotes found" : "No quotes match your search criteria"}
                      </p>
                    ) : (
                      filteredQuotes.map((quote) => (
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
              
              {user && typeof user === 'object' ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" data-testid="button-user-menu">
                      <User className="w-4 h-4 mr-2" />
                      {('firstName' in user && user.firstName) ? String(user.firstName) : ('email' in user && user.email) ? String(user.email) : "Account"}
                      <ChevronDown className="w-4 h-4 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>My Account</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-muted-foreground text-xs" disabled>
                      {'email' in user && user.email ? String(user.email) : "No email"}
                    </DropdownMenuItem>
                    {'role' in user && user.role === 'owner' && (
                      <DropdownMenuItem className="text-muted-foreground text-xs" disabled>
                        <Badge variant="secondary" className="text-xs">Owner</Badge>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <a href="/api/logout" className="cursor-pointer text-destructive" data-testid="button-logout">
                        <LogOut className="w-4 h-4 mr-2" />
                        Sign Out
                      </a>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
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
                    
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div className="space-y-2">
                        <Label htmlFor="conversion-cost">Conversion Cost (₹/Kg)</Label>
                        <Input
                          id="conversion-cost"
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={conversionCost}
                          onChange={(e) => setConversionCost(e.target.value)}
                          data-testid="input-conversion-cost"
                        />
                        <p className="text-xs text-muted-foreground">
                          Cost/Box: ₹{conversionCostPerBox.toFixed(2)}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="quantity">Quantity (pcs)</Label>
                        <Input
                          id="quantity"
                          type="number"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                          data-testid="input-quantity"
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
                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ply">Ply Configuration</Label>
                    <Select value={ply} onValueChange={(v) => {
                      setPly(v);
                      setGlueFlap(GLUE_FLAP_DEFAULTS[v].toString());
                      setDeckleAllowance(DECKLE_ALLOWANCE_DEFAULTS[v].toString());
                      updateLayersForPly(v);
                      const combos = FLUTE_COMBINATIONS[v] || [];
                      if (combos.length > 0 && !combos.includes(fluteCombination)) {
                        setFluteCombination(combos[0]);
                      }
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
                    <Label htmlFor="flute-combo">Flute Combination</Label>
                    <Select value={fluteCombination} onValueChange={(v) => {
                      setFluteCombination(v);
                      const factors = getFlutingFactorForCombination(v, fluteSettings);
                      setLayers(prev => prev.map((layer, idx) => {
                        if (layer.layerType === 'flute') {
                          const fluteIdx = Math.floor(idx / 2);
                          const newFactor = factors[fluteIdx] || 1.35;
                          return { ...layer, flutingFactor: newFactor.toFixed(2) };
                        }
                        return layer;
                      }));
                    }}>
                      <SelectTrigger id="flute-combo" data-testid="select-flute-combo">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(FLUTE_COMBINATIONS[ply] || ['B']).map((combo) => (
                          <SelectItem key={combo} value={combo}>
                            {combo} Flute
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
                        <TableHead>GSM</TableHead>
                        <TableHead>BF</TableHead>
                        <TableHead>RCT Value</TableHead>
                        <TableHead>Shade</TableHead>
                        <TableHead>Rate (₹/kg)</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {layers.map((layer, idx) => {
                        const linerCount = layers.slice(0, idx + 1).filter(l => l.layerType === 'liner').length;
                        const fluteCount = layers.slice(0, idx + 1).filter(l => l.layerType === 'flute').length;
                        const layerLabel = layer.layerType === 'liner' ? `L${linerCount}` : `F${fluteCount}`;
                        return (
                        <TableRow key={idx}>
                          <TableCell className="font-medium" data-testid={`text-layer-label-${idx}`}>{layerLabel}</TableCell>
                          <TableCell className="text-sm" data-testid={`text-gsm-${idx}`}>{layer.gsm}</TableCell>
                          <TableCell className="text-sm" data-testid={`text-bf-${idx}`}>{layer.bf}</TableCell>
                          <TableCell className="text-sm" data-testid={`text-rct-${idx}`}>{layer.rctValue}</TableCell>
                          <TableCell className="text-sm" data-testid={`text-shade-${idx}`}>{layer.shade}</TableCell>
                          <TableCell className="text-sm" data-testid={`text-rate-${idx}`}>₹{parseFloat(layer.rate).toFixed(2)}</TableCell>
                          <TableCell className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingLayerIdx(idx);
                                setEditingLayerData({ ...layer });
                              }}
                              title={`Edit L${idx + 1}`}
                              data-testid={`button-edit-layer-${idx}`}
                            >
                              Edit
                            </Button>
                            {idx > 0 && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  const newLayers = [...layers];
                                  const sourceLayer = layers[idx - 1];
                                  // Copy: gsm, bf, rctValue, shade, rate
                                  newLayers[idx] = {
                                    ...newLayers[idx],
                                    gsm: sourceLayer.gsm,
                                    bf: sourceLayer.bf,
                                    rctValue: sourceLayer.rctValue,
                                    shade: sourceLayer.shade,
                                    rate: sourceLayer.rate,
                                  };
                                  // Copy flutingFactor only to even layers (flute layers: index 1, 3, 5...)
                                  if (idx % 2 === 1) {
                                    newLayers[idx].flutingFactor = sourceLayer.flutingFactor;
                                  }
                                  setLayers(newLayers);
                                  toast({ title: "Copied", description: `L${idx + 1} values copied from L${idx}` });
                                }}
                                title={`Copy from L${idx}`}
                                data-testid={`button-copy-from-prev-${idx}`}
                              >
                                <Copy className="w-3 h-3" />
                              </Button>
                            )}
                            {idx < layers.length - 1 && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => copyLayerToFollowing(idx)}
                                title={`Copy to L${idx + 2}+`}
                                data-testid={`button-copy-to-next-${idx}`}
                              >
                                <Download className="w-3 h-3" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Dialog open={editingLayerIdx !== null} onOpenChange={(open) => !open && setEditingLayerIdx(null)}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    Edit Layer L{editingLayerIdx !== null ? editingLayerIdx + 1 : ""}
                  </DialogTitle>
                  <DialogDescription>
                    {editingLayerIdx !== null && editingLayerData ? (
                      <div className="text-sm font-medium mt-2">
                        {editingLayerData.gsm} GSM - {editingLayerData.bf} BF - FF {editingLayerData.flutingFactor} - {editingLayerData.shade}
                      </div>
                    ) : null}
                  </DialogDescription>
                </DialogHeader>
                {editingLayerData && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-gsm" className="text-sm">GSM</Label>
                        <Input
                          id="edit-gsm"
                          type="number"
                          value={editingLayerData.gsm}
                          onChange={(e) => {
                            const newGsm = e.target.value;
                            const updated = { ...editingLayerData, gsm: newGsm };
                            const price = lookupPaperPrice(parseInt(newGsm), parseInt(editingLayerData.bf), editingLayerData.shade);
                            if (price !== null) {
                              updated.rate = price.toFixed(2);
                            } else {
                              const memoryKey = `${editingLayerData.bf}|${editingLayerData.shade}`;
                              if (rateMemory[memoryKey]) {
                                updated.rate = rateMemory[memoryKey];
                              }
                            }
                            setEditingLayerData(updated);
                          }}
                          data-testid="input-edit-gsm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-bf" className="text-sm">BF</Label>
                        <Select
                          value={editingLayerData.bf}
                          onValueChange={(value) => {
                            const updated = { ...editingLayerData, bf: value };
                            const price = lookupPaperPrice(parseInt(editingLayerData.gsm), parseInt(value), editingLayerData.shade);
                            if (price !== null) {
                              updated.rate = price.toFixed(2);
                            } else {
                              const memoryKey = `${value}|${editingLayerData.shade}`;
                              if (rateMemory[memoryKey]) {
                                updated.rate = rateMemory[memoryKey];
                              }
                            }
                            setEditingLayerData(updated);
                          }}
                        >
                          <SelectTrigger id="edit-bf" data-testid="select-edit-bf">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="14">14</SelectItem>
                            <SelectItem value="16">16</SelectItem>
                            <SelectItem value="18">18</SelectItem>
                            <SelectItem value="20">20</SelectItem>
                            <SelectItem value="22">22</SelectItem>
                            <SelectItem value="24">24</SelectItem>
                            <SelectItem value="28">28</SelectItem>
                            <SelectItem value="35">35</SelectItem>
                            <SelectItem value="40">40</SelectItem>
                            <SelectItem value="45">45</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-rct" className="text-sm">RCT Value</Label>
                        <Input
                          id="edit-rct"
                          type="number"
                          value={editingLayerData.rctValue}
                          onChange={(e) =>
                            setEditingLayerData({ ...editingLayerData, rctValue: e.target.value })
                          }
                          data-testid="input-edit-rct"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-shade" className="text-sm">Paper Shade</Label>
                        <Select
                          value={editingLayerData.shade}
                          onValueChange={(value) => {
                            const updated = { ...editingLayerData, shade: value };
                            const price = lookupPaperPrice(parseInt(editingLayerData.gsm), parseInt(editingLayerData.bf), value);
                            if (price !== null) {
                              updated.rate = price.toFixed(2);
                            } else {
                              const memoryKey = `${editingLayerData.bf}|${value}`;
                              if (rateMemory[memoryKey]) {
                                updated.rate = rateMemory[memoryKey];
                              }
                            }
                            setEditingLayerData(updated);
                          }}
                        >
                          <SelectTrigger id="edit-shade" data-testid="select-edit-shade">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {shadePremiumsData.length > 0 ? (
                              shadePremiumsData.map((shade: any) => (
                                <SelectItem key={shade.id} value={shade.shade}>
                                  {shade.shade}
                                </SelectItem>
                              ))
                            ) : (
                              <>
                                <SelectItem value="Kraft/Natural">Kraft/Natural</SelectItem>
                                <SelectItem value="Golden Kraft">Golden Kraft</SelectItem>
                                <SelectItem value="White Kraft Liner">White Kraft Liner</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-rate" className="text-sm">Rate (₹/kg)</Label>
                      <Input
                        id="edit-rate"
                        type="number"
                        step="0.01"
                        value={editingLayerData.rate}
                        onChange={(e) =>
                          setEditingLayerData({ ...editingLayerData, rate: e.target.value })
                        }
                        data-testid="input-edit-rate"
                      />
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button
                        variant="outline"
                        onClick={() => setEditingLayerIdx(null)}
                        data-testid="button-cancel-edit"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => {
                          if (editingLayerIdx !== null) {
                            const newLayers = [...layers];
                            newLayers[editingLayerIdx] = editingLayerData;
                            setLayers(newLayers);
                            
                            // Save rate to memory by BF + Shade combination (both local and API)
                            const memoryKey = `${editingLayerData.bf}|${editingLayerData.shade}`;
                            setRateMemory({ ...rateMemory, [memoryKey]: editingLayerData.rate });
                            
                            // Persist to API
                            saveRateMemoryMutation.mutate({
                              bfValue: editingLayerData.bf,
                              shade: editingLayerData.shade,
                              rate: parseFloat(editingLayerData.rate)
                            });
                            
                            setEditingLayerIdx(null);
                            toast({ title: "Success", description: `L${editingLayerIdx + 1} updated successfully` });
                          }
                        }}
                        data-testid="button-save-edit"
                      >
                        Save Changes
                      </Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            {/* WhatsApp Message Editing Dialog */}
            <Dialog open={showMessageDialog === "whatsapp"} onOpenChange={(open) => !open && setShowMessageDialog(null)}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>WhatsApp Message</DialogTitle>
                  <DialogDescription>Edit the message and copy when ready</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="whatsapp-message" className="text-sm">Message Content</Label>
                    <textarea
                      id="whatsapp-message"
                      value={editableWhatsAppMessage}
                      onChange={(e) => setEditableWhatsAppMessage(e.target.value)}
                      className="w-full h-40 p-3 border rounded-md font-mono text-sm resize-none"
                      data-testid="textarea-whatsapp-message"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowMessageDialog(null)}
                      data-testid="button-cancel-message"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => {
                        navigator.clipboard.writeText(editableWhatsAppMessage);
                        toast({ title: "Copied", description: "WhatsApp message copied to clipboard" });
                        setShowMessageDialog(null);
                      }}
                      data-testid="button-copy-whatsapp-message"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy Message
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Email Message Editing Dialog */}
            <Dialog open={showMessageDialog === "email"} onOpenChange={(open) => !open && setShowMessageDialog(null)}>
              <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                  <DialogTitle>Email Preview</DialogTitle>
                  <DialogDescription>Preview and copy the email content</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
                  <div className="space-y-2">
                    <Label htmlFor="email-subject" className="text-sm">Subject</Label>
                    <Input
                      id="email-subject"
                      value={editableEmailSubject}
                      onChange={(e) => setEditableEmailSubject(e.target.value)}
                      data-testid="input-email-subject"
                    />
                  </div>
                  <div className="space-y-2 flex-1 overflow-hidden flex flex-col">
                    <Label className="text-sm">Email Preview</Label>
                    <div 
                      className="flex-1 overflow-auto border rounded-md p-4 bg-white text-sm"
                      dangerouslySetInnerHTML={{ __html: editableEmailBody }}
                      data-testid="div-email-preview"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowMessageDialog(null)}
                      data-testid="button-cancel-email-message"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={async () => {
                        try {
                          await navigator.clipboard.write([
                            new ClipboardItem({
                              'text/html': new Blob([editableEmailBody], { type: 'text/html' }),
                              'text/plain': new Blob([`Subject: ${editableEmailSubject}`], { type: 'text/plain' })
                            })
                          ]);
                          toast({ title: "Copied", description: "Email copied as rich text. Paste in your email client." });
                        } catch (err) {
                          const temp = document.createElement('div');
                          temp.innerHTML = editableEmailBody;
                          const plainText = temp.textContent || temp.innerText || '';
                          await navigator.clipboard.writeText(`Subject: ${editableEmailSubject}\n\n${plainText}`);
                          toast({ title: "Copied", description: "Email copied as plain text" });
                        }
                        setShowMessageDialog(null);
                      }}
                      data-testid="button-copy-email-message"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy Email (Rich Text)
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            
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
                      <div className="text-sm font-semibold text-foreground mb-2">Total GSM:</div>
                      <div className="flex justify-between text-sm pl-2">
                        <span className="text-muted-foreground">Ply:</span>
                        <span className="font-medium">{ply}-Ply</span>
                      </div>
                      <div className="flex justify-between text-sm pl-2">
                        <span className="text-muted-foreground">Layer Specifications:</span>
                        <span className="font-medium">{(() => {
                          if (!result || !result.layerSpecs || result.layerSpecs.length === 0) return "No layers";
                          return result.layerSpecs.map((spec: any, idx: number) => 
                            `L${idx + 1}: ${spec.gsm}`
                          ).join(" + ");
                        })()}</span>
                      </div>
                      <div className="flex justify-between text-sm pl-2 bg-accent/20 p-2 rounded">
                        <span className="text-muted-foreground font-semibold">Total GSM (Σ):</span>
                        <span className="font-bold" data-testid="text-total-gsm">
                          {(() => {
                            if (!result || !result.layerSpecs) return "0";
                            const total = result.layerSpecs.reduce((sum: number, spec: any) => {
                              if (spec.layerType === 'liner') {
                                return sum + spec.gsm;
                              } else {
                                const ff = spec.flutingFactor || 1.5;
                                return sum + (spec.gsm * ff);
                              }
                            }, 0);
                            return total.toFixed(2);
                          })()}
                        </span>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground flex items-center gap-1">
                          Calculated Sheet Weight:
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-4 h-4 text-muted-foreground hover:text-primary cursor-help" data-testid="icon-weight-formula" />
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-sm p-3">
                              <div className="text-xs space-y-1">
                                <div className="font-semibold">Weight Formula:</div>
                                <div>Σ GSM = L1 + (L2 × FF) + L3 + (L4 × FF) + ...</div>
                                <div>Where FF = Fluting Factor</div>
                                <div className="mt-1">Weight = (L × W × Total GSM) / 1,000,000</div>
                                <div className="text-xs italic mt-1">L = Sheet Length (mm), W = Sheet Width (mm)</div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </span>
                        <span className="font-medium" data-testid="text-sheet-weight">
                          {result.sheetWeight.toFixed(3)} Kg
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground flex items-center gap-1">
                          Calculated Box BS:
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-4 h-4 text-muted-foreground hover:text-primary cursor-help" data-testid="icon-bs-formula" />
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-sm p-3">
                              <div className="text-xs space-y-1">
                                <div className="font-semibold">Burst Strength (BS) Formula:</div>
                                <div>BS = Σ (Liner GSM × BF / 1000 + Flute GSM × BF / 2000)</div>
                                <div className="text-xs italic mt-1">Liner = GSM×BF/1000, Flute = GSM×BF/2000</div>
                                <div className="text-xs italic">BF = Bursting Factor</div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </span>
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
                <CardTitle>Paper Cost & Weight Analysis</CardTitle>
                <CardDescription>Formula: Weight = (GSM × Fluting × Reel Size × Sheet Cut Length) / 1,000,000</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {result && result.layerSpecs && result.layerSpecs.length > 0 && result.layerWeights && result.layerWeights.length > 0 ? (
                  <>
                    <div className="space-y-3">
                      <div className="text-sm font-semibold">Per-Layer Breakdown:</div>
                      <div className="space-y-2">
                        {result.layerSpecs.map((spec: any, idx: number) => {
                          const layerWeight = result.layerWeights[idx];
                          const layerCost = layerWeight * spec.rate;
                          return (
                            <div key={idx} className="flex justify-between text-xs p-2 bg-muted rounded">
                              <div>
                                <span className="font-medium">L{idx + 1}: GSM {spec.gsm}, BF {spec.bf}, {spec.shade}</span>
                              </div>
                              <div className="text-right">
                                <div>Weight: {layerWeight.toFixed(3)} Kg</div>
                                <div>Cost: ₹{layerCost.toFixed(2)}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <div className="text-sm font-semibold">Total Paper Summary:</div>
                      <div className="flex justify-between text-sm p-2 bg-accent/20 rounded">
                        <span>Total Average Paper Cost (per unit):</span>
                        <span className="font-bold">₹{result.paperCost.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm p-2 bg-accent/20 rounded">
                        <span>Total Sheet Weight (per unit):</span>
                        <span className="font-bold">{result.sheetWeight.toFixed(3)} Kg</span>
                      </div>
                      <div className="flex justify-between text-sm p-2 bg-accent/20 rounded">
                        <span>Total KGs for Order ({qty} units):</span>
                        <span className="font-bold text-lg">{(result.sheetWeight * qty).toFixed(2)} Kg</span>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <div className="text-sm font-semibold">Grouped Paper Combinations:</div>
                      <div className="space-y-2">
                        {(() => {
                          // Group by GSM+BF+Shade combination
                          const groupedPapers: Record<string, {gsm: number; bf: number; shade: string; weight: number; rate: number; quantity: number}> = {};
                          
                          result.layerSpecs.forEach((spec: any, idx: number) => {
                            const key = `${spec.gsm}-${spec.bf}-${spec.shade}`;
                            const layerWeight = result.layerWeights[idx];
                            const weight = layerWeight * qty;
                            
                            if (groupedPapers[key]) {
                              groupedPapers[key].weight += weight;
                            } else {
                              groupedPapers[key] = {
                                gsm: spec.gsm,
                                bf: spec.bf,
                                shade: spec.shade,
                                weight,
                                rate: spec.rate,
                                quantity: qty
                              };
                            }
                          });
                          
                          return Object.entries(groupedPapers).map(([key, paper]) => (
                            <div key={key} className="flex justify-between text-xs p-2 bg-muted rounded">
                              <div>
                                <span className="font-medium">GSM {paper.gsm} | BF {paper.bf} | {paper.shade}</span>
                              </div>
                              <div className="text-right">
                                <div>{paper.weight.toFixed(2)} Kg</div>
                                <div>₹{(paper.rate * paper.weight).toFixed(2)}</div>
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Enter dimensions to see paper analysis</p>
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
                  {quoteItems.length > 0 && <div className="flex gap-2 flex-wrap">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setShowVersionHistory(true)}
                      data-testid="button-version-history"
                    >
                      <History className="w-4 h-4 mr-2" />
                      History
                    </Button>
                    
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        const selectedParty = allPartyProfiles.find((p: any) => p.id === selectedPartyProfileId) || null;
                        const message = generateWhatsAppMessage(quoteItems, selectedParty, companyProfile);
                        setEditableWhatsAppMessage(message);
                        setShowMessageDialog("whatsapp");
                      }}
                      data-testid="button-copy-whatsapp"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy WhatsApp
                    </Button>
                    
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        const selectedParty = allPartyProfiles.find((p: any) => p.id === selectedPartyProfileId) || null;
                        const { subject, body } = generateEmailContent(quoteItems, selectedParty, companyProfile);
                        setEditableEmailSubject(subject);
                        setEditableEmailBody(body);
                        setShowMessageDialog("email");
                      }}
                      data-testid="button-copy-email"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy Email
                    </Button>
                    
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        downloadExcel(quoteItems, partyName || "Customer", customerCompany || "Company", companyProfile, `quote-${new Date().toISOString().split('T')[0]}.xlsx`);
                      }}
                      data-testid="button-download-excel"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Excel
                    </Button>
                    
                    {customerMobile && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          const selectedParty = allPartyProfiles.find((p: any) => p.id === selectedPartyProfileId) || null;
                          const message = generateWhatsAppMessage(quoteItems, selectedParty, companyProfile);
                          const encodedMessage = encodeURIComponent(message);
                          const whatsappUrl = `https://wa.me/${customerMobile.replace(/\D/g, '')}?text=${encodedMessage}`;
                          window.open(whatsappUrl, '_blank');
                        }}
                        data-testid="button-whatsapp-direct"
                      >
                        <MessageCircle className="w-4 h-4 mr-2" />
                        WhatsApp
                      </Button>
                    )}
                    
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => downloadQuotePDF(quoteItems, partyName, customerCompany, companyProfile, paymentTerms, deliveryDays, transportCharge, transportRemark)}
                      data-testid="button-download-pdf"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download PDF
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
                          <div className="space-y-2">
                            <Label htmlFor="payment-terms">Payment Terms</Label>
                            <Input id="payment-terms" placeholder="e.g., 50% Advance, 50% Before Delivery" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} data-testid="input-payment-terms" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="delivery-days">Delivery Time (Days)</Label>
                            <Input id="delivery-days" type="number" placeholder="e.g., 7" value={deliveryDays} onChange={(e) => setDeliveryDays(e.target.value)} data-testid="input-delivery-days" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="transport-charge">Transport Charge (₹) - Optional</Label>
                            <Input id="transport-charge" type="number" placeholder="0" value={transportCharge} onChange={(e) => setTransportCharge(e.target.value)} data-testid="input-transport-charge" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="transport-remark">Transport Remark (Optional)</Label>
                            <Input id="transport-remark" placeholder="e.g., FOB, CIF, etc." value={transportRemark} onChange={(e) => setTransportRemark(e.target.value)} data-testid="input-transport-remark" />
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
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-sm mb-2">
                      <span className="text-muted-foreground">
                        {quoteItems.filter(i => i.selected !== false).length} of {quoteItems.length} selected for WhatsApp/Email
                      </span>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleSelectAllItems(true)} data-testid="button-select-all">
                          Select All
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleSelectAllItems(false)} data-testid="button-deselect-all">
                          Deselect All
                        </Button>
                      </div>
                    </div>
                    {/* Column visibility controls */}
                    <div className="flex flex-wrap items-center gap-3 mb-3 text-sm">
                      <span className="text-muted-foreground">Show columns:</span>
                      {[
                        { key: 'paper', label: 'Paper' },
                        { key: 'printing', label: 'Printing' },
                        { key: 'lamination', label: 'Lamination' },
                        { key: 'varnish', label: 'Varnish' },
                        { key: 'die', label: 'Die' },
                        { key: 'punching', label: 'Punching' },
                      ].map(col => (
                        <label key={col.key} className="flex items-center gap-1.5 cursor-pointer">
                          <Checkbox
                            checked={visibleCostColumns[col.key as keyof typeof visibleCostColumns]}
                            onCheckedChange={(checked) => setVisibleCostColumns(prev => ({ ...prev, [col.key]: !!checked }))}
                            data-testid={`checkbox-col-${col.key}`}
                          />
                          <span>{col.label}</span>
                        </label>
                      ))}
                    </div>
                    <div className="overflow-x-auto border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10">
                              <Checkbox 
                                checked={quoteItems.every(i => i.selected !== false)}
                                onCheckedChange={(checked) => handleSelectAllItems(!!checked)}
                                data-testid="checkbox-select-all"
                              />
                            </TableHead>
                            <TableHead>Box Name</TableHead>
                            <TableHead>Size (L×W×H)</TableHead>
                            <TableHead>Ply</TableHead>
                            <TableHead className="text-right">Qty</TableHead>
                            {visibleCostColumns.paper && <TableHead className="text-right">Paper (₹)</TableHead>}
                            {visibleCostColumns.printing && <TableHead className="text-right">Printing (₹)</TableHead>}
                            {visibleCostColumns.lamination && <TableHead className="text-right">Lamination (₹)</TableHead>}
                            {visibleCostColumns.varnish && <TableHead className="text-right">Varnish (₹)</TableHead>}
                            {visibleCostColumns.die && <TableHead className="text-right">Die (₹)</TableHead>}
                            {visibleCostColumns.punching && <TableHead className="text-right">Punching (₹)</TableHead>}
                            <TableHead className="text-right">Cost/Pc (₹)</TableHead>
                            <TableHead className="text-right">Total (₹)</TableHead>
                            <TableHead className="w-10"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {quoteItems.map((item, index) => (
                            <TableRow 
                              key={index} 
                              className={item.selected !== false ? '' : 'opacity-50'}
                              data-testid={`quote-item-row-${index}`}
                            >
                              <TableCell>
                                <Checkbox 
                                  checked={item.selected !== false}
                                  onCheckedChange={() => handleToggleItemSelection(index)}
                                  data-testid={`checkbox-item-${index}`}
                                />
                              </TableCell>
                              <TableCell className="font-medium" data-testid={`text-item-name-${index}`}>
                                {item.boxName}
                                {item.boxDescription && (
                                  <span className="block text-xs text-muted-foreground">{item.boxDescription}</span>
                                )}
                              </TableCell>
                              <TableCell className="text-sm" data-testid={`text-item-size-${index}`}>
                                {item.type === 'rsc' 
                                  ? `${item.length}×${item.width}×${item.height || 0}` 
                                  : `${item.length}×${item.width}`}
                              </TableCell>
                              <TableCell data-testid={`text-item-ply-${index}`}>{item.ply}-Ply</TableCell>
                              <TableCell className="text-right" data-testid={`text-item-qty-${index}`}>{item.quantity.toLocaleString()}</TableCell>
                              {visibleCostColumns.paper && <TableCell className="text-right" data-testid={`text-item-paper-${index}`}>{(item.paperCost * item.quantity).toFixed(2)}</TableCell>}
                              {visibleCostColumns.printing && <TableCell className="text-right" data-testid={`text-item-printing-${index}`}>{((item.printingCost || 0) * item.quantity).toFixed(2)}</TableCell>}
                              {visibleCostColumns.lamination && <TableCell className="text-right" data-testid={`text-item-lamination-${index}`}>{((item.laminationCost || 0) * item.quantity).toFixed(2)}</TableCell>}
                              {visibleCostColumns.varnish && <TableCell className="text-right" data-testid={`text-item-varnish-${index}`}>{((item.varnishCost || 0) * item.quantity).toFixed(2)}</TableCell>}
                              {visibleCostColumns.die && <TableCell className="text-right" data-testid={`text-item-die-${index}`}>{((item.dieCost || 0) * item.quantity).toFixed(2)}</TableCell>}
                              {visibleCostColumns.punching && <TableCell className="text-right" data-testid={`text-item-punching-${index}`}>{((item.punchingCost || 0) * item.quantity).toFixed(2)}</TableCell>}
                              <TableCell className="text-right font-medium" data-testid={`text-item-costperpc-${index}`}>
                                {item.negotiationMode && item.negotiationMode !== 'none' && item.negotiatedPrice ? (
                                  <div className="flex flex-col items-end">
                                    <span className="line-through text-muted-foreground text-xs">{(item.originalPrice || 0).toFixed(2)}</span>
                                    <span className="text-green-600 font-bold">{item.negotiatedPrice.toFixed(2)}</span>
                                  </div>
                                ) : (
                                  (item.totalCostPerBox || 0).toFixed(2)
                                )}
                              </TableCell>
                              <TableCell className="text-right font-bold" data-testid={`text-item-total-${index}`}>
                                {item.negotiationMode && item.negotiationMode !== 'none' && item.negotiatedPrice ? (
                                  <span className="text-green-600">{(item.negotiatedPrice * (item.quantity || 0)).toFixed(2)}</span>
                                ) : (
                                  (item.totalValue || 0).toFixed(2)
                                )}
                              </TableCell>
                              <TableCell className="flex gap-1">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant={item.negotiationMode && item.negotiationMode !== 'none' ? "secondary" : "ghost"}
                                      size="icon"
                                      onClick={() => {
                                        setNegotiatingItemIdx(index);
                                        setNegotiationMode(item.negotiationMode || 'none');
                                        setNegotiationValue(item.negotiationValue?.toString() || '');
                                      }}
                                      data-testid={`button-negotiate-item-${index}`}
                                    >
                                      <Tag className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {item.negotiationMode && item.negotiationMode !== 'none' 
                                      ? `Negotiated: ${item.negotiationMode === 'percentage' ? `${item.negotiationValue}% off` : `₹${item.negotiatedPrice}/pc`}`
                                      : 'Negotiate price'}
                                  </TooltipContent>
                                </Tooltip>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEditQuoteItem(index)}
                                  data-testid={`button-edit-item-${index}`}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemoveItem(index)}
                                  data-testid={`button-remove-${index}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center pt-2">
                      <span className="font-semibold">Grand Total (Selected):</span>
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
      
      {/* Edit Quote Item Dialog */}
      <Dialog open={editingQuoteItemIdx !== null} onOpenChange={(open) => {
        if (!open) {
          setEditingQuoteItemIdx(null);
          setEditingQuoteItemData(null);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Quote Item</DialogTitle>
            <DialogDescription>Modify item details and per-box costs</DialogDescription>
          </DialogHeader>
          {editingQuoteItemData && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-box-name">Box Name</Label>
                <Input
                  id="edit-box-name"
                  value={editingQuoteItemData.boxName || ""}
                  onChange={(e) => setEditingQuoteItemData({ ...editingQuoteItemData, boxName: e.target.value })}
                  data-testid="input-edit-box-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-box-desc">Description</Label>
                <Input
                  id="edit-box-desc"
                  value={editingQuoteItemData.boxDescription || ""}
                  onChange={(e) => setEditingQuoteItemData({ ...editingQuoteItemData, boxDescription: e.target.value })}
                  data-testid="input-edit-box-desc"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-qty">Quantity</Label>
                <Input
                  id="edit-qty"
                  type="number"
                  value={editingQuoteItemData.quantity || 0}
                  onChange={(e) => setEditingQuoteItemData({ ...editingQuoteItemData, quantity: parseInt(e.target.value) || 0 })}
                  data-testid="input-edit-qty"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="edit-printing">Printing (₹/pc)</Label>
                  <Input
                    id="edit-printing"
                    type="number"
                    step="0.01"
                    value={editingQuoteItemData.printingCost || 0}
                    onChange={(e) => setEditingQuoteItemData({ ...editingQuoteItemData, printingCost: parseFloat(e.target.value) || 0 })}
                    data-testid="input-edit-printing"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-lamination">Lamination (₹/pc)</Label>
                  <Input
                    id="edit-lamination"
                    type="number"
                    step="0.01"
                    value={editingQuoteItemData.laminationCost || 0}
                    onChange={(e) => setEditingQuoteItemData({ ...editingQuoteItemData, laminationCost: parseFloat(e.target.value) || 0 })}
                    data-testid="input-edit-lamination"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-varnish">Varnish (₹/pc)</Label>
                  <Input
                    id="edit-varnish"
                    type="number"
                    step="0.01"
                    value={editingQuoteItemData.varnishCost || 0}
                    onChange={(e) => setEditingQuoteItemData({ ...editingQuoteItemData, varnishCost: parseFloat(e.target.value) || 0 })}
                    data-testid="input-edit-varnish"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-die">Die (₹/pc)</Label>
                  <Input
                    id="edit-die"
                    type="number"
                    step="0.01"
                    value={editingQuoteItemData.dieCost || 0}
                    onChange={(e) => setEditingQuoteItemData({ ...editingQuoteItemData, dieCost: parseFloat(e.target.value) || 0 })}
                    data-testid="input-edit-die"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-punching">Punching (₹/pc)</Label>
                  <Input
                    id="edit-punching"
                    type="number"
                    step="0.01"
                    value={editingQuoteItemData.punchingCost || 0}
                    onChange={(e) => setEditingQuoteItemData({ ...editingQuoteItemData, punchingCost: parseFloat(e.target.value) || 0 })}
                    data-testid="input-edit-punching"
                  />
                </div>
              </div>
              <Button onClick={handleSaveEditedQuoteItem} className="w-full" data-testid="button-save-edit-item">
                Save Changes
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Negotiation Dialog */}
      <Dialog open={negotiatingItemIdx !== null} onOpenChange={(open) => {
        if (!open) {
          setNegotiatingItemIdx(null);
          setNegotiationMode('none');
          setNegotiationValue('');
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5" />
              Negotiate Price
            </DialogTitle>
            <DialogDescription>
              {negotiatingItemIdx !== null && quoteItems[negotiatingItemIdx] && (
                <span>
                  {quoteItems[negotiatingItemIdx].boxName} - Original: ₹{quoteItems[negotiatingItemIdx].totalCostPerBox.toFixed(2)}/pc
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Negotiation Type</Label>
              <div className="flex gap-2">
                <Button
                  variant={negotiationMode === 'none' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setNegotiationMode('none');
                    setNegotiationValue('');
                  }}
                  data-testid="button-nego-none"
                >
                  None
                </Button>
                <Button
                  variant={negotiationMode === 'percentage' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setNegotiationMode('percentage')}
                  data-testid="button-nego-percentage"
                >
                  <Percent className="w-4 h-4 mr-1" />
                  Discount %
                </Button>
                <Button
                  variant={negotiationMode === 'fixed' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setNegotiationMode('fixed')}
                  data-testid="button-nego-fixed"
                >
                  <DollarSign className="w-4 h-4 mr-1" />
                  Fixed Price
                </Button>
              </div>
            </div>

            {negotiationMode !== 'none' && (
              <div className="space-y-2">
                <Label htmlFor="nego-value">
                  {negotiationMode === 'percentage' ? 'Discount Percentage (%)' : 'Fixed Price per Box (₹)'}
                </Label>
                <Input
                  id="nego-value"
                  type="number"
                  step="0.01"
                  placeholder={negotiationMode === 'percentage' ? 'e.g. 10' : 'e.g. 25.00'}
                  value={negotiationValue}
                  onChange={(e) => setNegotiationValue(e.target.value)}
                  data-testid="input-nego-value"
                />
              </div>
            )}

            {negotiatingItemIdx !== null && quoteItems[negotiatingItemIdx] && negotiationMode !== 'none' && negotiationValue && (
              <div className="p-3 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Original Price:</span>
                  <span className="line-through">₹{quoteItems[negotiatingItemIdx].totalCostPerBox.toFixed(2)}/pc</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Negotiated Price:</span>
                  <span className="text-green-600">
                    ₹{(negotiationMode === 'percentage' 
                      ? quoteItems[negotiatingItemIdx].totalCostPerBox * (1 - parseFloat(negotiationValue) / 100)
                      : parseFloat(negotiationValue)
                    ).toFixed(2)}/pc
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">New Total ({quoteItems[negotiatingItemIdx].quantity} pcs):</span>
                  <span className="text-green-600 font-semibold">
                    ₹{((negotiationMode === 'percentage' 
                      ? quoteItems[negotiatingItemIdx].totalCostPerBox * (1 - parseFloat(negotiationValue) / 100)
                      : parseFloat(negotiationValue)
                    ) * quoteItems[negotiatingItemIdx].quantity).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setNegotiatingItemIdx(null);
                  setNegotiationMode('none');
                  setNegotiationValue('');
                }}
                className="flex-1"
                data-testid="button-cancel-nego"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (negotiatingItemIdx !== null) {
                    const item = quoteItems[negotiatingItemIdx];
                    let newNegotiatedPrice: number | undefined;
                    
                    if (negotiationMode === 'none') {
                      newNegotiatedPrice = undefined;
                    } else if (negotiationMode === 'percentage') {
                      newNegotiatedPrice = item.totalCostPerBox * (1 - parseFloat(negotiationValue) / 100);
                    } else {
                      newNegotiatedPrice = parseFloat(negotiationValue);
                    }
                    
                    const newItems = [...quoteItems];
                    newItems[negotiatingItemIdx] = {
                      ...item,
                      negotiationMode: negotiationMode,
                      negotiationValue: parseFloat(negotiationValue) || undefined,
                      originalPrice: item.totalCostPerBox,
                      negotiatedPrice: newNegotiatedPrice,
                      totalValue: newNegotiatedPrice 
                        ? newNegotiatedPrice * item.quantity 
                        : item.totalCostPerBox * item.quantity,
                    };
                    setQuoteItems(newItems);
                    setNegotiatingItemIdx(null);
                    setNegotiationMode('none');
                    setNegotiationValue('');
                    
                    toast({
                      title: negotiationMode === 'none' ? "Negotiation removed" : "Price negotiated",
                      description: negotiationMode === 'none' 
                        ? "Price reset to original" 
                        : `New price: ₹${newNegotiatedPrice?.toFixed(2)}/pc`,
                    });
                  }
                }}
                className="flex-1"
                data-testid="button-apply-nego"
              >
                Apply
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Version History Dialog */}
      <Dialog open={showVersionHistory} onOpenChange={setShowVersionHistory}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Box Specification History
            </DialogTitle>
            <DialogDescription>
              View and restore previous versions of your box specifications
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {boxSpecifications.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No saved specifications yet. Add items to your quote to create specifications.
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Select Box Specification</Label>
                  <Select 
                    value={selectedSpecId || ""} 
                    onValueChange={setSelectedSpecId}
                  >
                    <SelectTrigger data-testid="select-box-spec">
                      <SelectValue placeholder="Choose a box specification..." />
                    </SelectTrigger>
                    <SelectContent>
                      {boxSpecifications.map((spec: any) => (
                        <SelectItem key={spec.id} value={spec.id}>
                          {spec.boxType.toUpperCase()} - {spec.length}x{spec.breadth}
                          {spec.height ? `x${spec.height}` : ''} ({spec.ply}-Ply)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {selectedSpecId && (
                  <div className="space-y-2">
                    <Label>Version History</Label>
                    {specVersions.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No versions found</p>
                    ) : (
                      <div className="border rounded-md divide-y">
                        {specVersions.map((version: any) => (
                          <div key={version.id} className="p-3 flex items-center justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary">v{version.versionNumber}</Badge>
                                <span className="text-sm text-muted-foreground">
                                  {new Date(version.editedAt).toLocaleDateString('en-IN', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              </div>
                              {version.changeNote && (
                                <p className="text-sm text-muted-foreground mt-1">{version.changeNote}</p>
                              )}
                            </div>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => restoreVersionMutation.mutate({ 
                                    specId: selectedSpecId, 
                                    versionNumber: version.versionNumber 
                                  })}
                                  disabled={restoreVersionMutation.isPending}
                                  data-testid={`button-restore-v${version.versionNumber}`}
                                >
                                  <RotateCcw className="w-4 h-4 mr-1" />
                                  Restore
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Restore to this version</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
}
