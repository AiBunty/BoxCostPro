import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { Home, Info, DollarSign, Mail, FileText, Shield, Menu, Package, ArrowRight } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface SiteHeaderProps {
  currentPage?: string;
}

export function SiteHeader({ currentPage }: SiteHeaderProps) {
  const navItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/about", label: "About", icon: Info },
    { href: "/pricing", label: "Pricing", icon: DollarSign },
    { href: "/contact", label: "Contact", icon: Mail },
  ];

  return (
    <header className="container mx-auto px-4 py-6">
      <nav className="flex items-center justify-between">
        {/* Logo */}
        <Link href="/">
          <div className="flex items-center gap-2 cursor-pointer">
            <img src="/logo.png" alt="PaperBox ERP" className="w-10 h-10 rounded-xl" />
            <span className="text-xl font-bold bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
              PaperBox ERP
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-6">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <button
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200",
                    isActive
                      ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-semibold"
                      : "text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-sm">{item.label}</span>
                </button>
              </Link>
            );
          })}
        </div>

        {/* Auth Buttons, Theme Toggle & Mobile Menu */}
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <div className="hidden md:flex items-center gap-2">
            <Link href="/auth">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/auth">
              <Button className="gap-2">
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          {/* Mobile Menu */}
          <Sheet>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="outline" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[400px]">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <img src="/logo.png" alt="PaperBox ERP" className="w-8 h-8 rounded-lg" />
                  <span>PaperBox ERP</span>
                </SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-4 mt-8">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentPage === item.href;
                  return (
                    <Link key={item.href} href={item.href}>
                      <button
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-left",
                          isActive
                            ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-semibold"
                            : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        <span>{item.label}</span>
                      </button>
                    </Link>
                  );
                })}
                <div className="flex flex-col gap-2 mt-4 pt-4 border-t">
                  <Link href="/auth">
                    <Button variant="outline" className="w-full">
                      Sign In
                    </Button>
                  </Link>
                  <Link href="/auth">
                    <Button className="w-full gap-2">
                      Get Started
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
}
