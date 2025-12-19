import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  TrendingUp,
  Calculator,
  FileSpreadsheet,
  Receipt,
  Bookmark,
  Printer,
  ClipboardList,
  Save
} from "lucide-react";
import { downloadGenericExcel } from "@/lib/excelExport";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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

export default function Reports() {
  const [activeTab, setActiveTab] = useState("quote-register");
  const [selectedPartyName, setSelectedPartyName] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  // Party Price Audit state
  const [auditPartyName, setAuditPartyName] = useState<string>("");
  const [auditStartDate, setAuditStartDate] = useState("");
  const [auditEndDate, setAuditEndDate] = useState("");
  const [auditBoxNameFilter, setAuditBoxNameFilter] = useState("");
  const [auditBoxDescFilter, setAuditBoxDescFilter] = useState("");
  const [auditBoxSizeFilter, setAuditBoxSizeFilter] = useState("");
  const [negotiatedInputs, setNegotiatedInputs] = useState<Record<string, string>>({});
  
  const printRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const filteredQuotes = useMemo(() => {
    let quotes = allQuotes;

    if (selectedPartyName && selectedPartyName !== "all") {
      quotes = quotes.filter(q => q.partyName === selectedPartyName);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      quotes = quotes.filter(q => 
        q.partyName?.toLowerCase().includes(term) ||
        q.customerCompany?.toLowerCase().includes(term) ||
        q.quoteNo?.toLowerCase().includes(term) ||
        JSON.stringify(q.items || []).toLowerCase().includes(term)
      );
    }

    if (startDate) {
      const start = new Date(startDate);
      quotes = quotes.filter(q => new Date(q.createdAt || "") >= start);
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      quotes = quotes.filter(q => new Date(q.createdAt || "") <= end);
    }

    return quotes.sort((a, b) => 
      new Date(b.createdAt || "").getTime() - new Date(a.createdAt || "").getTime()
    );
  }, [allQuotes, selectedPartyName, searchTerm, startDate, endDate]);

  const partyStats = useMemo(() => {
    const stats: Record<string, { name: string; company: string; quoteCount: number; totalValue: number }> = {};
    
    allQuotes.forEach(quote => {
      const partyName = quote.partyName || "Unknown";
      if (!stats[partyName]) {
        stats[partyName] = {
          name: partyName,
          company: quote.customerCompany || "",
          quoteCount: 0,
          totalValue: 0
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
  }, [allQuotes]);

  const itemStats = useMemo(() => {
    const stats: Record<string, { boxName: string; ply: string; count: number; avgPrice: number; totalQty: number }> = {};
    
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
              totalQty: 0
            };
          }
          stats[key].count++;
          const costPerBox = item.negotiatedPrice || item.totalCostPerBox || 0;
          stats[key].avgPrice = ((stats[key].avgPrice * (stats[key].count - 1)) + parseFloat(costPerBox)) / stats[key].count;
          stats[key].totalQty += (item.quantity || 0);
        });
      }
    });
    
    return Object.values(stats).sort((a, b) => b.count - a.count);
  }, [allQuotes]);

  const dateStats = useMemo(() => {
    const stats: Record<string, { date: string; quoteCount: number; totalValue: number; itemCount: number }> = {};
    
    filteredQuotes.forEach(quote => {
      const date = quote.createdAt ? new Date(quote.createdAt).toLocaleDateString() : 'Unknown';
      if (!stats[date]) {
        stats[date] = { date, quoteCount: 0, totalValue: 0, itemCount: 0 };
      }
      stats[date].quoteCount++;
      const items = quote.items as any[];
      if (items && Array.isArray(items)) {
        stats[date].itemCount += items.length;
        items.forEach(item => {
          const costPerBox = item.negotiatedPrice || item.totalCostPerBox || 0;
          stats[date].totalValue += parseFloat(costPerBox) * (item.quantity || 1);
        });
      }
    });
    
    return Object.values(stats).sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [filteredQuotes]);

  const costBreakdownData = useMemo(() => {
    let totalPaperCost = 0;
    let totalPrintingCost = 0;
    let totalLaminationCost = 0;
    let totalDieCost = 0;
    let totalPunchingCost = 0;
    let totalVarnishCost = 0;
    let totalMfgCost = 0;
    let grandTotal = 0;
    
    filteredQuotes.forEach(quote => {
      const items = quote.items as any[];
      if (items && Array.isArray(items)) {
        items.forEach(item => {
          const qty = item.quantity || 1;
          totalPaperCost += parseFloat(item.paperCost || 0) * qty;
          totalPrintingCost += parseFloat(item.printingCost || 0) * qty;
          totalLaminationCost += parseFloat(item.laminationCost || 0) * qty;
          totalDieCost += parseFloat(item.dieCost || 0) * qty;
          totalPunchingCost += parseFloat(item.punchingCost || 0) * qty;
          totalVarnishCost += parseFloat(item.varnishCost || 0) * qty;
          totalMfgCost += parseFloat(item.totalMfgCost || 0) * qty;
          const costPerBox = item.negotiatedPrice || item.totalCostPerBox || 0;
          grandTotal += parseFloat(costPerBox) * qty;
        });
      }
    });
    
    return [
      { category: 'Paper Cost', value: totalPaperCost, percentage: grandTotal > 0 ? (totalPaperCost / grandTotal * 100) : 0 },
      { category: 'Printing Cost', value: totalPrintingCost, percentage: grandTotal > 0 ? (totalPrintingCost / grandTotal * 100) : 0 },
      { category: 'Lamination Cost', value: totalLaminationCost, percentage: grandTotal > 0 ? (totalLaminationCost / grandTotal * 100) : 0 },
      { category: 'Die Cost', value: totalDieCost, percentage: grandTotal > 0 ? (totalDieCost / grandTotal * 100) : 0 },
      { category: 'Punching Cost', value: totalPunchingCost, percentage: grandTotal > 0 ? (totalPunchingCost / grandTotal * 100) : 0 },
      { category: 'Varnish Cost', value: totalVarnishCost, percentage: grandTotal > 0 ? (totalVarnishCost / grandTotal * 100) : 0 },
      { category: 'Other Mfg Cost', value: totalMfgCost - (totalPrintingCost + totalLaminationCost + totalDieCost + totalPunchingCost + totalVarnishCost), percentage: 0 },
    ].filter(item => item.value > 0);
  }, [filteredQuotes]);

  const paperConsumptionData = useMemo(() => {
    const stats: Record<string, { bf: string; gsm: string; shade: string; totalKg: number; totalValue: number }> = {};
    
    filteredQuotes.forEach(quote => {
      const items = quote.items as any[];
      if (items && Array.isArray(items)) {
        items.forEach(item => {
          if (item.layers && Array.isArray(item.layers)) {
            item.layers.forEach((layer: any) => {
              const key = `${layer.bf || 'Unknown'}-${layer.gsm || 'Unknown'}-${layer.shade || 'Unknown'}`;
              if (!stats[key]) {
                stats[key] = {
                  bf: layer.bf || 'Unknown',
                  gsm: layer.gsm || 'Unknown',
                  shade: layer.shade || 'Unknown',
                  totalKg: 0,
                  totalValue: 0
                };
              }
              const layerWeight = parseFloat(layer.layerWeight || 0);
              const qty = item.quantity || 1;
              stats[key].totalKg += (layerWeight * qty) / 1000;
              const rate = parseFloat(layer.rate || 0);
              stats[key].totalValue += (layerWeight * rate * qty) / 1000;
            });
          }
        });
      }
    });
    
    return Object.values(stats).sort((a, b) => b.totalKg - a.totalKg);
  }, [filteredQuotes]);

  const gstData = useMemo(() => {
    let totalSubtotal = 0;
    let totalGst = 0;
    
    filteredQuotes.forEach(quote => {
      const items = quote.items as any[];
      if (items && Array.isArray(items)) {
        items.forEach(item => {
          const qty = item.quantity || 1;
          const costPerBox = item.negotiatedPrice || item.totalCostPerBox || 0;
          const subtotal = parseFloat(costPerBox) * qty;
          totalSubtotal += subtotal;
        });
      }
    });
    
    totalGst = totalSubtotal * 0.18;
    
    return {
      subtotal: totalSubtotal,
      gst: totalGst,
      total: totalSubtotal + totalGst
    };
  }, [filteredQuotes]);

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

  // Party Price Audit: filter for selected party with additional filters
  const auditPartyProfile = useMemo(() => {
    return partyProfiles.find(p => p.personName === auditPartyName);
  }, [partyProfiles, auditPartyName]);

  const auditQuotesData = useMemo(() => {
    if (!auditPartyName) return [];
    
    let quotes = allQuotes.filter(q => q.partyName === auditPartyName);
    
    // Apply date range filter
    if (auditStartDate) {
      const start = new Date(auditStartDate);
      quotes = quotes.filter(q => new Date(q.createdAt || "") >= start);
    }
    if (auditEndDate) {
      const end = new Date(auditEndDate);
      end.setHours(23, 59, 59, 999);
      quotes = quotes.filter(q => new Date(q.createdAt || "") <= end);
    }
    
    // Process quotes and apply item-level filters
    // Keep track of original indices for bulk negotiation
    return quotes.map(quote => {
      const allItems = (quote.items || []) as any[];
      
      // Add originalIndex to each item before filtering
      let items = allItems.map((item, idx) => ({ ...item, originalIndex: idx }));
      
      // Apply box name filter
      if (auditBoxNameFilter) {
        const term = auditBoxNameFilter.toLowerCase();
        items = items.filter(item => 
          (item.boxName || '').toLowerCase().includes(term)
        );
      }
      
      // Apply box description filter
      if (auditBoxDescFilter) {
        const term = auditBoxDescFilter.toLowerCase();
        items = items.filter(item => 
          (item.boxDescription || '').toLowerCase().includes(term)
        );
      }
      
      // Apply box size filter (L×W×H)
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

  // Helper to format paper specification as GSM/BF gist
  const formatPaperSpec = (item: any): string => {
    const layers = item.layerSpecs || item.layers || [];
    if (!layers.length) return '-';
    return layers.map((layer: any) => `${layer.gsm || '-'}/${layer.bf || '-'}`).join(' + ');
  };

  // Check if any negotiated inputs are filled
  const hasNegotiatedInputs = useMemo(() => {
    return Object.values(negotiatedInputs).some(v => v && v.trim() !== '');
  }, [negotiatedInputs]);

  // Save negotiated prices mutation
  const saveNegotiatedMutation = useMutation({
    mutationFn: async (data: { quoteId: string; itemIndex: number; negotiatedPrice: number }[]) => {
      // Group by quote
      const byQuote: Record<string, { itemIndex: number; negotiatedPrice: number }[]> = {};
      data.forEach(d => {
        if (!byQuote[d.quoteId]) byQuote[d.quoteId] = [];
        byQuote[d.quoteId].push({ itemIndex: d.itemIndex, negotiatedPrice: d.negotiatedPrice });
      });
      
      // Create new version for each affected quote
      const promises = Object.entries(byQuote).map(async ([quoteId, items]) => {
        return apiRequest('POST', `/api/quotes/${quoteId}/bulk-negotiate`, { negotiations: items });
      });
      
      return Promise.all(promises);
    },
    onSuccess: () => {
      setNegotiatedInputs({});
      queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
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
        // Key format: quoteId_originalIndex
        const parts = key.split('_');
        const quoteId = parts.slice(0, -1).join('_'); // Handle quoteIds that might contain underscores
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

  // Export to PDF (uses print dialog)
  const handleExportPDF = () => {
    handlePrint();
  };

  // Export Party Audit to Excel
  const exportPartyAuditToExcel = () => {
    if (!auditPartyName) return;
    
    const exportData: any[] = [];
    const partyGst = auditPartyProfile?.gstNo || '-';
    
    auditQuotesData.forEach(quote => {
      quote.filteredItems.forEach((item: any, idx: number) => {
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
    
    switch (activeTab) {
      case "quote-register":
        filteredQuotes.forEach(quote => {
          const items = quote.items as any[];
          const totalValue = items?.reduce((sum, item) => {
            const costPerBox = item.negotiatedPrice || item.totalCostPerBox || 0;
            return sum + (parseFloat(costPerBox) * (item.quantity || 1));
          }, 0) || 0;
          
          exportData.push({
            "Quote No": quote.quoteNo || "-",
            "Date": quote.createdAt ? new Date(quote.createdAt).toLocaleDateString() : "",
            "Party Name": quote.partyName,
            "Company": quote.customerCompany,
            "Items": items?.length || 0,
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
        
      case "date-sales":
        dateStats.forEach(stat => {
          exportData.push({
            "Date": stat.date,
            "Quote Count": stat.quoteCount,
            "Item Count": stat.itemCount,
            "Total Value": stat.totalValue.toFixed(2)
          });
        });
        filename = `date_wise_sales_${new Date().toISOString().split('T')[0]}`;
        break;
        
      case "cost-breakdown":
        costBreakdownData.forEach(item => {
          exportData.push({
            "Category": item.category,
            "Value": item.value.toFixed(2),
            "Percentage": item.percentage.toFixed(1) + "%"
          });
        });
        filename = `cost_breakdown_${new Date().toISOString().split('T')[0]}`;
        break;
        
      case "paper-consumption":
        paperConsumptionData.forEach(item => {
          exportData.push({
            "BF": item.bf,
            "GSM": item.gsm,
            "Shade": item.shade,
            "Total KG": item.totalKg.toFixed(2),
            "Total Value": item.totalValue.toFixed(2)
          });
        });
        filename = `paper_consumption_${new Date().toISOString().split('T')[0]}`;
        break;
        
      case "gst-tax":
        exportData.push({
          "Description": "Subtotal",
          "Amount": gstData.subtotal.toFixed(2)
        });
        exportData.push({
          "Description": "GST (18%)",
          "Amount": gstData.gst.toFixed(2)
        });
        exportData.push({
          "Description": "Total with GST",
          "Amount": gstData.total.toFixed(2)
        });
        filename = `gst_tax_report_${new Date().toISOString().split('T')[0]}`;
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
    setSelectedPartyName("");
    setSearchTerm("");
    setStartDate("");
    setEndDate("");
  };

  if (isLoadingParties || isLoadingQuotes) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const reportTabs = [
    { id: "quote-register", label: "Quote Register", icon: FileText },
    { id: "party-summary", label: "Party Summary", icon: Users },
    { id: "item-price", label: "Item Prices", icon: Package },
    { id: "date-sales", label: "Date-wise Sales", icon: TrendingUp },
    { id: "cost-breakdown", label: "Cost Breakdown", icon: Calculator },
    { id: "paper-consumption", label: "Paper Usage", icon: FileSpreadsheet },
    { id: "gst-tax", label: "GST & Tax", icon: Receipt },
    { id: "party-audit", label: "Party Audit", icon: ClipboardList },
    { id: "saved-reports", label: "Saved Reports", icon: Bookmark },
  ];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="text-reports-title">Reports</h1>
            <p className="text-sm text-muted-foreground">Comprehensive business analytics and reporting</p>
          </div>
          <Button 
            onClick={exportCurrentReport}
            disabled={filteredQuotes.length === 0 && activeTab !== "saved-reports"}
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
                <Select value={selectedPartyName} onValueChange={setSelectedPartyName}>
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
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
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
                <Input 
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  data-testid="input-start-date"
                />
                <Input 
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
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
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-5 lg:grid-cols-9 gap-1 h-auto p-1 mb-4">
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

              <TabsContent value="quote-register" className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Quote Register</CardTitle>
                    <CardDescription>
                      Complete list of all quotes ({filteredQuotes.length} records)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Quote No</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Party</TableHead>
                            <TableHead>Company</TableHead>
                            <TableHead className="text-center">Items</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Value</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredQuotes.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
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
                                <TableRow key={quote.id} data-testid={`quote-row-${quote.id}`}>
                                  <TableCell className="font-mono text-sm">{quote.quoteNo || "-"}</TableCell>
                                  <TableCell className="text-sm">
                                    {quote.createdAt ? new Date(quote.createdAt).toLocaleDateString() : "-"}
                                  </TableCell>
                                  <TableCell className="font-medium">{quote.partyName}</TableCell>
                                  <TableCell className="text-muted-foreground">{quote.customerCompany}</TableCell>
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

              <TabsContent value="party-summary" className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Party-wise Summary</CardTitle>
                    <CardDescription>
                      Business volume by customer ({partyStats.length} parties)
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
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {partyStats.map((stat, idx) => (
                            <TableRow key={stat.id} data-testid={`party-row-${idx}`}>
                              <TableCell className="font-medium">{stat.name}</TableCell>
                              <TableCell className="text-muted-foreground">{stat.company}</TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline">{stat.quoteCount}</Badge>
                              </TableCell>
                              <TableCell className="text-right font-mono font-medium">
                                ₹{stat.totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

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
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {itemStats.map((stat, idx) => (
                            <TableRow key={idx} data-testid={`item-row-${idx}`}>
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
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="date-sales" className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Date-wise Sales Report</CardTitle>
                    <CardDescription>
                      Daily business volume ({dateStats.length} days with activity)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead className="text-center">Quotes</TableHead>
                            <TableHead className="text-center">Items</TableHead>
                            <TableHead className="text-right">Total Value</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dateStats.map((stat, idx) => (
                            <TableRow key={idx} data-testid={`date-row-${idx}`}>
                              <TableCell className="font-medium">{stat.date}</TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline">{stat.quoteCount}</Badge>
                              </TableCell>
                              <TableCell className="text-center">{stat.itemCount}</TableCell>
                              <TableCell className="text-right font-mono font-medium">
                                ₹{stat.totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="cost-breakdown" className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Cost Breakdown Analysis</CardTitle>
                    <CardDescription>
                      Cost distribution across categories
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      {costBreakdownData.slice(0, 4).map((item, idx) => (
                        <div key={idx} className="p-4 rounded-lg border bg-muted/50">
                          <div className="text-sm text-muted-foreground">{item.category}</div>
                          <div className="text-lg font-bold font-mono">
                            ₹{item.value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {item.percentage.toFixed(1)}%
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Category</TableHead>
                            <TableHead className="text-right">Value</TableHead>
                            <TableHead className="text-right">Percentage</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {costBreakdownData.map((item, idx) => (
                            <TableRow key={idx} data-testid={`cost-row-${idx}`}>
                              <TableCell className="font-medium">{item.category}</TableCell>
                              <TableCell className="text-right font-mono">
                                ₹{item.value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge variant="outline">{item.percentage.toFixed(1)}%</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="paper-consumption" className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Paper Consumption Report</CardTitle>
                    <CardDescription>
                      Material usage by paper type ({paperConsumptionData.length} varieties)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>BF</TableHead>
                            <TableHead>GSM</TableHead>
                            <TableHead>Shade</TableHead>
                            <TableHead className="text-right">Total KG</TableHead>
                            <TableHead className="text-right">Total Value</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paperConsumptionData.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                No paper consumption data available
                              </TableCell>
                            </TableRow>
                          ) : (
                            paperConsumptionData.map((item, idx) => (
                              <TableRow key={idx} data-testid={`paper-row-${idx}`}>
                                <TableCell className="font-medium">{item.bf}</TableCell>
                                <TableCell>{item.gsm}</TableCell>
                                <TableCell>{item.shade}</TableCell>
                                <TableCell className="text-right font-mono">
                                  {item.totalKg.toFixed(2)} kg
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  ₹{item.totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
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

              <TabsContent value="gst-tax" className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">GST & Tax Summary</CardTitle>
                    <CardDescription>
                      Tax calculations for filtered quotes
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      <div className="p-4 rounded-lg border bg-muted/50">
                        <div className="text-sm text-muted-foreground">Subtotal</div>
                        <div className="text-2xl font-bold font-mono">
                          ₹{gstData.subtotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </div>
                      </div>
                      <div className="p-4 rounded-lg border bg-muted/50">
                        <div className="text-sm text-muted-foreground">GST (18%)</div>
                        <div className="text-2xl font-bold font-mono text-amber-600">
                          ₹{gstData.gst.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </div>
                      </div>
                      <div className="p-4 rounded-lg border bg-primary/10">
                        <div className="text-sm text-muted-foreground">Total with GST</div>
                        <div className="text-2xl font-bold font-mono text-primary">
                          ₹{gstData.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </div>
                      </div>
                    </div>
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell className="font-medium">Subtotal (Before Tax)</TableCell>
                            <TableCell className="text-right font-mono">
                              ₹{gstData.subtotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">CGST (9%)</TableCell>
                            <TableCell className="text-right font-mono">
                              ₹{(gstData.gst / 2).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">SGST (9%)</TableCell>
                            <TableCell className="text-right font-mono">
                              ₹{(gstData.gst / 2).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </TableCell>
                          </TableRow>
                          <TableRow className="bg-muted/50">
                            <TableCell className="font-bold">Grand Total</TableCell>
                            <TableCell className="text-right font-mono font-bold text-primary">
                              ₹{gstData.total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

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
                    {/* Party Selection - Always visible */}
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
                    
                    {/* Filters - Only visible after party selected */}
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

                    {/* Report Content */}
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
                        {/* Print Header */}
                        <div className="header mb-6 p-4 border rounded-lg bg-muted/30">
                          <h1 className="text-xl font-bold">Party Price Audit Report</h1>
                          <p className="text-sm mt-1"><strong>Party:</strong> {auditPartyName}</p>
                          <p className="text-sm"><strong>GST No:</strong> {auditPartyProfile?.gstNo || 'N/A'}</p>
                          <p className="text-sm"><strong>Generated:</strong> {new Date().toLocaleDateString()}</p>
                        </div>
                        
                        {/* Grouped Data: Quote → Items */}
                        {auditQuotesData.map((quote, qIdx) => (
                          <div key={quote.id} className="quote-group mb-6">
                            <div className="quote-header bg-muted px-4 py-2 rounded-t-lg border border-b-0">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div>
                                  <span className="font-semibold">Quote: {quote.quoteNo || '-'}</span>
                                  <span className="text-muted-foreground ml-4">
                                    {quote.createdAt ? new Date(quote.createdAt).toLocaleDateString() : ''}
                                  </span>
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
                                    // Use originalIndex for proper item identification in bulk negotiate
                                    const inputKey = `${quote.id}_${item.originalIndex}`;
                                    
                                    return (
                                      <TableRow key={iIdx} data-testid={`audit-item-${qIdx}-${iIdx}`}>
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
                                        <TableCell className="no-print">
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
                        Save Current Report Configuration
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
