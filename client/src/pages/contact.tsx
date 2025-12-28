import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Package, ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { ScrollToTop } from "@/components/ScrollToTop";

export default function Contact() {
  return (
    <div className="min-h-screen theme-erp">
      <SiteHeader currentPage="/contact" />

      <main className="container mx-auto px-4 py-20">
        <h1 className="text-4xl md:text-5xl font-bold mb-6 text-gray-900 dark:text-white">Contact Us</h1>
        <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mb-6">
          For sales, support, or partnerships reach out at hello@paperboxerp.com or use the form below.
        </p>
        <div className="max-w-lg">
          <label className="block text-sm text-gray-700 mb-2">Message</label>
          <textarea className="w-full p-3 border rounded-md mb-3" rows={6} />
          <div className="flex gap-3">
            <Button>Send Message</Button>
            <Link href="/auth"><Button variant="ghost">Sign In</Button></Link>
          </div>
        </div>
      </main>

      <footer className="border-t bg-gray-50 dark:bg-gray-900/50">
        <div className="container mx-auto px-4 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="PaperBox ERP" className="w-8 h-8 rounded-lg" />
              <span className="font-semibold text-gray-900 dark:text-white">PaperBox ERP</span>
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Professional Corrugated Box Costing & ERP Solutions</p>
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
