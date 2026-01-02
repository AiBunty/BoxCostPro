import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { ScrollToTop } from "@/components/ScrollToTop";

export default function Terms() {
  return (
    <div className="min-h-screen theme-erp">
      <SiteHeader currentPage="/terms" />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12 max-w-5xl">
        {/* Page Title */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900 dark:text-white">
            Terms of Service
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Last Updated: December 27, 2024
          </p>
        </div>

        {/* Content Cards */}
        <div className="space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl">1. Agreement to Terms</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700 dark:text-gray-300">
                These Terms of Service ("Terms") constitute a legally binding agreement between you (the "User" or "you") and DCore Systems LLP ("Company", "we", "us", or "our") regarding your use of the BoxCost Pro application (the "Service").
              </p>
              <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 p-4 rounded">
                <p className="text-amber-900 dark:text-amber-200 font-semibold">
                  By creating an account or using BoxCost Pro, you agree to be bound by these Terms.
                </p>
                <p className="text-amber-800 dark:text-amber-300 mt-2">
                  If you do not agree to these Terms, you may not access or use the Service.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl">2. Eligibility and Account Registration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">2.1 Eligibility</h3>
                <p className="text-gray-700 dark:text-gray-300 mb-2">To use BoxCost Pro, you must:</p>
                <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300 ml-4">
                  <li>Be at least 18 years of age</li>
                  <li>Have the legal capacity to enter into binding contracts</li>
                  <li>Represent a legitimate business entity operating in the packaging/manufacturing industry</li>
                  <li>Not be prohibited from using the Service under Indian law or any other applicable jurisdiction</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">2.2 Account Security</h3>
                <p className="text-gray-700 dark:text-gray-300 mb-2">You are responsible for:</p>
                <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300 ml-4">
                  <li>Maintaining the confidentiality of your account credentials</li>
                  <li>All activities that occur under your account</li>
                  <li>Notifying us immediately of any unauthorized use</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl">3. Acceptable Use Policy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Permitted Uses</h3>
                <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300 ml-4">
                  <li>Calculate corrugated box pricing for your business</li>
                  <li>Generate and send professional quotations to customers</li>
                  <li>Manage customer and product master data</li>
                  <li>Track quotation history and business analytics</li>
                </ul>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded">
                <h3 className="text-lg font-semibold mb-2 text-red-900 dark:text-red-200">Prohibited Uses</h3>
                <p className="text-red-800 dark:text-red-300 mb-2">You may NOT:</p>
                <ul className="list-disc list-inside space-y-1 text-red-800 dark:text-red-300 ml-4">
                  <li>Use the Service for any illegal purpose</li>
                  <li>Create fake quotations or manipulate GST calculations</li>
                  <li>Attempt to hack or disrupt the Service</li>
                  <li>Reverse engineer or decompile the software</li>
                  <li>Resell access to the Service</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl">4. Intellectual Property Rights</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700 dark:text-gray-300">
                BoxCost Pro, including its source code, design, features, trademarks, and logos, is the exclusive property of DCore Systems LLP. All rights not expressly granted to you are reserved.
              </p>
              <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4 rounded">
                <h3 className="text-lg font-semibold mb-2 text-blue-900 dark:text-blue-200">Your Content Ownership</h3>
                <p className="text-blue-800 dark:text-blue-300">
                  You retain full ownership of all data you input into BoxCost Pro, including customer records, product specifications, quotations, and business profile information.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl">5. Service Availability and Modifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700 dark:text-gray-300">
                We strive to maintain 99%+ uptime, but we do not guarantee uninterrupted service. The Service may be temporarily unavailable due to scheduled maintenance, emergency security updates, or third-party service provider outages.
              </p>
              <p className="text-gray-700 dark:text-gray-300">
                We reserve the right to add, modify, or remove features, update pricing structures (with 30 days' notice), or discontinue the Service entirely (with 90 days' notice).
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl">6. Data Privacy and Security</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700 dark:text-gray-300">
                Our data collection and privacy practices are detailed in our{' '}
                <Link href="/privacy" className="text-blue-600 hover:underline">
                  Privacy Policy
                </Link>
                , which is incorporated into these Terms by reference.
              </p>
              <p className="text-gray-700 dark:text-gray-300">
                We implement industry-standard security measures including HTTPS/TLS encryption, encrypted password storage, regular security audits, and restricted database access.
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl">7. Limitation of Liability</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded">
                <p className="text-red-900 dark:text-red-200 font-semibold mb-2">
                  CRITICAL LIMITATION:
                </p>
                <p className="text-red-800 dark:text-red-300">
                  TO THE MAXIMUM EXTENT PERMITTED BY INDIAN LAW, DCORE SYSTEMS LLP SHALL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES including lost profits, business interruption, or data loss.
                </p>
              </div>
              <p className="text-gray-700 dark:text-gray-300">
                The Service is provided "AS IS" and "AS AVAILABLE" without warranties of any kind. You are responsible for verifying the accuracy of all calculations and ensuring compliance with applicable laws.
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl">8. Governing Law</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700 dark:text-gray-300">
                These Terms shall be governed by and construed in accordance with the laws of India. Any disputes arising from these Terms or your use of the Service shall be subject to the exclusive jurisdiction of the courts in Pune, Maharashtra, India.
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl">9. Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 p-4 rounded">
                <p className="text-gray-900 dark:text-white font-semibold">DCore Systems LLP</p>
                <p className="text-gray-700 dark:text-gray-300">C-7, Pushpanagar Society, Near Medipoint Hospital</p>
                <p className="text-gray-700 dark:text-gray-300">Aundh, Pune – 411007, Maharashtra, India</p>
                <p className="text-gray-700 dark:text-gray-300 mt-2">
                  Email:{' '}
                  <a href="mailto:support@paperboxerp.com" className="text-blue-600 hover:underline">
                    support@paperboxerp.com
                  </a>
                </p>
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
