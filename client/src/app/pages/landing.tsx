import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Calculator, 
  Package, 
  Users, 
  FileText, 
  Search, 
  CheckSquare,
  Sparkles,
  ClipboardList,
  Printer,
  Award,
  Boxes,
  MessageCircle,
  TrendingUp,
  ArrowRight
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { ScrollToTop } from "@/components/ScrollToTop";

export default function Landing() {
  const comingSoonFeatures = [
    {
      icon: Sparkles,
      title: "AI Suggestions",
      description: "Smart pricing recommendations and material optimization using AI to maximize your margins",
      color: "from-red-500 to-orange-600",
      iconBg: "flex items-center justify-center",
      iconColor: "text-[#457B9D]",
      bgColor: "#F1F4F9"
    },
    {
      icon: ClipboardList,
      title: "Purchase Order Planner",
      description: "Automated PO generation based on quotes with supplier management and order tracking",
      color: "from-red-500 to-orange-600",
      iconBg: "flex items-center justify-center",
      iconColor: "text-[#457B9D]",
      bgColor: "#F1F4F9"
    },
    {
      icon: Printer,
      title: "Job Card Generator",
      description: "Production-ready job cards with QR codes, material specs, and machine instructions",
      color: "from-orange-500 to-red-600",
      iconBg: "flex items-center justify-center",
      iconColor: "text-[#457B9D]",
      bgColor: "#F1F4F9"
    },
    {
      icon: Award,
      title: "PDI / COA Generator",
      description: "Pre-Delivery Inspection reports and Certificate of Analysis for quality compliance",
      color: "from-green-500 to-emerald-600",
      iconBg: "flex items-center justify-center",
      iconColor: "text-[#457B9D]",
      bgColor: "#F1F4F9"
    },
    {
      icon: Boxes,
      title: "Paper Stock Management",
      description: "Real-time inventory tracking, reorder alerts, and stock consumption analytics",
      color: "from-amber-500 to-yellow-600",
      iconBg: "flex items-center justify-center",
      iconColor: "text-[#457B9D]",
      bgColor: "#F1F4F9"
    },
    {
      icon: MessageCircle,
      title: "Auto Client Follow-ups",
      description: "Automated Email & WhatsApp reminders for quote follow-ups",
      color: "from-teal-500 to-cyan-600",
      iconBg: "flex items-center justify-center",
      iconColor: "text-[#457B9D]",
      bgColor: "#F1F4F9"
    },
    {
      icon: TrendingUp,
      title: "Price Increase Emailer",
      description: "Generate professional price revision emails with % comparison charts for clients",
      color: "from-rose-500 to-pink-600",
      iconBg: "flex items-center justify-center",
      iconColor: "text-[#457B9D]",
      bgColor: "#F1F4F9"
    }
  ];

  return (
    <div className="min-h-screen theme-erp">
      <SiteHeader currentPage="/" />

      <main className="container mx-auto px-4">
        {/* Hero Section */}
        <section className="text-center py-16 md:py-24 section">
          <Badge variant="secondary" className="mb-6 px-4 py-2 text-sm font-medium" data-testid="badge-hero">
            Trusted by 100+ Corrugators
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 text-gray-900 dark:text-white leading-tight" data-testid="text-hero-title">
            Not Just a Costing Tool —
            <br />
            <span className="bg-gradient-to-r from-red-500 via-orange-500 to-red-600 bg-clip-text text-transparent">
              Your Smart Sales Representative
            </span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-10 max-w-3xl mx-auto leading-relaxed" data-testid="text-hero-description">
            Calculate accurate costs for RSC boxes and sheets. Manage quotes, track customers, 
            and grow your corrugated packaging business with enterprise-grade tools.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link href="/auth">
              <Button size="lg" className="gap-2 text-lg px-8 py-6 btn-brand" data-testid="button-get-started">
                Start Free Trial
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="/auth">
              <Button size="lg" variant="outline" className="text-lg px-8 py-6 btn-secondary hover:bg-[#EAF2F8]" data-testid="button-watch-demo">
                Watch Demo
              </Button>
            </Link>
          </div>
        </section>

        {/* Logo Divider */}
        <div className="flex justify-center py-8">
          <img src="/logo.png" alt="PaperBox ERP" className="w-24 h-24 md:w-32 md:h-32 rounded-2xl shadow-lg logo-float" />
        </div>

        {/* Current Features */}
        <section className="py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4" data-testid="text-features-title">
              Everything You Need for Box Costing
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Powerful features designed specifically for corrugated box manufacturers
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="group border-0 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 bg-white hover:bg-[#F8FAFC] dark:bg-[var(--surface)] dark:hover:bg-white/10">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 bg-[#F1F4F9] group-hover:bg-white transition-colors">
                  <Calculator className="h-6 w-6 text-[#457B9D]" />
                </div>
                <CardTitle className="dark:group-hover:text-white">Accurate Costing</CardTitle>
                <CardDescription className="dark:group-hover:text-white">
                  Calculate paper costs, manufacturing costs, and profit margins with precision
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="group border-0 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 bg-white hover:bg-[#F8FAFC] dark:bg-[var(--surface)] dark:hover:bg-white/10">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 bg-[#F1F4F9] group-hover:bg-white transition-colors">
                  <Users className="h-6 w-6 text-[#457B9D]" />
                </div>
                <CardTitle className="dark:group-hover:text-white">Party Management</CardTitle>
                <CardDescription className="dark:group-hover:text-white">
                  Save and manage customer profiles for quick quote generation
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="group border-0 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 bg-white hover:bg-[#F8FAFC] dark:bg-[var(--surface)] dark:hover:bg-white/10">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 bg-[#F1F4F9] group-hover:bg-white transition-colors">
                  <FileText className="h-6 w-6 text-[#457B9D]" />
                </div>
                <CardTitle className="dark:group-hover:text-white">Quote Management</CardTitle>
                <CardDescription className="dark:group-hover:text-white">
                  Save, edit, and recall quotes. Send via WhatsApp or Email instantly
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="group border-0 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 bg-white hover:bg-[#F8FAFC] dark:bg-[var(--surface)] dark:hover:bg-white/10">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 bg-[#F1F4F9] group-hover:bg-white transition-colors">
                  <Search className="h-6 w-6 text-[#457B9D]" />
                </div>
                <CardTitle className="dark:group-hover:text-white">Smart Search</CardTitle>
                <CardDescription className="dark:group-hover:text-white">
                  Find quotes by party name, box name, or box size in seconds
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="group border-0 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 bg-white hover:bg-[#F8FAFC] dark:bg-[var(--surface)] dark:hover:bg-white/10">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 bg-[#F1F4F9] group-hover:bg-white transition-colors">
                  <Package className="h-6 w-6 text-[#457B9D]" />
                </div>
                <CardTitle className="dark:group-hover:text-white">Strength Analysis</CardTitle>
                <CardDescription className="dark:group-hover:text-white">
                  McKee Formula calculations for ECT, BCT, and Burst Strength
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="group border-0 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 bg-white hover:bg-[#F8FAFC] dark:bg-[var(--surface)] dark:hover:bg-white/10">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 bg-[#F1F4F9] group-hover:bg-white transition-colors">
                  <CheckSquare className="h-6 w-6 text-[#457B9D]" />
                </div>
                <CardTitle className="dark:group-hover:text-white">Item Selection</CardTitle>
                <CardDescription className="dark:group-hover:text-white">
                  Select specific items to include in WhatsApp or Email messages
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>

        {/* Coming Soon Section */}
        <section className="py-16">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-gradient-to-r from-red-600 to-orange-600 text-white border-0" data-testid="badge-coming-soon">
              Coming Soon
            </Badge>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4" data-testid="text-coming-soon-title">
              Powerful Features on the Roadmap
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              We're building the future of corrugated box manufacturing ERP. 
              Here's what's coming to help you grow your business.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {comingSoonFeatures.map((feature, index) => (
              <Card 
                key={index}
                className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 group bg-white hover:bg-[#F8FAFC] dark:bg-[var(--surface)] dark:hover:bg-white/10"
                data-testid={`card-coming-soon-${index}`}
              >
                {/* Gradient overlay on hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-5 transition-opacity`} />
                
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-12 h-12 rounded-xl ${feature.iconBg} bg-[#F1F4F9] group-hover:bg-white transition-colors`}>
                      <feature.icon className={`h-6 w-6 ${feature.iconColor}`} />
                    </div>
                    <Badge 
                      variant="outline" 
                      className="text-xs bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
                    >
                      Coming Soon
                    </Badge>
                  </div>
                  <CardTitle className="text-lg dark:group-hover:text-white">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed dark:group-hover:text-white">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16">
          <div className="relative overflow-hidden rounded-3xl cta-gradient p-12 md:p-16 text-center">
            {/* Decorative elements */}
            <div className="absolute top-0 left-0 w-64 h-64 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/10 rounded-full translate-x-1/3 translate-y-1/3" />
            
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold mb-4" data-testid="text-cta-title">
                Ready to Transform Your Box Costing?
              </h2>
              <p className="text-lg md:text-xl mb-8 opacity-90 max-w-2xl mx-auto">
                Join hundreds of packaging businesses that trust PaperBox ERP for accurate quotes, 
                streamlined operations, and better profit margins.
              </p>
              <div className="flex items-center justify-center gap-4 flex-wrap">
                <Link href="/auth">
                  <Button size="lg" variant="secondary" className="gap-2 text-lg px-8" data-testid="button-signup">
                    Start Your Free Trial
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-gray-50 dark:bg-gray-900/50">
        <div className="container mx-auto px-4 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="PaperBox ERP" className="w-8 h-8 rounded-lg" />
              <span className="font-semibold text-gray-900 dark:text-white">PaperBox ERP</span>
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Professional Corrugated Box Costing & ERP Solutions
            </p>
            <div className="flex items-center gap-6 text-sm text-gray-600 dark:text-gray-400">
              <Link href="/" className="hover:text-red-600 transition-colors">Home</Link>
              <Link href="/about" className="hover:text-red-600 transition-colors">About</Link>
              <Link href="/pricing" className="hover:text-red-600 transition-colors">Pricing</Link>
              <Link href="/contact" className="hover:text-red-600 transition-colors">Contact</Link>
              <Link href="/terms" className="hover:text-red-600 transition-colors">Terms</Link>
              <Link href="/privacy" className="hover:text-red-600 transition-colors">Privacy</Link>
            </div>
          </div>
        </div>
      </footer>
      <ScrollToTop />
    </div>
  );
}
