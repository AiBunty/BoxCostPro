import { useState } from "react";
import { useLocation } from "wouter";
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
import MasterSettings from "@/components/master-settings";

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
    id: "settings",
    label: "Email Settings",
    icon: Building2,
    description: "Email configuration and quote templates",
  },
];

export default function Masters() {
  const [location] = useLocation();
  // Read query param ?tab=flute|paper|tax|settings to choose active tab
  let defaultTab = 'paper';
  try {
    const url = new URL(location, 'http://localhost');
    const tab = url.searchParams.get('tab');
    // Redirect old 'business' tab to 'tax'
    if (tab === 'business') {
      defaultTab = 'tax';
    } else if (tab === 'flute' || tab === 'paper' || tab === 'tax' || tab === 'settings') {
      defaultTab = tab;
    }
  } catch (e) {
    // ignore parse errors and fallback to default
  }
  const [activeTab, setActiveTab] = useState(defaultTab);

  return (
    <div className="flex flex-col min-h-full">
      <div className="border-b bg-background sticky top-0 z-20">
        <div className="p-4 md:p-6 pb-0">
          <h1 className="text-2xl font-bold tracking-tight mb-1">Master Settings</h1>
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

          <TabsContent value="settings" className="m-0">
            <MasterSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
