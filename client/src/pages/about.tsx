import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, ArrowRight, Shield, Users, Globe, CheckCircle } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { ScrollToTop } from "@/components/ScrollToTop";

export default function About() {
  return (
    <div className="min-h-screen theme-erp">
      <SiteHeader currentPage="/about" />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12 max-w-5xl">
        {/* Page Title */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900 dark:text-white">
            About DCore Systems LLP
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            Building secure, scalable, and transparent business software solutions
          </p>
        </div>

        {/* Content Cards */}
        <div className="space-y-6">
          {/* Introduction */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Globe className="h-6 w-6 text-red-600" />
                Who We Are
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700 dark:text-gray-300">
                <strong>paperboxerp.com</strong> is a cloud-based Software-as-a-Service (SaaS) platform developed and operated by <strong>DCore Systems LLP</strong>, a registered technology company based in Pune, Maharashtra, India.
              </p>
              <p className="text-gray-700 dark:text-gray-300">
                We design and maintain business software solutions that help organizations manage operations, workflows, communication, and data efficiently using secure and scalable cloud infrastructure.
              </p>
              <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded">
                <p className="text-red-900 dark:text-red-200">
                  Our applications are built with a strong focus on <strong>data security, transparency, and compliance</strong> with applicable platform and privacy regulations, including <strong>Google API Services User Data Policy</strong>.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Products & Services */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Package className="h-6 w-6 text-purple-600" />
                Our Products & Services
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* PaperBox ERP */}
              <div className="bg-white dark:from-gray-800 dark:to-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Package className="h-5 w-5 text-red-600" />
                  PaperBox ERP
                </h3>
                <p className="text-gray-700 dark:text-gray-300 mb-3">
                  PaperBox ERP is a business management and ERP platform created for packaging and manufacturing businesses. It enables users to manage quotations, costing, reporting, and operational workflows in a centralized and secure environment.
                </p>
                <p className="text-gray-700 dark:text-gray-300 font-semibold">
                  The platform only accesses and processes user data that is strictly required to provide core application functionality.
                </p>
                <div className="mt-4">
                  <Link href="/">
                    <Button size="sm" className="gap-2">
                      Learn More
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>

              {/* AI Bunty */}
              <div className="bg-gradient-to-r from-green-50 to-teal-50 dark:from-green-900/20 dark:to-teal-900/20 p-6 rounded-lg border border-green-200 dark:border-green-800">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                  AI Bunty (by DCore Systems LLP)
                </h3>
                <p className="text-gray-700 dark:text-gray-300 mb-3">
                  AI Bunty is an AI-powered SaaS platform developed by DCore Systems LLP for coaches, consultants, agencies, and service professionals.
                </p>
                <p className="text-gray-700 dark:text-gray-300 font-semibold mb-2">AI Bunty provides:</p>
                <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300 ml-4 mb-3">
                  <li>CRM and lead management</li>
                  <li>Automated follow-ups via email and messaging</li>
                  <li>Appointment scheduling and reminders</li>
                  <li>Business analytics and workflow automation</li>
                </ul>
                <p className="text-gray-700 dark:text-gray-300 mb-3">
                  🌐 Official website:{' '}
                  <a
                    href="https://aibunty.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-red-600 hover:underline font-semibold"
                  >
                    aibunty.com
                  </a>
                </p>
                <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded">
                  <p className="text-green-900 dark:text-green-200 text-sm">
                    <strong>AI Bunty does not sell, share, or misuse user data.</strong> All access to user information is permission-based and limited to the services explicitly enabled by the user.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Data Usage & Transparency */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Shield className="h-6 w-6 text-green-600" />
                Data Usage & Transparency Commitment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700 dark:text-gray-300">
                DCore Systems LLP follows a <strong>privacy-first approach</strong> across all its software products.
              </p>
              <div className="bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 p-4 rounded">
                <p className="text-green-900 dark:text-green-200 font-semibold mb-3">We ensure that:</p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2 text-green-800 dark:text-green-300">
                    <CheckCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                    <span>User data is collected only for clearly defined and legitimate purposes</span>
                  </li>
                  <li className="flex items-start gap-2 text-green-800 dark:text-green-300">
                    <CheckCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                    <span>Data access is limited to what is required for app functionality</span>
                  </li>
                  <li className="flex items-start gap-2 text-green-800 dark:text-green-300">
                    <CheckCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                    <span>No user data is sold or shared with third parties for advertising</span>
                  </li>
                  <li className="flex items-start gap-2 text-green-800 dark:text-green-300">
                    <CheckCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                    <span>Users maintain control over their data at all times</span>
                  </li>
                  <li className="flex items-start gap-2 text-green-800 dark:text-green-300">
                    <CheckCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                    <span>Industry-standard security practices are followed to protect stored data</span>
                  </li>
                </ul>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded">
                <p className="text-red-900 dark:text-red-200">
                  Any data accessed through <strong>Google APIs</strong> (such as basic profile or email, if enabled by the user) is used solely to provide authentication, communication, or user-requested features, in full compliance with Google policies.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Organization & Team */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Users className="h-6 w-6 text-indigo-600" />
                Organization & Team
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700 dark:text-gray-300">
                DCore Systems LLP is operated by a small core team responsible for development, data analysis, and business operations:
              </p>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800 text-center">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-600 to-orange-600 flex items-center justify-center mx-auto mb-3">
                    <span className="text-white font-bold text-lg">PD</span>
                  </div>
                  <h4 className="font-bold text-gray-900 dark:text-white">Parin Daulat</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Developer & CEO</p>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800 text-center">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center mx-auto mb-3">
                    <span className="text-white font-bold text-lg">DD</span>
                  </div>
                  <h4 className="font-bold text-gray-900 dark:text-white">Devanshi Daulat</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Chief Data Analyst</p>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-teal-50 dark:from-green-900/20 dark:to-teal-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800 text-center">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-600 to-teal-600 flex items-center justify-center mx-auto mb-3">
                    <span className="text-white font-bold text-lg">DD</span>
                  </div>
                  <h4 className="font-bold text-gray-900 dark:text-white">Dhawal Dand</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Marketing</p>
                </div>
              </div>
              <p className="text-gray-700 dark:text-gray-300 text-center italic">
                All products are designed, developed, and maintained internally by this team.
              </p>
            </CardContent>
          </Card>

          {/* Company Information */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl">Company Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-gray-50 dark:bg-gray-800 border-l-4 border-gray-500 p-4 rounded">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-semibold mb-1">Legal Name</p>
                    <p className="text-gray-900 dark:text-white">DCore Systems LLP</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-semibold mb-1">Business Type</p>
                    <p className="text-gray-900 dark:text-white">Software as a Service (SaaS)</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-semibold mb-1">Ownership</p>
                    <p className="text-gray-900 dark:text-white">Privately Operated</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-semibold mb-1">Contact</p>
                    <p className="text-gray-900 dark:text-white">
                      <a href="mailto:support@paperboxerp.com" className="text-red-600 hover:underline">
                        support@paperboxerp.com
                      </a>
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-300 dark:border-gray-600">
                  <p className="text-sm text-gray-600 dark:text-gray-400 font-semibold mb-1">Registered Address</p>
                  <p className="text-gray-900 dark:text-white">
                    C-7, Pushpanagar Society,<br />
                    Near Medipoint Hospital,<br />
                    Aundh, Pune – 411007,<br />
                    Maharashtra, India
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-gray-50 dark:bg-gray-900/50 mt-16">
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
              <Link href="/" className="hover:text-red-600 transition-colors">
                Home
              </Link>
              <Link href="/about" className="hover:text-red-600 transition-colors">
                About
              </Link>
              <Link href="/pricing" className="hover:text-red-600 transition-colors">
                Pricing
              </Link>
              <Link href="/contact" className="hover:text-red-600 transition-colors">
                Contact
              </Link>
              <Link href="/terms" className="hover:text-red-600 transition-colors">
                Terms
              </Link>
              <Link href="/privacy" className="hover:text-red-600 transition-colors">
                Privacy
              </Link>
            </div>
          </div>
        </div>
      </footer>
      <ScrollToTop />
    </div>
  );
}
