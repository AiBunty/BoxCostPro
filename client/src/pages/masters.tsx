import { useState } from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  FileText,
  Layers,
  Settings2,
  Calculator,
  Percent,
  Receipt,
  Gauge,
  ChevronRight,
} from "lucide-react";

import PaperSetup from "@/pages/paper-setup";

interface MasterTab {
  id: string;
  label: string;
  icon: React.ElementType;
  description: string;
}

const masterTabs: MasterTab[] = [
  {
    id: "paper",
    label: "Paper Master",
    icon: FileText,
    description: "Manage BF rates, GSM rules, and shade premiums",
  },
  {
    id: "fluting",
    label: "BF & Fluting",
    icon: Layers,
    description: "Configure fluting factors and combinations",
  },
  {
    id: "ply",
    label: "Ply Presets",
    icon: Layers,
    description: "Define standard ply configurations",
  },
  {
    id: "conversion",
    label: "Conversion Costs",
    icon: Calculator,
    description: "Set manufacturing and conversion rates",
  },
  {
    id: "margin",
    label: "Margin Rules",
    icon: Percent,
    description: "Configure profit margin calculations",
  },
  {
    id: "tax",
    label: "Tax & GST",
    icon: Receipt,
    description: "Manage tax rates and GST settings",
  },
  {
    id: "machine",
    label: "Machine Settings",
    icon: Gauge,
    description: "Configure machine thresholds and limits",
  },
];

function ComingSoonPlaceholder({ tab }: { tab: MasterTab }) {
  const Icon = tab.icon;
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{tab.label}</h3>
      <p className="text-muted-foreground max-w-md">
        {tab.description}. Settings will be migrated here from the existing configuration pages.
      </p>
    </div>
  );
}

export default function Masters() {
  const [activeTab, setActiveTab] = useState("paper");

  return (
    <div className="flex flex-col min-h-full">
      <div className="border-b bg-background sticky top-0 z-20">
        <div className="p-4 md:p-6 pb-0">
          <h1 className="text-2xl font-bold tracking-tight mb-1">Masters</h1>
          <p className="text-muted-foreground text-sm mb-4">
            Configure settings that affect future quotes
          </p>
        </div>

        <ScrollArea className="w-full">
          <div className="px-4 md:px-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="h-auto p-1 bg-muted/50 inline-flex w-auto">
                {masterTabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <TabsTrigger
                      key={tab.id}
                      value={tab.id}
                      className={cn(
                        "gap-2 px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                      )}
                      data-testid={`tab-${tab.id}`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="hidden sm:inline">{tab.label}</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      <div className="flex-1 p-4 md:p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsContent value="paper" className="m-0">
            <PaperSetup />
          </TabsContent>

          <TabsContent value="fluting" className="m-0">
            <Card className="shadow-sm">
              <CardContent className="pt-6">
                <ComingSoonPlaceholder tab={masterTabs[1]} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ply" className="m-0">
            <Card className="shadow-sm">
              <CardContent className="pt-6">
                <ComingSoonPlaceholder tab={masterTabs[2]} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="conversion" className="m-0">
            <Card className="shadow-sm">
              <CardContent className="pt-6">
                <ComingSoonPlaceholder tab={masterTabs[3]} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="margin" className="m-0">
            <Card className="shadow-sm">
              <CardContent className="pt-6">
                <ComingSoonPlaceholder tab={masterTabs[4]} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tax" className="m-0">
            <Card className="shadow-sm">
              <CardContent className="pt-6">
                <ComingSoonPlaceholder tab={masterTabs[5]} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="machine" className="m-0">
            <Card className="shadow-sm">
              <CardContent className="pt-6">
                <ComingSoonPlaceholder tab={masterTabs[6]} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
