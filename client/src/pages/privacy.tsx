import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { ScrollToTop } from "@/components/ScrollToTop";

export default function Privacy() {
  return (
    <div className="min-h-screen theme-erp">
      <SiteHeader currentPage="/privacy" />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12 max-w-5xl">
        {/* Page Title */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900 dark:text-white">
            Privacy Policy
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Last Updated: December 27, 2024
          </p>
        </div>

        {/* Content Cards */}
        <div className="space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl">1. Introduction</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700 dark:text-gray-300">
                BoxCost Pro ("we", "our", or "us") is committed to protecting your privacy and personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our corrugated box costing and quotation management application.
              </p>
              <p className="text-gray-700 dark:text-gray-300">
                <strong>Service Provider:</strong> DCore Systems LLP, a limited liability partnership registered in India.
              </p>
              <div className="bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 p-4 rounded">
                <p className="text-green-900 dark:text-green-200 font-semibold">
                  Key Principle: We only collect and use data that is necessary to provide our core service. We do not sell, rent, or share your data with third parties for marketing purposes.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl">2. Information We Collect</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">2.1 Account Information</h3>
                <p className="text-gray-700 dark:text-gray-300 mb-2">When you create an account, we collect:</p>
                <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300 ml-4">
                  <li><strong>Email Address:</strong> Used for authentication and account recovery</li>
                  <li><strong>Name:</strong> For personalization and identification</li>
                  <li><strong>Password:</strong> Stored in encrypted (hashed) form using industry-standard bcrypt algorithm</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">2.2 Business Profile Information</h3>
                <p className="text-gray-700 dark:text-gray-300 mb-2">To enable quotation generation, you provide:</p>
                <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300 ml-4">
                  <li>Company/Business name</li>
                  <li>Business address and contact details</li>
                  <li>GST number (optional, for tax-compliant quotations)</li>
                  <li>Company logo (optional)</li>
                  <li>Bank account details (optional, for payment instructions)</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">2.3 Google Account Data</h3>
                <p className="text-gray-700 dark:text-gray-300 mb-2">
                  If you choose to sign in with Google, we access only basic profile scopes required for authentication:
                </p>
                <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300 ml-4">
                  <li><strong>Email address:</strong> For authentication and account notices</li>
                  <li><strong>Basic profile information:</strong> Name and profile picture (if available)</li>
                </ul>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded">
                <p className="text-red-900 dark:text-red-200 font-semibold mb-2">
                  Google OAuth & Limited Use
                </p>
                <p className="text-red-800 dark:text-red-300">
                  We use Google OAuth to authenticate your account. We request basic scopes (openid, email, profile) to identify you and secure access. We do not sell or share Google user data for advertising and only use it to provide and secure the service.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl">3. How We Use Your Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700 dark:text-gray-300 mb-2">We use your information to:</p>
              <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300 ml-4">
                <li>Provide authentication and account management</li>
                <li>Generate professional quotations for your business</li>
                <li>Provide customer support</li>
                <li>Improve application features</li>
                <li>Ensure security and prevent fraud</li>
              </ul>
              <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 p-4 rounded mt-4">
                <p className="text-amber-900 dark:text-amber-200 font-semibold">
                  We DO NOT use your data for:
                </p>
                <p className="text-amber-800 dark:text-amber-300">
                  Targeted advertising, selling to third parties, training AI models, or any purpose not directly related to providing the BoxCost Pro service.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl">4. Data Storage and Security</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Security Measures</h3>
                <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300 ml-4">
                  <li>All data transmissions use HTTPS/TLS encryption (minimum TLS 1.2)</li>
                  <li>Passwords are hashed using bcrypt with salt (never stored in plain text)</li>
                  <li>Database access restricted to authorized personnel only</li>
                  <li>Regular security updates and vulnerability patching</li>
                  <li>Session management with secure, httpOnly cookies</li>
                  <li>Regular automated backups with encryption at rest</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Data Retention</h3>
                <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300 ml-4">
                  <li><strong>Active accounts:</strong> Data retained as long as your account is active</li>
                  <li><strong>Inactive accounts:</strong> After 3 years of inactivity, we may send a notice before deletion</li>
                  <li><strong>Deleted accounts:</strong> Personal data deleted within 30 days of account deletion request</li>
                  <li><strong>Legal obligations:</strong> Some data may be retained longer if required by Indian tax or business laws</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl">5. Data Sharing and Disclosure</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 p-4 rounded">
                <p className="text-green-900 dark:text-green-200 font-semibold">
                  We Do NOT Sell Your Data
                </p>
                <p className="text-green-800 dark:text-green-300">
                  BoxCost Pro does not sell, rent, or trade your personal information to third parties for marketing purposes. Period.
                </p>
              </div>
              <p className="text-gray-700 dark:text-gray-300 mt-4">
                We may share your data only with:
              </p>
              <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300 ml-4">
                <li><strong>Cloud hosting providers:</strong> To store and serve the application</li>
                <li><strong>Email service provider:</strong> For transactional emails like password reset</li>
                <li><strong>Legal requirements:</strong> If required by law, court order, or government regulation</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl">6. Your Rights and Choices</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700 dark:text-gray-300 mb-2">You have the following rights regarding your data:</p>
              <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300 ml-4">
                <li><strong>Access:</strong> View all your data within the application at any time</li>
                <li><strong>Correction:</strong> Update or correct inaccurate information via Settings page</li>
                <li><strong>Export:</strong> Download your quotations and customer data in PDF/Excel format</li>
                <li><strong>Deletion:</strong> Request complete account deletion</li>
                <li><strong>Withdraw consent:</strong> Revoke Google account permissions via Google Account settings</li>
              </ul>
              <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded mt-4">
                <p className="text-blue-900 dark:text-blue-200 font-semibold mb-2">
                  Google Account Permissions
                </p>
                <p className="text-blue-800 dark:text-blue-300">
                  You can revoke access at any time via{' '}
                  <a
                    href="https://myaccount.google.com/permissions"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    Google Account Permissions
                  </a>
                  . Revoking access will disable Google sign-in but won't delete your BoxCost Pro account.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl">7. Data Deletion</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700 dark:text-gray-300">
                To request data deletion, email{' '}
                <a href="mailto:support@paperboxerp.com" className="text-blue-600 hover:underline">
                  support@paperboxerp.com
                </a>{' '}
                with the subject "Delete My Account". We confirm identity and delete within 30 days.
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl">8. Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-gray-50 dark:bg-gray-800 border-l-4 border-blue-500 p-4 rounded">
                <p className="text-gray-900 dark:text-white font-semibold">Data Controller:</p>
                <p className="text-gray-700 dark:text-gray-300">DCore Systems LLP</p>
                <p className="text-gray-700 dark:text-gray-300">C-7, Pushpanagar Society, Near Medipoint Hospital</p>
                <p className="text-gray-700 dark:text-gray-300">Aundh, Pune – 411007, Maharashtra, India</p>
                <p className="text-gray-700 dark:text-gray-300 mt-2">
                  Privacy Contact:{' '}
                  <a href="mailto:support@paperboxerp.com" className="text-blue-600 hover:underline">
                    support@paperboxerp.com
                  </a>
                </p>
                <p className="text-gray-700 dark:text-gray-300">
                  Subject Line: "Privacy Inquiry"
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
