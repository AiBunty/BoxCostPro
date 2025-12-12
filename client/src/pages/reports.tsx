import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, Search, FileSpreadsheet, Filter, Calendar } from "lucide-react";
import { Link } from "wouter";
import { downloadGenericExcel } from "@/lib/excelExport";
import type { Quote, PartyProfile } from "@shared/schema";

export default function Reports() {
  const [selectedPartyName, setSelectedPartyName] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data: partyProfiles = [], isLoading: isLoadingParties } = useQuery<PartyProfile[]>({
    queryKey: ['/api/party-profiles'],
  });

  const { data: allQuotes = [], isLoading: isLoadingQuotes } = useQuery<Quote[]>({
    queryKey: ['/api/quotes'],
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
        JSON.stringify(q.items).toLowerCase().includes(term)
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
          stats[partyName].totalValue += parseFloat(item.totalCostPerBox || 0) * (item.quantity || 1);
        });
      }
    });
    
    return Object.entries(stats).map(([name, data]) => ({ id: name, ...data }));
  }, [allQuotes]);

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

  const exportQuotesToExcel = () => {
    const exportData: any[] = [];
    
    filteredQuotes.forEach(quote => {
      const items = quote.items as any[];
      if (items && Array.isArray(items)) {
        items.forEach(item => {
          exportData.push({
            "Quote Date": quote.createdAt ? new Date(quote.createdAt).toLocaleDateString() : "",
            "Party Name": quote.partyName,
            "Company": quote.customerCompany,
            "Box Name": item.boxName || "",
            "Type": item.type || "RSC",
            "Ply": item.ply || "",
            "Length (mm)": item.length || 0,
            "Width (mm)": item.width || 0,
            "Height (mm)": item.height || 0,
            "Quantity": item.quantity || 0,
            "Paper Cost": parseFloat(item.paperCost || 0).toFixed(2),
            "Printing Cost": parseFloat(item.printingCost || 0).toFixed(2),
            "Lamination Cost": parseFloat(item.laminationCost || 0).toFixed(2),
            "Varnish Cost": parseFloat(item.varnishCost || 0).toFixed(2),
            "Die Cost": parseFloat(item.dieCost || 0).toFixed(2),
            "Punching Cost": parseFloat(item.punchingCost || 0).toFixed(2),
            "Total Per Box": parseFloat(item.totalCostPerBox || 0).toFixed(2),
            "Total Value": (parseFloat(item.totalCostPerBox || 0) * (item.quantity || 1)).toFixed(2),
            "Sheet Weight (g)": parseFloat(item.sheetWeight || 0).toFixed(2),
            "ECT": item.ect || "",
            "BCT": item.bct || "",
            "BS": item.bs || "",
          });
        });
      }
    });

    if (exportData.length === 0) {
      alert("No data to export");
      return;
    }

    const filename = selectedPartyName && selectedPartyName !== "all"
      ? `${selectedPartyName}_quotes_${new Date().toISOString().split('T')[0]}` 
      : `all_quotes_${new Date().toISOString().split('T')[0]}`;

    downloadGenericExcel(exportData, filename);
  };

  if (isLoadingParties || isLoadingQuotes) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" data-testid="button-back-to-calculator">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-foreground" data-testid="text-reports-title">Reports</h1>
              <p className="text-sm text-muted-foreground">View party-wise quote history and export data</p>
            </div>
          </div>
          <Button 
            onClick={exportQuotesToExcel}
            disabled={filteredQuotes.length === 0}
            data-testid="button-export-excel"
          >
            <Download className="w-4 h-4 mr-2" />
            Export to Excel
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="md:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="party-filter">Select Party</Label>
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
                    placeholder="Search quotes..."
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
                onClick={() => {
                  setSelectedPartyName("");
                  setSearchTerm("");
                  setStartDate("");
                  setEndDate("");
                }}
                data-testid="button-clear-filters"
              >
                Clear Filters
              </Button>
            </CardContent>
          </Card>

          <div className="md:col-span-3 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4" />
                  Party Summary
                </CardTitle>
                <CardDescription>
                  {partyStats.length} parties with {allQuotes.length} total quotes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {partyStats.slice(0, 8).map((stat) => (
                    <div 
                      key={stat.id} 
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedPartyName === stat.name ? 'bg-primary/10 border-primary' : 'hover:bg-muted'
                      }`}
                      onClick={() => setSelectedPartyName(stat.name === selectedPartyName ? "" : stat.name)}
                      data-testid={`party-stat-${stat.id}`}
                    >
                      <div className="font-medium text-sm truncate">{stat.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{stat.company}</div>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary" className="text-xs">
                          {stat.quoteCount} quotes
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Quote History
                  {selectedPartyName && selectedPartyName !== "all" && (
                    <span className="font-normal text-muted-foreground ml-2">
                      - {selectedPartyName}
                    </span>
                  )}
                </CardTitle>
                <CardDescription>
                  {filteredQuotes.length} quotes found
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">Date</TableHead>
                        <TableHead>Party</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead className="text-center">Items</TableHead>
                        <TableHead className="text-right">Total Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredQuotes.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            No quotes found matching your criteria
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredQuotes.map((quote) => {
                          const items = quote.items as any[] || [];
                          const totalValue = items.reduce((sum, item) => 
                            sum + (parseFloat(item.totalCostPerBox || 0) * (item.quantity || 1)), 0
                          );
                          return (
                            <TableRow key={quote.id} data-testid={`quote-row-${quote.id}`}>
                              <TableCell className="font-mono text-sm">
                                {quote.createdAt ? new Date(quote.createdAt).toLocaleDateString() : "-"}
                              </TableCell>
                              <TableCell className="font-medium">{quote.partyName}</TableCell>
                              <TableCell className="text-muted-foreground">{quote.customerCompany}</TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline">{items.length}</Badge>
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                ₹{totalValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
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

            {selectedPartyName && selectedPartyName !== "all" && filteredQuotes.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Box Details for {selectedPartyName}</CardTitle>
                  <CardDescription>
                    Detailed breakdown of all boxes ordered
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Box Name</TableHead>
                          <TableHead>Type/Ply</TableHead>
                          <TableHead>Dimensions</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Unit Cost</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredQuotes.flatMap((quote) => {
                          const items = quote.items as any[] || [];
                          return items.map((item, idx) => (
                            <TableRow key={`${quote.id}-${idx}`} data-testid={`box-row-${quote.id}-${idx}`}>
                              <TableCell className="font-medium">{item.boxName || `Box ${idx + 1}`}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="mr-1">{item.type?.toUpperCase() || "RSC"}</Badge>
                                <Badge variant="secondary">{item.ply}-Ply</Badge>
                              </TableCell>
                              <TableCell className="font-mono text-sm">
                                {item.length} x {item.width} {item.type !== 'sheet' && `x ${item.height}`} mm
                              </TableCell>
                              <TableCell className="text-right">{item.quantity || 0}</TableCell>
                              <TableCell className="text-right font-mono">
                                ₹{parseFloat(item.totalCostPerBox || 0).toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right font-mono font-medium">
                                ₹{(parseFloat(item.totalCostPerBox || 0) * (item.quantity || 1)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                              </TableCell>
                            </TableRow>
                          ));
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
