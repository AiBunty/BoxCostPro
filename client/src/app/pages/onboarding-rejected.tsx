import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Mail, Phone, ShieldX, RotateCw } from "lucide-react";
import { useLocation } from "wouter";

interface Props {
  reason?: string | null;
}

export default function OnboardingRejected({ reason }: Props) {
  const [, navigate] = useLocation();

  return (
    <div className="p-4 md:p-6 flex justify-center">
      <Card className="max-w-2xl w-full">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
            <ShieldX className="w-7 h-7" />
          </div>
          <CardTitle className="text-2xl">Verification Not Approved</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert variant="destructive">
            <AlertTitle>Action required</AlertTitle>
            <AlertDescription>
              Your account verification was not approved. Please review the details below and contact our support team to resolve this quickly.
            </AlertDescription>
          </Alert>

          <div className="space-y-2 text-sm bg-muted/40 p-3 rounded-md">
            <p className="font-medium text-muted-foreground">Reason from admin</p>
            <p className="text-foreground whitespace-pre-wrap">{reason || "No specific reason was provided."}</p>
          </div>

          <div className="grid gap-3">
            <Button variant="default" onClick={() => navigate("/onboarding")}>Resubmit details</Button>
            <Button variant="secondary" asChild>
              <a href="mailto:saas@aibunty.com?subject=Account%20Verification%20Assistance">Contact support (email)</a>
            </Button>
            <Button variant="outline" asChild>
              <a href="tel:7003210880">Call/WhatsApp: 7003210880</a>
            </Button>
          </div>

          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <RotateCw className="w-3 h-3" />
            After updating your details, please submit again for review. Our team typically responds within 24–48 hours.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
