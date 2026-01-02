import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FilePlus,
  FileText,
  BarChart3,
  Settings2,
  User,
  HelpCircle,
  LogOut,
  Package,
  Building2,
  ChevronDown,
  ChevronRight,
  Headphones,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";

interface SubNavItem {
  label: string;
  path: string;
}

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  subItems?: SubNavItem[];
}

const getNavItems = (userRole: string | null | undefined): NavItem[] => {
  const baseItems: NavItem[] = [
    { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { label: "Create Quote", path: "/create-quote", icon: FilePlus },
    { 
      label: "Quotes", 
      path: "/quotes", 
      icon: FileText,
      subItems: [
        { label: "All Quotes", path: "/quotes" },
        { label: "Bulk Upload", path: "/bulk-upload" },
      ]
    },
    { label: "Reports", path: "/reports", icon: BarChart3 },
    { label: "Master Settings", path: "/masters", icon: Settings2 },
    { label: "Support", path: "/support", icon: Headphones },
    { label: "Account", path: "/account", icon: User },
  ];
  
  return baseItems;
};

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [location] = useLocation();
  const { user, signOut } = useAuth();
  const isMobile = useIsMobile();
  const navItems = getNavItems(user?.role);
  const [quotesOpen, setQuotesOpen] = useState(() => {
    // Open the Quotes section by default if we're on a quotes-related page
    return location.startsWith("/quotes") || location.startsWith("/bulk-upload");
  });

  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user?.firstName) {
      return user.firstName[0].toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return "U";
  };

  const isActive = (path: string) => {
    if (path === "/dashboard" && location === "/") return true;
    if (path === "/masters") return location.startsWith("/masters");
    return location === path || location.startsWith(path + "/");
  };

  const { data: onboardingStatus } = useQuery<any>({ queryKey: ["/api/onboarding/status"] });
  const isPaidActive = !!onboardingStatus?.paidActive;

  if (isMobile) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="flex items-center justify-between px-4 h-14">
            <div className="flex items-center gap-2 min-w-0">
              <img src="/logo.png" alt="Logo" className="h-8 w-8 shrink-0 object-contain" />
              <div className="min-w-0">
                <span className="font-semibold text-sm block truncate">
                  {user?.companyName || "PaperBox ERP"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-help">
                    <HelpCircle className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Help</TooltipContent>
              </Tooltip>

              {/* Theme toggle for mobile */}
              <ThemeToggle />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={user?.profileImageUrl || undefined} />
                      <AvatarFallback className="text-xs">{getInitials()}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{user?.firstName || "User"}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main className="flex-1 pb-24 overflow-auto">
          {children}
        </main>

        <div className="fixed bottom-16 left-0 right-0 z-40 bg-background/95 backdrop-blur border-t">
          <div className="px-4 py-2 text-xs text-muted-foreground">
            <div className="flex gap-3 justify-center">
              <a href="/privacy-policy" target="_blank" className="hover:text-foreground transition-colors">
                Privacy Policy
              </a>
              <span>•</span>
              <a href="/terms" target="_blank" className="hover:text-foreground transition-colors">
                Terms
              </a>
            </div>
          </div>
        </div>

        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t safe-area-inset-bottom">
          <div className="flex items-center justify-around h-16 px-2">
            {[
              { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
              { label: "Quotes", path: "/quotes", icon: FileText },
              { label: "Reports", path: "/reports", icon: BarChart3 },
              { label: "Support", path: "/support", icon: Headphones },
              { label: "Account", path: "/account", icon: User },
            ].map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link key={item.path} href={item.path === "/dashboard" ? "/" : item.path}>
                  <button
                    className={cn(
                      "flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-lg transition-colors min-w-[60px]",
                      active
                        ? "text-primary bg-primary/10"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    data-testid={`nav-${item.label.toLowerCase().replace(" ", "-")}`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-[10px] font-medium flex items-center gap-1">
                      {item.label}
                    </span>
                  </button>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="sticky top-0 h-screen w-60 border-r bg-card/50 flex flex-col">
        <div className="flex items-center gap-2 h-14 px-4 border-b">
          <img src="/logo.png" alt="Logo" className="h-8 w-8 shrink-0 object-contain" />
          <span className="font-semibold truncate">PaperBox ERP</span>
        </div>

        <nav className="flex-1 py-4 px-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            const href = item.path === "/dashboard" ? "/" : item.path;

            // Handle items with sub-items (collapsible)
            if (item.subItems && item.subItems.length > 0) {
              const hasActiveSubItem = item.subItems.some(sub => isActive(sub.path));
              const isQuotesSection = item.label === "Quotes";
              const isOpen = isQuotesSection ? quotesOpen : false;
              const setIsOpen = isQuotesSection ? setQuotesOpen : () => {};
              
              return (
                <Collapsible 
                  key={item.path} 
                  open={isOpen} 
                  onOpenChange={setIsOpen}
                >
                  <CollapsibleTrigger asChild>
                    <button
                      className={cn(
                        "flex items-center justify-between w-full h-10 px-3 rounded-lg transition-colors text-sm font-medium",
                        hasActiveSubItem
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      )}
                      data-testid={`nav-${item.label.toLowerCase().replace(" ", "-")}`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5 shrink-0" />
                        <span className="truncate flex items-center gap-2">
                          {item.label}
                        </span>
                      </div>
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="ml-8 mt-1 space-y-1">
                    {item.subItems.map((subItem) => {
                      const subActive = location === subItem.path;
                      return (
                        <Link key={subItem.path} href={subItem.path}>
                          <button
                            className={cn(
                              "flex items-center w-full h-9 px-3 rounded-lg transition-colors text-sm",
                              subActive
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-accent hover:text-foreground"
                            )}
                            data-testid={`nav-${subItem.label.toLowerCase().replace(" ", "-")}`}
                          >
                            <span className="truncate flex items-center gap-2">
                              {subItem.label}
                            </span>
                          </button>
                        </Link>
                      );
                    })}
                  </CollapsibleContent>
                </Collapsible>
              );
            }

            // Regular navigation item
            return (
              <Link key={item.path} href={href}>
                <button
                  className={cn(
                    "flex items-center gap-3 w-full h-10 px-3 rounded-lg transition-colors text-sm font-medium",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                  data-testid={`nav-${item.label.toLowerCase().replace(" ", "-")}`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              </Link>
            );
          })}
        </nav>

        <div className="border-t">
          <div className="p-2">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 h-10 text-muted-foreground"
              onClick={signOut}
              data-testid="button-signout"
            >
              <LogOut className="h-5 w-5" />
              <span>Sign Out</span>
            </Button>
          </div>
          <div className="px-4 py-2 text-xs text-muted-foreground border-t">
            <div className="flex gap-3 justify-center">
              <a href="/privacy-policy" target="_blank" className="hover:text-foreground transition-colors">
                Privacy Policy
              </a>
              <span>•</span>
              <a href="/terms" target="_blank" className="hover:text-foreground transition-colors">
                Terms of Service
              </a>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-40 h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center justify-between h-full px-6">
            <div className="flex items-center gap-3">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">
                {user?.companyName || "Your Business"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <HelpCircle className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Help & Support</TooltipContent>
              </Tooltip>

              {/* Theme toggle for desktop */}
              <ThemeToggle />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={user?.profileImageUrl || undefined} />
                      <AvatarFallback className="text-xs">{getInitials()}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{user?.firstName} {user?.lastName}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <Link href="/account">
                    <DropdownMenuItem>
                      <User className="mr-2 h-4 w-4" />
                      Account Settings
                    </DropdownMenuItem>
                  </Link>
                  <Link href="/support">
                    <DropdownMenuItem>
                      <Headphones className="mr-2 h-4 w-4" />
                      Support
                    </DropdownMenuItem>
                  </Link>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut} className="text-red-600 focus:text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

export default AppShell;
