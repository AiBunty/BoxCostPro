import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect } from "wouter";
import { ReactNode, useEffect } from "react";
import { useClerk } from "@clerk/clerk-react";

interface AdminRoleGuardProps {
  children: ReactNode;
}

const ADMIN_ROLES = ['admin', 'super_admin', 'support_manager', 'owner'];

// Session timeout for admin: 15 minutes of inactivity
const ADMIN_SESSION_TIMEOUT_MS = 15 * 60 * 1000;

export function AdminRoleGuard({ children }: AdminRoleGuardProps) {
  const { signOut } = useClerk();
  const queryClient = useQueryClient();
  
  const { data: user, isLoading, error, refetch } = useQuery<any>({
    queryKey: ["/api/auth/user"],
    // SECURITY: Always refetch on mount for admin, don't use stale data
    staleTime: 0,
    gcTime: 0, // Don't cache
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  // SECURITY: Check session validity on every admin page access
  useEffect(() => {
    const lastActivity = sessionStorage.getItem('admin_last_activity');
    const now = Date.now();
    
    if (lastActivity) {
      const elapsed = now - parseInt(lastActivity, 10);
      if (elapsed > ADMIN_SESSION_TIMEOUT_MS) {
        // Session expired - force re-authentication
        console.log('[AdminRoleGuard] Session expired, forcing re-auth');
        sessionStorage.removeItem('admin_last_activity');
        queryClient.clear();
        signOut();
        return;
      }
    }
    
    // Update last activity timestamp
    sessionStorage.setItem('admin_last_activity', now.toString());
  }, [signOut, queryClient]);

  // SECURITY: Re-validate session every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 60000);
    return () => clearInterval(interval);
  }, [refetch]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Verifying Admin Access
          </h2>
          <p className="text-gray-600">Please wait...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (error || !user) {
    return <Redirect to="/admin/auth?next=/admin" />;
  }

  // Not an admin
  if (!ADMIN_ROLES.includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-md mx-auto text-center p-8 bg-white rounded-2xl shadow-xl">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🚫</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            User Account Detected
          </h1>
          <p className="text-gray-600 mb-2">
            This is a <strong>user account</strong> and cannot access the Admin Panel.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Role: <span className="font-semibold text-blue-600">{user.role || 'user'}</span>
          </p>
          <div className="space-y-3">
            <a
              href="/"
              className="block w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Go to User Application
            </a>
            <button 
              onClick={() => window.location.href = '/admin/auth'}
              className="block w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Sign Out & Login as Admin
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Admin verified - render children
  return <>{children}</>;
}
