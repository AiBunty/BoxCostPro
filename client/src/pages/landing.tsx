import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calculator, Package, Users, FileText, Search, CheckSquare } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Package className="h-8 w-8 text-blue-600" />
            <span className="text-xl font-bold">PaperBox ERP</span>
          </div>
          <Link href="/auth">
            <Button data-testid="button-signin">
              Sign In
            </Button>
          </Link>
        </nav>
      </header>

      <main className="container mx-auto px-4 py-16">
        <section className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-6 text-gray-900 dark:text-white">
            Professional Corrugated Box Costing
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
            Calculate accurate costs for RSC boxes and sheets. Manage quotes, track customers, and grow your packaging business.
          </p>
          <Link href="/auth">
            <Button size="lg" data-testid="button-get-started">
              Get Started Free
            </Button>
          </Link>
        </section>

        <section className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          <Card>
            <CardHeader>
              <Calculator className="h-10 w-10 text-blue-600 mb-2" />
              <CardTitle>Accurate Costing</CardTitle>
              <CardDescription>
                Calculate paper costs, manufacturing costs, and profit margins with precision
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Users className="h-10 w-10 text-green-600 mb-2" />
              <CardTitle>Party Management</CardTitle>
              <CardDescription>
                Save and manage customer profiles for quick quote generation
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <FileText className="h-10 w-10 text-purple-600 mb-2" />
              <CardTitle>Quote Management</CardTitle>
              <CardDescription>
                Save, edit, and recall quotes. Send via WhatsApp or Email instantly
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Search className="h-10 w-10 text-orange-600 mb-2" />
              <CardTitle>Smart Search</CardTitle>
              <CardDescription>
                Find quotes by party name, box name, or box size in seconds
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Package className="h-10 w-10 text-red-600 mb-2" />
              <CardTitle>Strength Analysis</CardTitle>
              <CardDescription>
                McKee Formula calculations for ECT, BCT, and Burst Strength
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CheckSquare className="h-10 w-10 text-teal-600 mb-2" />
              <CardTitle>Item Selection</CardTitle>
              <CardDescription>
                Select specific items to include in WhatsApp or Email messages
              </CardDescription>
            </CardHeader>
          </Card>
        </section>

        <section className="text-center py-16 bg-blue-600 rounded-2xl text-white">
          <h2 className="text-3xl font-bold mb-4">Ready to streamline your box costing?</h2>
          <p className="text-lg mb-8 opacity-90">
            Join packaging businesses that trust our calculator for accurate quotes
          </p>
          <Link href="/auth">
            <Button size="lg" variant="secondary" data-testid="button-signup">
              Sign Up Now
            </Button>
          </Link>
        </section>
      </main>

      <footer className="container mx-auto px-4 py-8 text-center text-gray-600 dark:text-gray-400">
        <p>PaperBox ERP - Professional Packaging Solutions</p>
      </footer>
    </div>
  );
}
