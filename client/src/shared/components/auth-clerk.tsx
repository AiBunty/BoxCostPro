import { SignIn, useClerk, useAuth } from "@clerk/clerk-react";
import { Shield, Lock } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * SECURE ADMIN LOGIN
 * 
 * For admin routes:
 * - Forces complete sign-out of any existing session
 * - Clears ALL Clerk cached tokens and session storage
 * - Requires fresh password entry every time
 * - No cached login bypass allowed
 */

// Clear all Clerk-related storage
function clearClerkCache() {
  // Clear sessionStorage
  Object.keys(sessionStorage).forEach(key => {
    if (key.startsWith('clerk') || key.startsWith('__clerk')) {
      sessionStorage.removeItem(key);
    }
  });
  
  // Clear localStorage Clerk keys
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('clerk') || key.startsWith('__clerk')) {
      localStorage.removeItem(key);
    }
  });
  
  // Clear admin session tracking
  sessionStorage.removeItem('admin_last_activity');
  sessionStorage.removeItem('admin_session_start');
}

export default function AuthClerkPage() {
  const { signOut } = useClerk();
  const { isSignedIn, isLoaded } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [cacheCleared, setCacheCleared] = useState(false);
  
  // Get the redirect URL from query params
  const params = new URLSearchParams(window.location.search);
  const queryRedirect = params.get("next");
  
  // Detect if this is an admin login attempt - check URL, pathname, and redirect
  const currentUrl = window.location.href;
  const currentPath = window.location.pathname;
  const isAdminLogin = currentUrl.includes('/admin') || 
                       currentPath.includes('/admin') ||
                       (queryRedirect && queryRedirect.includes('/admin'));
  
  // Set correct redirect: admin login goes to /admin, user login goes to /dashboard
  const redirectTo = isAdminLogin ? "/admin" : (queryRedirect || "/dashboard");
  
  // Determine the auth path based on whether we're in admin context
  const authPath = isAdminLogin ? "/admin/auth" : "/auth";

  // SECURITY: For admin login, ALWAYS clear cache and force fresh login
  useEffect(() => {
    if (isAdminLogin && !cacheCleared) {
      // Clear ALL Clerk cache first
      clearClerkCache();
      setCacheCleared(true);
    }
  }, [isAdminLogin, cacheCleared]);

  // SECURITY: For admin login, force sign out any existing session AFTER cache is cleared
  useEffect(() => {
    if (isAdminLogin && isLoaded && isSignedIn && cacheCleared && !isSigningOut) {
      setIsSigningOut(true);
      // Sign out with explicit redirect back to admin auth
      signOut({ redirectUrl: '/admin/auth' }).catch(() => {
        // If signOut fails, force reload
        window.location.href = '/admin/auth';
      });
    }
  }, [isAdminLogin, isLoaded, isSignedIn, cacheCleared, isSigningOut, signOut]);

  // Show loading while Clerk initializes, signing out, or clearing cache
  if (!isLoaded || isSigningOut || (isAdminLogin && !cacheCleared)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 via-white to-blue-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-900 p-4">
        <div className="text-center">
          {isAdminLogin && (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg shadow-lg mb-4">
              <Shield className="w-5 h-5" />
              <span className="font-semibold text-lg">Admin Console</span>
            </div>
          )}
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto mt-4"></div>
          <p className="text-sm text-gray-500 mt-2">
            {isSigningOut ? "Securing session..." : "Loading..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 via-white to-blue-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-900 p-4">
      <div className="w-full max-w-md">
        {/* Admin Console Header - Always shown for admin routes */}
        {isAdminLogin ? (
          <div className="mb-6 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg shadow-lg">
              <Shield className="w-5 h-5" />
              <span className="font-semibold text-lg">Admin Console</span>
            </div>
            <p className="mt-2 text-sm text-gray-500">Administrative access only</p>
            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs">
              <Lock className="w-3 h-3" />
              <span>Secure login required every session</span>
            </div>
          </div>
        ) : (
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome Back</h1>
            <p className="text-sm text-gray-500">Sign in to your account</p>
          </div>
        )}
        
        <div className="mb-4 text-sm text-muted-foreground text-center">
          <a href="/" className="hover:underline">← Back to Home</a>
        </div>
        <SignIn
          routing="path"
          path={authPath}
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
