import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FilePlus,
  Search,
  MoreVertical,
  Eye,
  Pencil,
  Copy,
  Trash2,
  Share2,
  Download,
  Mail,
  FileSpreadsheet,
  FileText,
  MessageCircle,
  Package,
  Filter,
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";

interface Quote {
  id: string;
  partyName: string;
  totalAmount: number;
  createdAt: string;
  status: string;
  items?: any[];
}

function QuoteSummaryBar({ quotes }: { quotes: Quote[] }) {
  const totalQuotes = quotes.length;
  const totalValue = quotes.reduce((sum, q) => sum + (q.totalAmount || 0), 0);

  return (
    <div className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
      <div className="flex items-center justify-between p-4 gap-4">
        <div className="flex items-center gap-6">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Quotes</p>
            <p className="text-xl font-bold">{totalQuotes}</p>
          </div>
          <div className="h-8 w-px bg-border hidden sm:block" />
          <div className="hidden sm:block">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Value</p>
            <p className="text-xl font-bold">₹{totalValue.toLocaleString("en-IN")}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ShareDropdown />
          <Link href="/create-quote">
            <Button className="gap-2" data-testid="button-new-quote">
              <FilePlus className="h-4 w-4" />
              <span className="hidden sm:inline">New Quote</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function ShareDropdown() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Share2 className="h-4 w-4" />
          <span className="hidden sm:inline">Share</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem className="gap-2">
          <SiWhatsapp className="h-4 w-4 text-green-600" />
          WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2">
          <Mail className="h-4 w-4" />
          Email
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2">
          <FileText className="h-4 w-4 text-red-600" />
          Download PDF
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2">
          <FileSpreadsheet className="h-4 w-4 text-green-700" />
          Export Excel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function QuoteCard({ quote }: { quote: Quote }) {
  const itemCount = quote.items?.length || 0;

  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold truncate">{quote.partyName || "Unnamed Party"}</h3>
            <p className="text-sm text-muted-foreground">
              {new Date(quote.createdAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="gap-2">
                <Eye className="h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2">
                <Pencil className="h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2">
                <Copy className="h-4 w-4" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 text-destructive">
                <Trash2 className="h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </Badge>
          </div>
          <p className="text-lg font-bold">
            ₹{(quote.totalAmount || 0).toLocaleString("en-IN")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function QuoteTableRow({ quote }: { quote: Quote }) {
  const itemCount = quote.items?.length || 0;

  return (
    <TableRow className="hover:bg-muted/50">
      <TableCell className="font-medium">{quote.partyName || "Unnamed Party"}</TableCell>
      <TableCell>
        {new Date(quote.createdAt).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}
      </TableCell>
      <TableCell>
        <Badge variant="secondary">{itemCount} items</Badge>
      </TableCell>
      <TableCell className="text-right font-semibold">
        ₹{(quote.totalAmount || 0).toLocaleString("en-IN")}
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Eye className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Pencil className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="gap-2">
                <Copy className="h-4 w-4" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 text-destructive">
                <Trash2 className="h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function Quotes() {
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: quotes, isLoading } = useQuery<Quote[]>({
    queryKey: ["/api/quotes"],
  });

  const filteredQuotes = quotes?.filter((q) =>
    q.partyName?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="flex flex-col min-h-full">
      <QuoteSummaryBar quotes={filteredQuotes} />

      <div className="p-4 md:p-6 space-y-4 flex-1">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by party name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-quotes"
            />
          </div>
          <Button variant="outline" className="gap-2 shrink-0">
            <Filter className="h-4 w-4" />
            Filters
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : filteredQuotes.length === 0 ? (
          <div className="text-center py-16">
            <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold mb-2">No quotes found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery
                ? "Try adjusting your search"
                : "Create your first quote to get started"}
            </p>
            {!searchQuery && (
              <Link href="/create-quote">
                <Button className="gap-2">
                  <FilePlus className="h-4 w-4" />
                  Create Quote
                </Button>
              </Link>
            )}
          </div>
        ) : isMobile ? (
          <div className="grid gap-3">
            {filteredQuotes.map((quote) => (
              <QuoteCard key={quote.id} quote={quote} />
            ))}
          </div>
        ) : (
          <Card className="shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Party Name</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredQuotes.map((quote) => (
                  <QuoteTableRow key={quote.id} quote={quote} />
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      {isMobile && filteredQuotes.length > 0 && (
        <div className="sticky bottom-16 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t safe-area-inset-bottom">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-lg font-bold">
                ₹{filteredQuotes.reduce((s, q) => s + (q.totalAmount || 0), 0).toLocaleString("en-IN")}
              </p>
            </div>
            <div className="flex gap-2">
              <ShareDropdown />
              <Link href="/create-quote">
                <Button className="gap-2">
                  <FilePlus className="h-4 w-4" />
                  New
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
