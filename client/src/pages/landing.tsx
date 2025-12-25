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

export default function Landing() {
  const comingSoonFeatures = [
    {
      icon: Sparkles,
      title: "AI Suggestions",
      description: "Smart pricing recommendations and material optimization using AI to maximize your margins",
      color: "from-purple-500 to-indigo-600",
      iconBg: "bg-purple-100 dark:bg-purple-900/30",
      iconColor: "text-purple-600 dark:text-purple-400"
    },
    {
      icon: ClipboardList,
      title: "Purchase Order Planner",
      description: "Automated PO generation based on quotes with supplier management and order tracking",
      color: "from-blue-500 to-cyan-600",
      iconBg: "bg-blue-100 dark:bg-blue-900/30",
      iconColor: "text-blue-600 dark:text-blue-400"
    },
    {
      icon: Printer,
      title: "Job Card Generator",
      description: "Production-ready job cards with QR codes, material specs, and machine instructions",
      color: "from-orange-500 to-red-600",
      iconBg: "bg-orange-100 dark:bg-orange-900/30",
      iconColor: "text-orange-600 dark:text-orange-400"
    },
    {
      icon: Award,
      title: "PDI / COA Generator",
      description: "Pre-Delivery Inspection reports and Certificate of Analysis for quality compliance",
      color: "from-green-500 to-emerald-600",
      iconBg: "bg-green-100 dark:bg-green-900/30",
      iconColor: "text-green-600 dark:text-green-400"
    },
    {
      icon: Boxes,
      title: "Paper Stock Management",
      description: "Real-time inventory tracking, reorder alerts, and stock consumption analytics",
      color: "from-amber-500 to-yellow-600",
      iconBg: "bg-amber-100 dark:bg-amber-900/30",
      iconColor: "text-amber-600 dark:text-amber-400"
    },
    {
      icon: MessageCircle,
      title: "Auto Client Follow-ups",
      description: "Automated Email & WhatsApp reminders for quote follow-ups and payment collection",
      color: "from-teal-500 to-cyan-600",
      iconBg: "bg-teal-100 dark:bg-teal-900/30",
      iconColor: "text-teal-600 dark:text-teal-400"
    },
    {
      icon: TrendingUp,
      title: "Price Increase Emailer",
      description: "Generate professional price revision emails with % comparison charts for clients",
      color: "from-rose-500 to-pink-600",
      iconBg: "bg-rose-100 dark:bg-rose-900/30",
      iconColor: "text-rose-600 dark:text-rose-400"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Navigation */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
              <Package className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              PaperBox ERP
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/auth">
              <Button variant="ghost" data-testid="link-signin">
                Sign In
              </Button>
            </Link>
            <Link href="/auth">
              <Button data-testid="button-get-started-nav" className="gap-2">
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </nav>
      </header>

      <main className="container mx-auto px-4">
        {/* Hero Section */}
        <section className="text-center py-16 md:py-24">
          <Badge variant="secondary" className="mb-6 px-4 py-2 text-sm font-medium" data-testid="badge-hero">
            Trusted by 100+ Corrugators
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 text-gray-900 dark:text-white leading-tight" data-testid="text-hero-title">
            Not Just a Costing Tool —
            <br />
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Your Smart Sales Representative
            </span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-10 max-w-3xl mx-auto leading-relaxed" data-testid="text-hero-description">
            Calculate accurate costs for RSC boxes and sheets. Manage quotes, track customers, 
            and grow your corrugated packaging business with enterprise-grade tools.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link href="/auth">
              <Button size="lg" className="gap-2 text-lg px-8 py-6" data-testid="button-get-started">
                Start Free Trial
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="/auth">
              <Button size="lg" variant="outline" className="text-lg px-8 py-6" data-testid="button-watch-demo">
                Watch Demo
              </Button>
            </Link>
          </div>
        </section>

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
            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-3">
                  <Calculator className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <CardTitle>Accurate Costing</CardTitle>
                <CardDescription>
                  Calculate paper costs, manufacturing costs, and profit margins with precision
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-3">
                  <Users className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <CardTitle>Party Management</CardTitle>
                <CardDescription>
                  Save and manage customer profiles for quick quote generation
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-3">
                  <FileText className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <CardTitle>Quote Management</CardTitle>
                <CardDescription>
                  Save, edit, and recall quotes. Send via WhatsApp or Email instantly
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mb-3">
                  <Search className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
                <CardTitle>Smart Search</CardTitle>
                <CardDescription>
                  Find quotes by party name, box name, or box size in seconds
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-3">
                  <Package className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <CardTitle>Strength Analysis</CardTitle>
                <CardDescription>
                  McKee Formula calculations for ECT, BCT, and Burst Strength
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center mb-3">
                  <CheckSquare className="h-6 w-6 text-teal-600 dark:text-teal-400" />
                </div>
                <CardTitle>Item Selection</CardTitle>
                <CardDescription>
                  Select specific items to include in WhatsApp or Email messages
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>

        {/* Coming Soon Section */}
        <section className="py-16">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-0" data-testid="badge-coming-soon">
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
                className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 group"
                data-testid={`card-coming-soon-${index}`}
              >
                {/* Gradient overlay on hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-5 transition-opacity`} />
                
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-12 h-12 rounded-xl ${feature.iconBg} flex items-center justify-center`}>
                      <feature.icon className={`h-6 w-6 ${feature.iconColor}`} />
                    </div>
                    <Badge 
                      variant="outline" 
                      className="text-xs bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300"
                    >
                      Coming Soon
                    </Badge>
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white p-12 md:p-16 text-center">
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
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                <Package className="h-4 w-4 text-white" />
              </div>
              <span className="font-semibold text-gray-900 dark:text-white">PaperBox ERP</span>
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Professional Corrugated Box Costing & ERP Solutions
            </p>
            <div className="flex items-center gap-6 text-sm text-gray-600 dark:text-gray-400">
              <Link href="/auth" className="hover:text-blue-600 transition-colors">Home</Link>
              <Link href="/auth" className="hover:text-blue-600 transition-colors">About</Link>
              <Link href="/auth" className="hover:text-blue-600 transition-colors">Pricing</Link>
              <Link href="/auth" className="hover:text-blue-600 transition-colors">Contact</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
