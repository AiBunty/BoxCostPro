/**
 * Payment Success Page
 *
 * Shown after successful payment completion with:
 * - Success confirmation
 * - Invoice details and download
 * - Next steps guidance
 * - Login redirection
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, Download, Mail, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  grandTotal: number;
  planName: string;
  buyerCompanyName: string;
}

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const userId = searchParams.get('userId');
  const invoiceId = searchParams.get('invoiceId');

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (invoiceId) {
      fetchInvoice();
    }
  }, [invoiceId]);

  const fetchInvoice = async () => {
    try {
      const response = await fetch(`/api/invoices/${invoiceId}`);
      if (response.ok) {
        const data = await response.json();
        setInvoice(data);
      }
    } catch (error) {
      console.error('Failed to fetch invoice:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadInvoice = async () => {
    if (!invoiceId) return;

    setIsDownloading(true);

    try {
      const response = await fetch(`/api/invoices/${invoiceId}/download`);

      if (!response.ok) {
        throw new Error('Failed to download invoice');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Invoice_${invoice?.invoiceNumber?.replace(/\//g, '_')}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Success',
        description: 'Invoice downloaded successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to download invoice',
        variant: 'destructive',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <CardTitle className="text-2xl">Payment Successful!</CardTitle>
          <CardDescription>
            Your account has been created and your subscription is now active.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Success Message */}
          <Alert className="border-green-500">
            <Mail className="h-4 w-4 text-green-600" />
            <AlertDescription>
              We've sent a welcome email to your registered email address with your login credentials and invoice.
            </AlertDescription>
          </Alert>

          {/* Invoice Details */}
          {invoice && (
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <h3 className="font-semibold">Invoice Details</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">Invoice Number:</span>
                <span className="font-mono">{invoice.invoiceNumber}</span>

                <span className="text-muted-foreground">Date:</span>
                <span>{new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}</span>

                <span className="text-muted-foreground">Amount:</span>
                <span className="font-semibold">₹{invoice.grandTotal}</span>

                <span className="text-muted-foreground">Plan:</span>
                <span>{invoice.planName}</span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button
              onClick={handleDownloadInvoice}
              className="w-full"
              variant="outline"
              disabled={isDownloading || !invoice}
            >
              {isDownloading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Download Invoice
                </>
              )}
            </Button>

            <Button onClick={() => navigate('/auth')} className="w-full">
              Proceed to Login
            </Button>
          </div>

          {/* Next Steps */}
          <div className="border-t pt-4">
            <h4 className="font-semibold mb-2">What's Next?</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>✓ Check your email for login credentials</li>
              <li>✓ Log in and complete your profile setup</li>
              <li>✓ Configure paper pricing and flute settings</li>
              <li>✓ Start creating quotes for your customers</li>
            </ul>
          </div>

          {/* Support Information */}
          <div className="border-t pt-4">
            <h4 className="font-semibold mb-2">Need Help?</h4>
            <p className="text-sm text-muted-foreground">
              If you have any questions or need assistance, please contact our support team at{' '}
              <a href="mailto:support@boxcostpro.com" className="text-primary hover:underline">
                support@boxcostpro.com
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
