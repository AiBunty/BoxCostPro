import { SignIn } from "@clerk/clerk-react";

export default function AuthClerkPage() {
  // Get the redirect URL from query params
  const params = new URLSearchParams(window.location.search);
  const redirectTo = params.get("next") || "/dashboard";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 via-white to-blue-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-900 p-4">
      <div className="w-full max-w-md">
        <div className="mb-4 text-sm text-muted-foreground text-center">
          <a href="/" className="hover:underline">← Back to Home</a>
        </div>
        <SignIn
          routing="path"
          path="/auth"
          signUpUrl="/auth/sign-up"
          afterSignInUrl={redirectTo}
          appearance={{
            elements: {
              rootBox: "mx-auto",
              card: "shadow-2xl border border-slate-200/80",
            },
          }}
        />
      </div>
    </div>
  );
}
