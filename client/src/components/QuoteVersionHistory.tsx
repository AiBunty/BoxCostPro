import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { History, Eye, TrendingUp, TrendingDown, ArrowRight, Tag, Clock } from "lucide-react";
import type { QuoteVersion, QuoteItem } from "@shared/schema";

interface QuoteVersionHistoryProps {
  quoteId: string;
  currentVersionId?: string;
  onVersionSelect?: (version: QuoteVersion) => void;
}

export function QuoteVersionHistory({ quoteId, currentVersionId, onVersionSelect }: QuoteVersionHistoryProps) {
  const [selectedVersion, setSelectedVersion] = useState<QuoteVersion | null>(null);
  const [compareVersions, setCompareVersions] = useState<{ left: QuoteVersion | null; right: QuoteVersion | null }>({ left: null, right: null });
  const [showCompare, setShowCompare] = useState(false);

  const { data: versions, isLoading } = useQuery<QuoteVersion[]>({
    queryKey: ["/api/quotes", quoteId, "versions"],
    enabled: !!quoteId,
  });

  const { data: selectedItems } = useQuery<{ items: QuoteItem[] }>({
    queryKey: ["/api/quote-versions", selectedVersion?.id, "items"],
    enabled: !!selectedVersion?.id,
  });

  const formatDate = (dateStr: Date | string | null) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return "₹0.00";
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const getPriceChange = (currentIdx: number) => {
    if (!versions || currentIdx >= versions.length - 1) return null;
    const current = versions[currentIdx];
    const previous = versions[currentIdx + 1];
    if (!current.finalTotal || !previous.finalTotal) return null;
    return current.finalTotal - previous.finalTotal;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Version History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!versions || versions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Version History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No versions found for this quote.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Version History
          </CardTitle>
          <CardDescription>
            {versions.length} version{versions.length > 1 ? "s" : ""} of this quote
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64">
            <div className="space-y-2">
              {versions.map((version, idx) => {
                const isActive = version.id === currentVersionId;
                const priceChange = getPriceChange(idx);
                
                return (
                  <div
                    key={version.id}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                      isActive ? "bg-primary/10 border-primary" : "bg-muted/50 hover-elevate"
                    }`}
                    data-testid={`version-item-${version.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-medium" data-testid={`text-version-number-${version.id}`}>
                            v{version.versionNo}
                          </span>
                          {isActive && (
                            <Badge variant="default" className="text-xs" data-testid="badge-active-version">
                              Active
                            </Badge>
                          )}
                          {version.isNegotiated && (
                            <Badge variant="secondary" className="text-xs" data-testid="badge-negotiated">
                              <Tag className="h-3 w-3 mr-1" />
                              Negotiated
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span data-testid={`text-version-date-${version.id}`}>
                            {formatDate(version.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="font-medium" data-testid={`text-version-total-${version.id}`}>
                          {formatCurrency(version.finalTotal)}
                        </div>
                        {priceChange !== null && priceChange !== 0 && (
                          <div className={`flex items-center justify-end text-xs ${priceChange > 0 ? "text-green-600" : "text-red-600"}`}>
                            {priceChange > 0 ? (
                              <TrendingUp className="h-3 w-3 mr-1" />
                            ) : (
                              <TrendingDown className="h-3 w-3 mr-1" />
                            )}
                            {priceChange > 0 ? "+" : ""}{formatCurrency(priceChange)}
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedVersion(version)}
                        data-testid={`button-view-version-${version.id}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {versions.length >= 2 && (
            <div className="mt-4 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  setCompareVersions({ left: versions[1], right: versions[0] });
                  setShowCompare(true);
                }}
                data-testid="button-compare-versions"
              >
                <ArrowRight className="h-4 w-4 mr-2" />
                Compare Latest Versions
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedVersion} onOpenChange={(open) => !open && setSelectedVersion(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Version {selectedVersion?.versionNo} Details
              {selectedVersion?.isNegotiated && (
                <Badge variant="secondary">Negotiated</Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              Created on {formatDate(selectedVersion?.createdAt || null)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">Subtotal</p>
                <p className="font-medium" data-testid="text-snapshot-subtotal">
                  {formatCurrency(selectedVersion?.subtotal || 0)}
                </p>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">GST ({selectedVersion?.gstPercent || 5}%)</p>
                <p className="font-medium" data-testid="text-snapshot-gst">
                  {formatCurrency(selectedVersion?.gstAmount || 0)}
                </p>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">Transport</p>
                <p className="font-medium" data-testid="text-snapshot-transport">
                  {formatCurrency(selectedVersion?.transportCharge || 0)}
                </p>
              </div>
              {selectedVersion?.roundOffEnabled && selectedVersion?.roundOffValue !== null && selectedVersion?.roundOffValue !== undefined && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground">Round Off</p>
                  <p className="font-medium" data-testid="text-snapshot-roundoff">
                    {(selectedVersion.roundOffValue >= 0 ? '+' : '') + formatCurrency(selectedVersion.roundOffValue)}
                  </p>
                </div>
              )}
              <div className="p-3 bg-primary/10 rounded-lg border border-primary">
                <p className="text-xs text-primary">Final Total</p>
                <p className="font-bold text-primary" data-testid="text-snapshot-final">
                  {formatCurrency(selectedVersion?.finalTotal || 0)}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Terms</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Payment: </span>
                  <span>{selectedVersion?.paymentTerms || "N/A"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Delivery: </span>
                  <span>{selectedVersion?.deliveryDays ? `${selectedVersion.deliveryDays} days` : "N/A"}</span>
                </div>
              </div>
            </div>

            {(selectedVersion?.fluteFactorA || selectedVersion?.fluteFactorB || selectedVersion?.fluteFactorC || selectedVersion?.fluteFactorE) && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Flute Factors Snapshot</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedVersion?.fluteFactorA && (
                    <Badge variant="outline" className="text-xs">A: {selectedVersion.fluteFactorA}</Badge>
                  )}
                  {selectedVersion?.fluteFactorB && (
                    <Badge variant="outline" className="text-xs">B: {selectedVersion.fluteFactorB}</Badge>
                  )}
                  {selectedVersion?.fluteFactorC && (
                    <Badge variant="outline" className="text-xs">C: {selectedVersion.fluteFactorC}</Badge>
                  )}
                  {selectedVersion?.fluteFactorE && (
                    <Badge variant="outline" className="text-xs">E: {selectedVersion.fluteFactorE}</Badge>
                  )}
                </div>
              </div>
            )}

            {onVersionSelect && (
              <div className="pt-4 border-t">
                <Button
                  onClick={() => {
                    onVersionSelect(selectedVersion!);
                    setSelectedVersion(null);
                  }}
                  data-testid="button-load-version"
                >
                  Load This Version
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCompare} onOpenChange={setShowCompare}>
        <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Version Comparison</DialogTitle>
            <DialogDescription>
              Comparing v{compareVersions.left?.versionNo} with v{compareVersions.right?.versionNo}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">
                  Version {compareVersions.left?.versionNo}
                  {compareVersions.left?.isNegotiated && (
                    <Badge className="ml-2" variant="secondary">Negotiated</Badge>
                  )}
                </CardTitle>
                <CardDescription>{formatDate(compareVersions.left?.createdAt || null)}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span>{formatCurrency(compareVersions.left?.subtotal || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">GST:</span>
                    <span>{formatCurrency(compareVersions.left?.gstAmount || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Transport:</span>
                    <span>{formatCurrency(compareVersions.left?.transportCharge || 0)}</span>
                  </div>
                  {compareVersions.left?.roundOffEnabled && compareVersions.left?.roundOffValue != null && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Round Off:</span>
                      <span>{(compareVersions.left.roundOffValue >= 0 ? '+' : '') + formatCurrency(compareVersions.left.roundOffValue)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold pt-2 border-t">
                    <span>Total:</span>
                    <span>{formatCurrency(compareVersions.left?.finalTotal || 0)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">
                  Version {compareVersions.right?.versionNo}
                  {compareVersions.right?.isNegotiated && (
                    <Badge className="ml-2" variant="secondary">Negotiated</Badge>
                  )}
                </CardTitle>
                <CardDescription>{formatDate(compareVersions.right?.createdAt || null)}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span>{formatCurrency(compareVersions.right?.subtotal || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">GST:</span>
                    <span>{formatCurrency(compareVersions.right?.gstAmount || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Transport:</span>
                    <span>{formatCurrency(compareVersions.right?.transportCharge || 0)}</span>
                  </div>
                  {compareVersions.right?.roundOffEnabled && compareVersions.right?.roundOffValue != null && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Round Off:</span>
                      <span>{(compareVersions.right.roundOffValue >= 0 ? '+' : '') + formatCurrency(compareVersions.right.roundOffValue)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold pt-2 border-t">
                    <span>Total:</span>
                    <span>{formatCurrency(compareVersions.right?.finalTotal || 0)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {compareVersions.left && compareVersions.right && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Price Difference</h4>
              <div className="flex items-center gap-2">
                {(() => {
                  const diff = (compareVersions.right?.finalTotal || 0) - (compareVersions.left?.finalTotal || 0);
                  const isIncrease = diff > 0;
                  return (
                    <>
                      {isIncrease ? (
                        <TrendingUp className="h-5 w-5 text-green-600" />
                      ) : diff < 0 ? (
                        <TrendingDown className="h-5 w-5 text-red-600" />
                      ) : null}
                      <span className={`text-lg font-bold ${isIncrease ? "text-green-600" : diff < 0 ? "text-red-600" : ""}`}>
                        {isIncrease ? "+" : ""}{formatCurrency(diff)}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        ({diff !== 0 ? ((diff / (compareVersions.left?.finalTotal || 1)) * 100).toFixed(1) : 0}%)
                      </span>
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}