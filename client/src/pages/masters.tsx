import { useState } from "react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  FileText,
  Layers,
  Receipt,
  Building2,
} from "lucide-react";

import PaperSetup from "@/pages/paper-setup";
import FluteSettings from "@/components/flute-settings";
import BusinessDefaultsSettings from "@/components/business-defaults";

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
    id: "flute",
    label: "Flute Settings",
    icon: Layers,
    description: "Configure fluting factors and flute heights",
  },
  {
    id: "tax",
    label: "Tax & GST",
    icon: Receipt,
    description: "Manage tax rates and GST settings",
  },
  {
    id: "business",
    label: "Business Defaults",
    icon: Building2,
    description: "Default GST percentage and tax settings",
  },
];

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

          <TabsContent value="flute" className="m-0">
            <FluteSettings />
          </TabsContent>

          <TabsContent value="tax" className="m-0">
            <BusinessDefaultsSettings />
          </TabsContent>

          <TabsContent value="business" className="m-0">
            <BusinessDefaultsSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
