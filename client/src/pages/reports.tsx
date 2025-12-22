import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Download, 
  Search, 
  FileText, 
  Filter, 
  Calendar,
  Users,
  Package,
  FileSpreadsheet,
  Bookmark,
  Printer,
  ClipboardList,
  Save,
  ChevronRight,
  Eye,
  Edit,
  ArrowLeft,
  Columns,
  Check
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { downloadGenericExcel } from "@/lib/excelExport";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatPaperSpecs } from "@/lib/utils";
import type { PartyProfile } from "@shared/schema";

// Extended quote type with items from active version
interface QuoteWithItems {
  id: string;
  quoteNo: string;
  partyName: string;
  customerCompany: string | null;
  status: string | null;
  createdAt: Date | null;
  items: any[];
  activeVersion: any | null;
}

// URL state management hook for filter preservation
function useReportsState() {
  const [location, setLocation] = useLocation();
  
  // Parse URL query params
  const getParams = useCallback(() => {
    const searchParams = new URLSearchParams(window.location.search);
    return {
      tab: searchParams.get('tab') || 'quote-register',
      party: searchParams.get('party') || '',
      search: searchParams.get('search') || '',
      startDate: searchParams.get('startDate') || '',
      endDate: searchParams.get('endDate') || '',
      partyId: searchParams.get('partyId') || '',
      page: parseInt(searchParams.get('page') || '1', 10),
    };
  }, []);

  const [state, setState] = useState(getParams);

  // Sync state to URL
  const updateState = useCallback((updates: Partial<typeof state>) => {
    const newState = { ...state, ...updates };
    setState(newState);
    
    const params = new URLSearchParams();
    if (newState.tab && newState.tab !== 'quote-register') params.set('tab', newState.tab);
    if (newState.party) params.set('party', newState.party);
    if (newState.search) params.set('search', newState.search);
    if (newState.startDate) params.set('startDate', newState.startDate);
    if (newState.endDate) params.set('endDate', newState.endDate);
    if (newState.partyId) params.set('partyId', newState.partyId);
    if (newState.page > 1) params.set('page', newState.page.toString());
    
    const queryString = params.toString();
    const newUrl = queryString ? `/reports?${queryString}` : '/reports';
    
    if (window.location.pathname + window.location.search !== newUrl) {
      window.history.replaceState({}, '', newUrl);
    }
  }, [state]);

  // Listen for popstate (browser back/forward)
  useEffect(() => {
    const handlePopState = () => {
      setState(getParams());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [getParams]);

  return { state, updateState };
}

// Breadcrumb component for navigation context
function ReportsBreadcrumb({ 
  items 
}: { 
  items: Array<{ label: string; href?: string }> 
}) {
  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-4" data-testid="breadcrumb-nav">
      {items.map((item, idx) => (
        <span key={idx} className="flex items-center gap-1">
          {idx > 0 && <ChevronRight className="w-4 h-4" />}
          {item.href ? (
            <Link 
              href={item.href}
              className="hover:text-foreground transition-colors"
              data-testid={`breadcrumb-${idx}`}
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export default function Reports() {
  const { state, updateState } = useReportsState();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  
  // Party Price Audit state (local only - not persisted to URL)
  const [auditPartyName, setAuditPartyName] = useState<string>("");
  const [auditStartDate, setAuditStartDate] = useState("");
  const [auditEndDate, setAuditEndDate] = useState("");
  const [auditBoxNameFilter, setAuditBoxNameFilter] = useState("");
  const [auditBoxDescFilter, setAuditBoxDescFilter] = useState("");
  const [auditBoxSizeFilter, setAuditBoxSizeFilter] = useState("");
  const [negotiatedInputs, setNegotiatedInputs] = useState<Record<string, string>>({});
  
  // Column visibility for Quote Register
  const [columnVisibility, setColumnVisibility] = useState({
    quoteNo: true,
    date: true,
    party: true,
    company: true,
    items: true,
    status: true,
    value: true,
    actions: true
  });
  
  // Quick date presets helper
  const applyDatePreset = useCallback((preset: string) => {
    const today = new Date();
    let startDate = '';
    let endDate = '';
    
    switch(preset) {
      case 'today':
        startDate = endDate = today.toISOString().split('T')[0];
        break;
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        startDate = endDate = yesterday.toISOString().split('T')[0];
        break;
      case 'thisWeek':
        const weekStart = new Date(today);
        // Use Monday as week start (ISO week standard)
        const dayOfWeek = today.getDay();
        const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday=0, Monday=1, etc.
        weekStart.setDate(today.getDate() - mondayOffset);
        startDate = weekStart.toISOString().split('T')[0];
        endDate = today.toISOString().split('T')[0];
        break;
      case 'thisMonth':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        endDate = today.toISOString().split('T')[0];
        break;
      case 'lastMonth':
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
        startDate = lastMonth.toISOString().split('T')[0];
        endDate = lastMonthEnd.toISOString().split('T')[0];
        break;
      case 'thisYear':
        startDate = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
        endDate = today.toISOString().split('T')[0];
        break;
    }
    
    updateState({ startDate, endDate });
  }, [updateState]);
  
  const printRef = useRef<HTMLDivElement>(null);

  // Audit log: Track report tab views
  useEffect(() => {
    if (state.tab) {
      console.log("[Audit] Report viewed:", {
        action: "REPORT_VIEW",
        reportType: state.tab,
        filters: {
          party: state.party || 'all',
          search: state.search || null,
          dateRange: state.startDate && state.endDate ? `${state.startDate} to ${state.endDate}` : null
        },
        timestamp: new Date().toISOString()
      });
    }
  }, [state.tab, state.party, state.startDate, state.endDate]);

  const { data: partyProfiles = [], isLoading: isLoadingParties } = useQuery<PartyProfile[]>({
    queryKey: ['/api/party-profiles'],
  });

  // Fetch quotes with items from active versions (for reports)
  const { data: allQuotes = [], isLoading: isLoadingQuotes } = useQuery<QuoteWithItems[]>({
    queryKey: ['/api/quotes', 'include=items'],
    queryFn: async () => {
      const res = await fetch('/api/quotes?include=items', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch quotes');
      return res.json();
    },
  });

  // Filtered quotes based on URL state
  const filteredQuotes = useMemo(() => {
    let quotes = allQuotes;

    if (state.party && state.party !== "all") {
      quotes = quotes.filter(q => q.partyName === state.party);
    }

    if (state.search) {
      const term = state.search.toLowerCase();
      quotes = quotes.filter(q => 
        q.partyName?.toLowerCase().includes(term) ||
        q.customerCompany?.toLowerCase().includes(term) ||
        q.quoteNo?.toLowerCase().includes(term) ||
        JSON.stringify(q.items || []).toLowerCase().includes(term)
      );
    }

    if (state.startDate) {
      const start = new Date(state.startDate);
      quotes = quotes.filter(q => new Date(q.createdAt || "") >= start);
    }

    if (state.endDate) {
      const end = new Date(state.endDate);
      end.setHours(23, 59, 59, 999);
      quotes = quotes.filter(q => new Date(q.createdAt || "") <= end);
    }

    return quotes.sort((a, b) => 
      new Date(b.createdAt || "").getTime() - new Date(a.createdAt || "").getTime()
    );
  }, [allQuotes, state.party, state.search, state.startDate, state.endDate]);

  // Party statistics for Party Summary
  const partyStats = useMemo(() => {
    const stats: Record<string, { 
      name: string; 
      company: string; 
      quoteCount: number; 
      totalValue: number;
      partyId: string | null;
    }> = {};
    
    allQuotes.forEach(quote => {
      const partyName = quote.partyName || "Unknown";
      if (!stats[partyName]) {
        // Find party profile to get partyId
        const profile = partyProfiles.find(p => p.personName === partyName);
        stats[partyName] = {
          name: partyName,
          company: quote.customerCompany || "",
          quoteCount: 0,
          totalValue: 0,
          partyId: profile?.id || null
        };
      }
      stats[partyName].quoteCount++;
      const items = quote.items as any[];
      if (items && Array.isArray(items)) {
        items.forEach(item => {
          const costPerBox = item.negotiatedPrice || item.totalCostPerBox || 0;
          stats[partyName].totalValue += parseFloat(costPerBox) * (item.quantity || 1);
        });
      }
    });
    
    return Object.entries(stats)
      .map(([name, data]) => ({ id: name, ...data }))
      .sort((a, b) => b.totalValue - a.totalValue);
  }, [allQuotes, partyProfiles]);

  // Item statistics for Item Prices report
  const itemStats = useMemo(() => {
    const stats: Record<string, { 
      boxName: string; 
      ply: string; 
      count: number; 
      avgPrice: number; 
      totalQty: number;
      quoteIds: string[];
    }> = {};
    
    allQuotes.forEach(quote => {
      const items = quote.items as any[];
      if (items && Array.isArray(items)) {
        items.forEach(item => {
          const key = `${item.boxName || 'Unnamed'}-${item.ply || '5'}`;
          if (!stats[key]) {
            stats[key] = {
              boxName: item.boxName || 'Unnamed',
              ply: item.ply || '5',
              count: 0,
              avgPrice: 0,
              totalQty: 0,
              quoteIds: []
            };
          }
          stats[key].count++;
          const costPerBox = item.negotiatedPrice || item.totalCostPerBox || 0;
          stats[key].avgPrice = ((stats[key].avgPrice * (stats[key].count - 1)) + parseFloat(costPerBox)) / stats[key].count;
          stats[key].totalQty += (item.quantity || 0);
          if (!stats[key].quoteIds.includes(quote.id)) {
            stats[key].quoteIds.push(quote.id);
          }
        });
      }
    });
    
    return Object.values(stats).sort((a, b) => b.count - a.count);
  }, [allQuotes]);

  // Paper consumption data with layer-wise details
  const paperConsumptionData = useMemo(() => {
    const stats: Record<string, { 
      bf: string; 
      gsm: string; 
      shade: string; 
      paperType: string;
      layerNumber: number;
      totalKg: number; 
      totalValue: number;
      quoteCount: number;
    }> = {};
    
    filteredQuotes.forEach(quote => {
      const items = quote.items as any[];
      if (items && Array.isArray(items)) {
        items.forEach(item => {
          const layers = item.layerSpecs || item.layers || [];
          if (layers && Array.isArray(layers)) {
            layers.forEach((layer: any, layerIdx: number) => {
              const bf = layer.bf || 'Unknown';
              const gsm = layer.gsm || 'Unknown';
              const shade = layer.shade || 'Unknown';
              const paperType = layer.paperType || layer.type || 'Kraft';
              const key = `${bf}-${gsm}-${shade}-${paperType}-${layerIdx + 1}`;
              
              if (!stats[key]) {
                stats[key] = {
                  bf,
                  gsm: gsm.toString(),
                  shade,
                  paperType,
                  layerNumber: layerIdx + 1,
                  totalKg: 0,
                  totalValue: 0,
                  quoteCount: 0
                };
              }
              const layerWeight = parseFloat(layer.layerWeight || layer.weight || 0);
              const qty = item.quantity || 1;
              stats[key].totalKg += (layerWeight * qty) / 1000;
              const rate = parseFloat(layer.rate || 0);
              stats[key].totalValue += (layerWeight * rate * qty) / 1000;
              stats[key].quoteCount++;
            });
          }
        });
      }
    });
    
    return Object.values(stats).sort((a, b) => b.totalKg - a.totalKg);
  }, [filteredQuotes]);

  // Unique party names for filter dropdown
  const uniquePartyNames = useMemo(() => {
    const names = new Set<string>();
    allQuotes.forEach(q => {
      if (q.partyName) names.add(q.partyName);
    });
    partyProfiles.forEach(p => {
      if (p.personName) names.add(p.personName);
    });
    return Array.from(names).sort();
  }, [allQuotes, partyProfiles]);

  // Party Price Audit data
  const auditPartyProfile = useMemo(() => {
    return partyProfiles.find(p => p.personName === auditPartyName);
  }, [partyProfiles, auditPartyName]);

  const auditQuotesData = useMemo(() => {
    if (!auditPartyName) return [];
    
    let quotes = allQuotes.filter(q => q.partyName === auditPartyName);
    
    if (auditStartDate) {
      const start = new Date(auditStartDate);
      quotes = quotes.filter(q => new Date(q.createdAt || "") >= start);
    }
    if (auditEndDate) {
      const end = new Date(auditEndDate);
      end.setHours(23, 59, 59, 999);
      quotes = quotes.filter(q => new Date(q.createdAt || "") <= end);
    }
    
    return quotes.map(quote => {
      const allItems = (quote.items || []) as any[];
      let items = allItems.map((item, idx) => ({ ...item, originalIndex: idx }));
      
      if (auditBoxNameFilter) {
        const term = auditBoxNameFilter.toLowerCase();
        items = items.filter(item => 
          (item.boxName || '').toLowerCase().includes(term)
        );
      }
      
      if (auditBoxDescFilter) {
        const term = auditBoxDescFilter.toLowerCase();
        items = items.filter(item => 
          (item.boxDescription || '').toLowerCase().includes(term)
        );
      }
      
      if (auditBoxSizeFilter) {
        const term = auditBoxSizeFilter.toLowerCase();
        items = items.filter(item => {
          const sizeStr = `${item.length || 0}×${item.width || 0}×${item.height || 0}`.toLowerCase();
          return sizeStr.includes(term);
        });
      }
      
      return { ...quote, filteredItems: items, allItems };
    }).filter(q => q.filteredItems.length > 0);
  }, [allQuotes, auditPartyName, auditStartDate, auditEndDate, auditBoxNameFilter, auditBoxDescFilter, auditBoxSizeFilter]);

  // Helper to format paper specification using centralized utility
  const formatPaperSpec = (item: any): string => {
    const layers = item.layerSpecs || item.layers || [];
    return formatPaperSpecs(layers);
  };

  const hasNegotiatedInputs = useMemo(() => {
    return Object.values(negotiatedInputs).some(v => v && v.trim() !== '');
  }, [negotiatedInputs]);

  // Save negotiated prices mutation
  const saveNegotiatedMutation = useMutation({
    mutationFn: async (data: { quoteId: string; itemIndex: number; negotiatedPrice: number }[]) => {
      const byQuote: Record<string, { itemIndex: number; negotiatedPrice: number }[]> = {};
      data.forEach(d => {
        if (!byQuote[d.quoteId]) byQuote[d.quoteId] = [];
        byQuote[d.quoteId].push({ itemIndex: d.itemIndex, negotiatedPrice: d.negotiatedPrice });
      });
      
      const promises = Object.entries(byQuote).map(async ([quoteId, items]) => {
        return apiRequest('POST', `/api/quotes/${quoteId}/bulk-negotiate`, { negotiations: items });
      });
      
      return Promise.all(promises);
    },
    onSuccess: () => {
      setNegotiatedInputs({});
      // Invalidate all quotes queries including those with query params
      queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/quotes?include=items'] });
      toast({
        title: "Prices Updated",
        description: "New quote versions created with negotiated prices.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save negotiated prices",
        variant: "destructive",
      });
    },
  });

  const handleSaveNegotiatedPrices = () => {
    const toSave: { quoteId: string; itemIndex: number; negotiatedPrice: number }[] = [];
    
    Object.entries(negotiatedInputs).forEach(([key, value]) => {
      if (value && value.trim() !== '') {
        const parts = key.split('_');
        const quoteId = parts.slice(0, -1).join('_');
        const itemIndexStr = parts[parts.length - 1];
        const price = parseFloat(value);
        if (!isNaN(price) && price > 0) {
          toSave.push({
            quoteId,
            itemIndex: parseInt(itemIndexStr, 10),
            negotiatedPrice: price,
          });
        }
      }
    });
    
    if (toSave.length === 0) {
      toast({
        title: "No Prices to Save",
        description: "Please enter negotiated prices for at least one item.",
        variant: "destructive",
      });
      return;
    }
    
    if (confirm(`This will create new versions for ${new Set(toSave.map(t => t.quoteId)).size} affected quote(s). Continue?`)) {
      saveNegotiatedMutation.mutate(toSave);
    }
  };

  // Navigation handlers - redirect to quote editor with return context
  const navigateToQuoteEdit = (quoteId: string) => {
    // Encode current report state for return navigation
    const returnState = encodeURIComponent(JSON.stringify({
      tab: state.tab,
      party: state.party,
      search: state.search,
      startDate: state.startDate,
      endDate: state.endDate,
      page: state.page
    }));
    // Navigate to Calculator (create-quote) in edit mode with return context
    setLocation(`/create-quote?quoteId=${quoteId}&from=reports&state=${returnState}`);
  };

  const navigateToPartyDetail = (partyName: string) => {
    updateState({ tab: 'party-detail', partyId: partyName });
  };

  // Print function
  const handlePrint = () => {
    if (printRef.current) {
      const printContent = printRef.current.innerHTML;
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Party Price Audit Report - ${auditPartyName}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              table { border-collapse: collapse; width: 100%; margin-top: 10px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
              th { background-color: #f5f5f5; font-weight: bold; }
              .header { margin-bottom: 20px; }
              .header h1 { margin: 0; font-size: 24px; }
              .header p { margin: 5px 0; color: #666; }
              .quote-group { margin-top: 20px; }
              .quote-header { background: #f0f0f0; padding: 10px; font-weight: bold; }
              @media print {
                .no-print { display: none; }
                body { margin: 0; }
              }
            </style>
          </head>
          <body>
            ${printContent}
          </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

  const handleExportPDF = () => {
    // Audit log: PDF export
    console.log("[Audit] Report export:", {
      action: "REPORT_EXPORT_PDF",
      reportType: "party-audit",
      partyName: auditPartyName,
      timestamp: new Date().toISOString()
    });
    handlePrint();
  };

  const exportPartyAuditToExcel = () => {
    if (!auditPartyName) return;
    
    // Audit log: Excel export
    console.log("[Audit] Report export:", {
      action: "REPORT_EXPORT_EXCEL",
      reportType: "party-audit",
      partyName: auditPartyName,
      timestamp: new Date().toISOString()
    });
    
    const exportData: any[] = [];
    const partyGst = auditPartyProfile?.gstNo || '-';
    
    auditQuotesData.forEach(quote => {
      quote.filteredItems.forEach((item: any) => {
        const finalRate = item.negotiatedPrice || item.totalCostPerBox || 0;
        const qty = item.quantity || 1;
        const finalTotal = parseFloat(finalRate) * qty;
        
        exportData.push({
          "Party Name": auditPartyName,
          "Party GST": partyGst,
          "Quote No": quote.quoteNo || '-',
          "Quote Date": quote.createdAt ? new Date(quote.createdAt).toLocaleDateString() : '-',
          "Box Name": item.boxName || '-',
          "Box Description": item.boxDescription || '-',
          "Remarks": item.remarks || '-',
          "Paper Specification (GSM/BF)": formatPaperSpec(item),
          "Ply": item.ply || '-',
          "Box Size (L×W×H mm)": item.height 
            ? `${Math.round(item.length || 0)}×${Math.round(item.width || 0)}×${Math.round(item.height || 0)}`
            : `${Math.round(item.length || 0)}×${Math.round(item.width || 0)}`,
          "Printing Type": item.printingEnabled ? (item.printType || 'Printed') : 'Plain',
          "Number of Colors": item.printColours || 0,
          "Reel Size / Deckle": item.sheetWidth ? `${item.sheetWidth.toFixed(2)}` : '-',
          "Sheet Cut Length": item.sheetLength ? `${item.sheetLength.toFixed(2)}` : '-',
          "Final Rate per Box": parseFloat(finalRate).toFixed(2),
          "Final Total Amount": finalTotal.toFixed(2),
        });
      });
    });
    
    if (exportData.length === 0) {
      toast({
        title: "No Data",
        description: "No data to export",
        variant: "destructive",
      });
      return;
    }
    
    const sanitizedName = auditPartyName.replace(/[^a-zA-Z0-9]/g, '_');
    const today = new Date().toISOString().split('T')[0];
    downloadGenericExcel(exportData, `Party_Price_Audit_${sanitizedName}_${today}`);
  };

  const clearAuditFilters = () => {
    setAuditStartDate("");
    setAuditEndDate("");
    setAuditBoxNameFilter("");
    setAuditBoxDescFilter("");
    setAuditBoxSizeFilter("");
    setNegotiatedInputs({});
  };

  const exportCurrentReport = () => {
    let exportData: any[] = [];
    let filename = "";
    
    switch (state.tab) {
      case "quote-register":
        filteredQuotes.forEach(quote => {
          const items = quote.items as any[] || [];
          const totalValue = items.reduce((sum, item) => {
            const costPerBox = item.negotiatedPrice || item.totalCostPerBox || 0;
            return sum + (parseFloat(costPerBox) * (item.quantity || 1));
          }, 0);
          
          exportData.push({
            "Quote No": quote.quoteNo || "-",
            "Date": quote.createdAt ? new Date(quote.createdAt).toLocaleDateString() : "",
            "Party Name": quote.partyName,
            "Company": quote.customerCompany,
            "Items": items.length,
            "Status": quote.status || "Draft",
            "Total Value": totalValue.toFixed(2)
          });
        });
        filename = `quote_register_${new Date().toISOString().split('T')[0]}`;
        break;
        
      case "party-summary":
        partyStats.forEach(stat => {
          exportData.push({
            "Party Name": stat.name,
            "Company": stat.company,
            "Quote Count": stat.quoteCount,
            "Total Value": stat.totalValue.toFixed(2)
          });
        });
        filename = `party_summary_${new Date().toISOString().split('T')[0]}`;
        break;
        
      case "item-price":
        itemStats.forEach(stat => {
          exportData.push({
            "Box Name": stat.boxName,
            "Ply": stat.ply,
            "Quote Count": stat.count,
            "Avg Price/Box": stat.avgPrice.toFixed(2),
            "Total Quantity": stat.totalQty
          });
        });
        filename = `item_price_report_${new Date().toISOString().split('T')[0]}`;
        break;
        
      case "paper-specs":
        paperConsumptionData.forEach(item => {
          exportData.push({
            "Layer": `Layer ${item.layerNumber}`,
            "BF": item.bf,
            "GSM": item.gsm,
            "Shade": item.shade,
            "Paper Type": item.paperType,
            "Total KG": item.totalKg.toFixed(2),
            "Total Value": item.totalValue.toFixed(2),
            "Quote Count": item.quoteCount
          });
        });
        filename = `paper_specs_${new Date().toISOString().split('T')[0]}`;
        break;
        
      default:
        return;
    }

    if (exportData.length === 0) {
      return;
    }

    downloadGenericExcel(exportData, filename);
  };

  const clearFilters = () => {
    updateState({ party: "", search: "", startDate: "", endDate: "", page: 1 });
  };

  if (isLoadingParties || isLoadingQuotes) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Report tabs configuration (removed: date-sales, cost-breakdown, gst-tax)
  const reportTabs = [
    { id: "quote-register", label: "Quote Register", icon: FileText },
    { id: "party-summary", label: "Party Summary", icon: Users },
    { id: "item-price", label: "Item Prices", icon: Package },
    { id: "paper-specs", label: "Paper Specs", icon: FileSpreadsheet },
    { id: "party-audit", label: "Party Audit", icon: ClipboardList },
    { id: "saved-reports", label: "Saved Reports", icon: Bookmark },
  ];

  // Party Detail View (drill-down from Party Summary)
  if (state.tab === 'party-detail' && state.partyId) {
    const partyQuotes = allQuotes.filter(q => q.partyName === state.partyId);
    const partyProfile = partyProfiles.find(p => p.personName === state.partyId);
    
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <ReportsBreadcrumb items={[
            { label: "Reports", href: "/reports" },
            { label: "Party Summary", href: "/reports?tab=party-summary" },
            { label: state.partyId }
          ]} />
          
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-foreground" data-testid="text-party-detail-title">
                {state.partyId}
              </h1>
              <p className="text-sm text-muted-foreground">
                {partyProfile?.companyName || 'All quotes for this party'}
              </p>
            </div>
            <Button 
              variant="outline"
              onClick={() => updateState({ tab: 'party-summary', partyId: '' })}
              data-testid="button-back-to-summary"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Party Summary
            </Button>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quotes for {state.partyId}</CardTitle>
              <CardDescription>
                {partyQuotes.length} quotes found
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quote No</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-center">Items</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {partyQuotes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No quotes found for this party
                        </TableCell>
                      </TableRow>
                    ) : (
                      partyQuotes.map((quote) => {
                        const items = quote.items as any[] || [];
                        const totalValue = items.reduce((sum, item) => {
                          const costPerBox = item.negotiatedPrice || item.totalCostPerBox || 0;
                          return sum + (parseFloat(costPerBox) * (item.quantity || 1));
                        }, 0);
                        return (
                          <TableRow 
                            key={quote.id} 
                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                            data-testid={`party-quote-row-${quote.id}`}
                          >
                            <TableCell 
                              className="font-mono text-sm text-primary cursor-pointer hover:underline"
                              onClick={() => navigateToQuoteEdit(quote.id)}
                            >
                              {quote.quoteNo || "-"}
                            </TableCell>
                            <TableCell className="text-sm">
                              {quote.createdAt ? new Date(quote.createdAt).toLocaleDateString() : "-"}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline">{items.length}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={quote.status === 'confirmed' ? 'default' : 'secondary'}>
                                {quote.status || 'Draft'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              ₹{totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button 
                                  size="icon" 
                                  variant="ghost"
                                  onClick={() => navigateToQuoteEdit(quote.id)}
                                  data-testid={`button-edit-quote-${quote.id}`}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <ReportsBreadcrumb items={[
          { label: "Reports" }
        ]} />
        
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="text-reports-title">Reports</h1>
            <p className="text-sm text-muted-foreground">Comprehensive business analytics and reporting</p>
          </div>
          <Button 
            onClick={exportCurrentReport}
            disabled={filteredQuotes.length === 0 && state.tab !== "saved-reports"}
            data-testid="button-export-excel"
          >
            <Download className="w-4 h-4 mr-2" />
            Export to Excel
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="party-filter">Party</Label>
                <Select value={state.party} onValueChange={(v) => updateState({ party: v })}>
                  <SelectTrigger id="party-filter" data-testid="select-party-filter">
                    <SelectValue placeholder="All Parties" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Parties</SelectItem>
                    {uniquePartyNames.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="search-filter">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    id="search-filter"
                    placeholder="Search..."
                    value={state.search}
                    onChange={(e) => updateState({ search: e.target.value })}
                    className="pl-9"
                    data-testid="input-search-quotes"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Date Range
                </Label>
                <div className="flex flex-wrap gap-1 mb-2">
                  <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => applyDatePreset('today')} data-testid="btn-preset-today">Today</Button>
                  <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => applyDatePreset('yesterday')} data-testid="btn-preset-yesterday">Yest</Button>
                  <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => applyDatePreset('thisWeek')} data-testid="btn-preset-week">Week</Button>
                  <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => applyDatePreset('thisMonth')} data-testid="btn-preset-month">Month</Button>
                  <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => applyDatePreset('lastMonth')} data-testid="btn-preset-lastmonth">Prev</Button>
                </div>
                <Input 
                  type="date"
                  value={state.startDate}
                  onChange={(e) => updateState({ startDate: e.target.value })}
                  data-testid="input-start-date"
                />
                <Input 
                  type="date"
                  value={state.endDate}
                  onChange={(e) => updateState({ endDate: e.target.value })}
                  data-testid="input-end-date"
                />
              </div>

              <Button 
                variant="outline" 
                className="w-full"
                onClick={clearFilters}
                data-testid="button-clear-filters"
              >
                Clear Filters
              </Button>
            </CardContent>
          </Card>

          <div className="lg:col-span-4">
            <Tabs value={state.tab} onValueChange={(v) => updateState({ tab: v })}>
              <TabsList className="grid grid-cols-3 lg:grid-cols-6 gap-1 h-auto p-1 mb-4">
                {reportTabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <TabsTrigger 
                      key={tab.id} 
                      value={tab.id}
                      className="flex flex-col items-center gap-1 py-2 px-1 text-xs"
                      data-testid={`tab-${tab.id}`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="hidden sm:block truncate">{tab.label}</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {/* Quote Register - Actionable Rows */}
              <TabsContent value="quote-register" className="space-y-4">
                <Card>
                  <CardHeader className="pb-3 flex flex-row items-center justify-between gap-4">
                    <div>
                      <CardTitle className="text-base">Quote Register</CardTitle>
                      <CardDescription>
                        Complete list of all quotes ({filteredQuotes.length} records) - Click quote number to edit
                      </CardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" data-testid="button-column-chooser">
                          <Columns className="w-4 h-4 mr-2" />
                          Columns
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuCheckboxItem
                          checked={columnVisibility.quoteNo}
                          onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, quoteNo: checked }))}
                        >
                          Quote No
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem
                          checked={columnVisibility.date}
                          onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, date: checked }))}
                        >
                          Date
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem
                          checked={columnVisibility.party}
                          onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, party: checked }))}
                        >
                          Party
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem
                          checked={columnVisibility.company}
                          onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, company: checked }))}
                        >
                          Company
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem
                          checked={columnVisibility.items}
                          onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, items: checked }))}
                        >
                          Items
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem
                          checked={columnVisibility.status}
                          onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, status: checked }))}
                        >
                          Status
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem
                          checked={columnVisibility.value}
                          onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, value: checked }))}
                        >
                          Value
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem
                          checked={columnVisibility.actions}
                          onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, actions: checked }))}
                        >
                          Actions
                        </DropdownMenuCheckboxItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border max-h-[600px] overflow-auto">
                      <Table>
                        <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
                          <TableRow>
                            {columnVisibility.quoteNo && <TableHead>Quote No</TableHead>}
                            {columnVisibility.date && <TableHead>Date</TableHead>}
                            {columnVisibility.party && <TableHead>Party</TableHead>}
                            {columnVisibility.company && <TableHead>Company</TableHead>}
                            {columnVisibility.items && <TableHead className="text-center">Items</TableHead>}
                            {columnVisibility.status && <TableHead>Status</TableHead>}
                            {columnVisibility.value && <TableHead className="text-right">Value</TableHead>}
                            {columnVisibility.actions && <TableHead className="text-center">Actions</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredQuotes.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                No quotes found
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredQuotes.map((quote) => {
                              const items = quote.items as any[] || [];
                              const totalValue = items.reduce((sum, item) => {
                                const costPerBox = item.negotiatedPrice || item.totalCostPerBox || 0;
                                return sum + (parseFloat(costPerBox) * (item.quantity || 1));
                              }, 0);
                              return (
                                <TableRow 
                                  key={quote.id} 
                                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                                  data-testid={`quote-row-${quote.id}`}
                                >
                                  {columnVisibility.quoteNo && (
                                    <TableCell 
                                      className="font-mono text-sm text-primary cursor-pointer hover:underline"
                                      onClick={() => navigateToQuoteEdit(quote.id)}
                                    >
                                      {quote.quoteNo || "-"}
                                    </TableCell>
                                  )}
                                  {columnVisibility.date && (
                                    <TableCell className="text-sm">
                                      {quote.createdAt ? new Date(quote.createdAt).toLocaleDateString() : "-"}
                                    </TableCell>
                                  )}
                                  {columnVisibility.party && (
                                    <TableCell 
                                      className="font-medium text-primary cursor-pointer hover:underline"
                                      onClick={() => navigateToPartyDetail(quote.partyName)}
                                    >
                                      {quote.partyName}
                                    </TableCell>
                                  )}
                                  {columnVisibility.company && (
                                    <TableCell className="text-muted-foreground">{quote.customerCompany}</TableCell>
                                  )}
                                  {columnVisibility.items && (
                                    <TableCell className="text-center">
                                      <Badge variant="outline">{items.length}</Badge>
                                    </TableCell>
                                  )}
                                  {columnVisibility.status && (
                                    <TableCell>
                                      <Badge variant={quote.status === 'confirmed' ? 'default' : 'secondary'}>
                                        {quote.status || 'Draft'}
                                      </Badge>
                                    </TableCell>
                                  )}
                                  {columnVisibility.value && (
                                    <TableCell className="text-right font-mono">
                                      ₹{totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                    </TableCell>
                                  )}
                                  {columnVisibility.actions && (
                                    <TableCell className="text-center">
                                      <div className="flex items-center justify-center gap-1">
                                        <Button 
                                          size="icon" 
                                          variant="ghost"
                                          onClick={() => navigateToQuoteEdit(quote.id)}
                                          data-testid={`button-edit-quote-${quote.id}`}
                                        >
                                          <Edit className="w-4 h-4" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  )}
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Party Summary - Clickable for Drill-down */}
              <TabsContent value="party-summary" className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Party-wise Summary</CardTitle>
                    <CardDescription>
                      Business volume by customer ({partyStats.length} parties) - Click party name to view quotes
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Party Name</TableHead>
                            <TableHead>Company</TableHead>
                            <TableHead className="text-center">Quotes</TableHead>
                            <TableHead className="text-right">Total Value</TableHead>
                            <TableHead className="text-center">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {partyStats.map((stat, idx) => (
                            <TableRow 
                              key={stat.id} 
                              className="cursor-pointer hover:bg-muted/50 transition-colors"
                              data-testid={`party-row-${idx}`}
                            >
                              <TableCell 
                                className="font-medium text-primary cursor-pointer hover:underline"
                                onClick={() => navigateToPartyDetail(stat.name)}
                              >
                                {stat.name}
                              </TableCell>
                              <TableCell className="text-muted-foreground">{stat.company}</TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline">{stat.quoteCount}</Badge>
                              </TableCell>
                              <TableCell className="text-right font-mono font-medium">
                                ₹{stat.totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Button 
                                    size="icon" 
                                    variant="ghost"
                                    onClick={() => navigateToPartyDetail(stat.name)}
                                    data-testid={`button-view-party-${idx}`}
                                  >
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Item Prices - Actionable */}
              <TabsContent value="item-price" className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Item-wise Price Report</CardTitle>
                    <CardDescription>
                      Price trends by box specification ({itemStats.length} unique items)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Box Name</TableHead>
                            <TableHead>Ply</TableHead>
                            <TableHead className="text-center">Quoted Times</TableHead>
                            <TableHead className="text-right">Avg Price/Box</TableHead>
                            <TableHead className="text-right">Total Qty</TableHead>
                            <TableHead className="text-center">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {itemStats.map((stat, idx) => (
                            <TableRow 
                              key={idx} 
                              className="hover:bg-muted/50 transition-colors"
                              data-testid={`item-row-${idx}`}
                            >
                              <TableCell className="font-medium">{stat.boxName}</TableCell>
                              <TableCell>
                                <Badge variant="secondary">{stat.ply}-Ply</Badge>
                              </TableCell>
                              <TableCell className="text-center">{stat.count}</TableCell>
                              <TableCell className="text-right font-mono">
                                ₹{stat.avgPrice.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {stat.totalQty.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-center">
                                {stat.quoteIds.length > 0 && (
                                  <Button 
                                    size="icon" 
                                    variant="ghost"
                                    onClick={() => navigateToQuoteEdit(stat.quoteIds[0])}
                                    data-testid={`button-view-item-quote-${idx}`}
                                  >
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Paper Specs - Fixed to show GSM, BF, paper type, layer number */}
              <TabsContent value="paper-specs" className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Paper Specifications Report</CardTitle>
                    <CardDescription>
                      Layer-wise paper consumption details ({paperConsumptionData.length} specifications)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Layer</TableHead>
                            <TableHead>BF</TableHead>
                            <TableHead>GSM</TableHead>
                            <TableHead>Paper Type</TableHead>
                            <TableHead>Shade</TableHead>
                            <TableHead className="text-right">Total KG</TableHead>
                            <TableHead className="text-right">Total Value</TableHead>
                            <TableHead className="text-center">Quotes</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paperConsumptionData.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                No paper specification data available. Paper specs are derived from quote items with layer information.
                              </TableCell>
                            </TableRow>
                          ) : (
                            paperConsumptionData.map((item, idx) => (
                              <TableRow 
                                key={idx} 
                                className="hover:bg-muted/50 transition-colors"
                                data-testid={`paper-row-${idx}`}
                              >
                                <TableCell>
                                  <Badge variant="outline">Layer {item.layerNumber}</Badge>
                                </TableCell>
                                <TableCell className="font-medium">{item.bf}</TableCell>
                                <TableCell>{item.gsm}</TableCell>
                                <TableCell>
                                  <Badge variant="secondary">{item.paperType}</Badge>
                                </TableCell>
                                <TableCell>{item.shade}</TableCell>
                                <TableCell className="text-right font-mono">
                                  {item.totalKg.toFixed(2)} kg
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  ₹{item.totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="outline">{item.quoteCount}</Badge>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Party Audit */}
              <TabsContent value="party-audit" className="space-y-4">
                <Card>
                  <CardHeader className="pb-3 flex flex-row items-start justify-between gap-4 flex-wrap">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <ClipboardList className="w-4 h-4" />
                        Party Price Audit Report
                      </CardTitle>
                      <CardDescription>
                        Internal price audit for a single party - all quotes and box items
                      </CardDescription>
                    </div>
                    {auditPartyName && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button size="sm" variant="outline" onClick={handlePrint} data-testid="button-print-audit">
                          <Printer className="w-4 h-4 mr-1" />
                          Print
                        </Button>
                        <Button size="sm" variant="outline" onClick={handleExportPDF} data-testid="button-pdf-audit">
                          <Download className="w-4 h-4 mr-1" />
                          PDF
                        </Button>
                        <Button size="sm" variant="outline" onClick={exportPartyAuditToExcel} data-testid="button-excel-audit">
                          <FileSpreadsheet className="w-4 h-4 mr-1" />
                          Excel
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={handleSaveNegotiatedPrices}
                          disabled={!hasNegotiatedInputs || saveNegotiatedMutation.isPending}
                          data-testid="button-save-negotiated"
                        >
                          <Save className="w-4 h-4 mr-1" />
                          {saveNegotiatedMutation.isPending ? "Saving..." : "Save Negotiated Prices"}
                        </Button>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="mb-6 p-4 rounded-lg border bg-muted/50">
                      <div className="space-y-2 max-w-xs">
                        <Label htmlFor="audit-party">Select Party (Required)</Label>
                        <Select value={auditPartyName} onValueChange={setAuditPartyName}>
                          <SelectTrigger id="audit-party" data-testid="select-audit-party">
                            <SelectValue placeholder="Choose a party..." />
                          </SelectTrigger>
                          <SelectContent>
                            {partyProfiles.map((party) => (
                              <SelectItem key={party.id} value={party.personName}>
                                {party.personName} {party.companyName ? `(${party.companyName})` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    {auditPartyName && (
                      <div className="mb-6 p-4 rounded-lg border bg-muted/30">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                          <div className="space-y-2">
                            <Label>Date From</Label>
                            <Input 
                              type="date"
                              value={auditStartDate}
                              onChange={(e) => setAuditStartDate(e.target.value)}
                              data-testid="input-audit-start-date"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Date To</Label>
                            <Input 
                              type="date"
                              value={auditEndDate}
                              onChange={(e) => setAuditEndDate(e.target.value)}
                              data-testid="input-audit-end-date"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Box Name</Label>
                            <Input 
                              placeholder="Filter..."
                              value={auditBoxNameFilter}
                              onChange={(e) => setAuditBoxNameFilter(e.target.value)}
                              data-testid="input-audit-box-name"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Box Size</Label>
                            <Input 
                              placeholder="e.g. 200×150"
                              value={auditBoxSizeFilter}
                              onChange={(e) => setAuditBoxSizeFilter(e.target.value)}
                              data-testid="input-audit-box-size"
                            />
                          </div>
                          
                          <div className="flex items-end">
                            <Button variant="outline" size="sm" onClick={clearAuditFilters} data-testid="button-clear-audit-filters">
                              Clear Filters
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {!auditPartyName ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <ClipboardList className="w-12 h-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium mb-2">Select a Party</h3>
                        <p className="text-sm text-muted-foreground max-w-md">
                          Choose a party from the dropdown above to view their complete price audit report.
                        </p>
                      </div>
                    ) : auditQuotesData.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Package className="w-12 h-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium mb-2">No Quotes Found</h3>
                        <p className="text-sm text-muted-foreground max-w-md">
                          No quotes found for {auditPartyName} with the current filters.
                        </p>
                      </div>
                    ) : (
                      <div ref={printRef}>
                        <div className="header mb-6 p-4 border rounded-lg bg-muted/30">
                          <h1 className="text-xl font-bold">Party Price Audit Report</h1>
                          <p className="text-sm mt-1"><strong>Party:</strong> {auditPartyName}</p>
                          <p className="text-sm"><strong>GST No:</strong> {auditPartyProfile?.gstNo || 'N/A'}</p>
                          <p className="text-sm"><strong>Generated:</strong> {new Date().toLocaleDateString()}</p>
                        </div>
                        
                        {auditQuotesData.map((quote, qIdx) => (
                          <div key={quote.id} className="quote-group mb-6">
                            <div className="quote-header bg-muted px-4 py-2 rounded-t-lg border border-b-0">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-4">
                                  <span 
                                    className="font-semibold text-primary cursor-pointer hover:underline"
                                    onClick={() => navigateToQuoteEdit(quote.id)}
                                  >
                                    Quote: {quote.quoteNo || '-'}
                                  </span>
                                  <span className="text-muted-foreground">
                                    {quote.createdAt ? new Date(quote.createdAt).toLocaleDateString() : ''}
                                  </span>
                                  <Button 
                                    size="sm" 
                                    variant="ghost"
                                    onClick={() => navigateToQuoteEdit(quote.id)}
                                    data-testid={`button-edit-audit-quote-${qIdx}`}
                                  >
                                    <Edit className="w-4 h-4 mr-1" />
                                    Edit Quote
                                  </Button>
                                </div>
                                <Badge variant="outline">{quote.filteredItems.length} items</Badge>
                              </div>
                            </div>
                            <div className="rounded-b-lg border overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="min-w-[120px]">Box Name</TableHead>
                                    <TableHead className="min-w-[100px]">Description</TableHead>
                                    <TableHead>Remarks</TableHead>
                                    <TableHead className="min-w-[150px]">Paper Spec</TableHead>
                                    <TableHead>Ply</TableHead>
                                    <TableHead className="min-w-[100px]">Size (L×W×H)</TableHead>
                                    <TableHead>Print</TableHead>
                                    <TableHead>Colors</TableHead>
                                    <TableHead>Deckle</TableHead>
                                    <TableHead>Cut Length</TableHead>
                                    <TableHead className="text-right">Rate/Box</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                    <TableHead className="min-w-[120px] no-print">Neg. Rate</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {quote.filteredItems.map((item: any, iIdx: number) => {
                                    const finalRate = item.negotiatedPrice || item.totalCostPerBox || 0;
                                    const qty = item.quantity || 1;
                                    const finalTotal = parseFloat(finalRate) * qty;
                                    const inputKey = `${quote.id}_${item.originalIndex}`;
                                    
                                    return (
                                      <TableRow 
                                        key={iIdx} 
                                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                                        onClick={() => navigateToQuoteEdit(quote.id)}
                                        data-testid={`audit-item-${qIdx}-${iIdx}`}
                                      >
                                        <TableCell className="font-medium">{item.boxName || '-'}</TableCell>
                                        <TableCell className="text-muted-foreground text-sm">{item.boxDescription || '-'}</TableCell>
                                        <TableCell className="text-muted-foreground text-sm">{item.remarks || '-'}</TableCell>
                                        <TableCell className="font-mono text-xs">{formatPaperSpec(item)}</TableCell>
                                        <TableCell>
                                          <Badge variant="secondary">{item.ply || '-'}</Badge>
                                        </TableCell>
                                        <TableCell className="font-mono text-sm">
                                          {item.length || '-'}×{item.width || '-'}×{item.height || '-'}
                                        </TableCell>
                                        <TableCell>
                                          {item.printingEnabled ? (item.printType || 'Printed') : 'Plain'}
                                        </TableCell>
                                        <TableCell className="text-center">{item.printColours || 0}</TableCell>
                                        <TableCell className="font-mono text-sm">
                                          {item.sheetWidth ? item.sheetWidth.toFixed(1) : '-'}
                                        </TableCell>
                                        <TableCell className="font-mono text-sm">
                                          {item.sheetLength ? item.sheetLength.toFixed(1) : '-'}
                                        </TableCell>
                                        <TableCell className="text-right font-mono font-medium">
                                          ₹{parseFloat(finalRate).toFixed(2)}
                                        </TableCell>
                                        <TableCell className="text-right font-mono">
                                          ₹{finalTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                        </TableCell>
                                        <TableCell className="no-print" onClick={(e) => e.stopPropagation()}>
                                          <Input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            placeholder="New rate"
                                            value={negotiatedInputs[inputKey] || ''}
                                            onChange={(e) => setNegotiatedInputs(prev => ({
                                              ...prev,
                                              [inputKey]: e.target.value
                                            }))}
                                            className="w-24 h-8 text-sm"
                                            data-testid={`input-negotiate-${qIdx}-${iIdx}`}
                                          />
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Saved Reports */}
              <TabsContent value="saved-reports" className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Saved Reports</CardTitle>
                    <CardDescription>
                      Your saved report configurations
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Bookmark className="w-12 h-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium mb-2">No Saved Reports Yet</h3>
                      <p className="text-sm text-muted-foreground max-w-md">
                        Configure your filters and export settings, then save them here for quick access to frequently used reports.
                      </p>
                      <Button variant="outline" className="mt-4" disabled>
                        <Save className="w-4 h-4 mr-2" />
                        Save Current Report
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
