import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth as useClerkAuth } from "@clerk/clerk-react";

export interface AuthUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  role: string | null;
  companyName: string | null;
  mobileNo: string | null;
}

export function useAuth() {
  const queryClient = useQueryClient();
  const [isInitialized, setIsInitialized] = useState(false);
  const { signOut: clerkSignOut } = useClerkAuth();

  useEffect(() => {
    // Initialize immediately with Clerk
    setIsInitialized(true);
  }, [queryClient]);

  // Fetch user data from backend once Neon Auth session is ready
  const { data: user, isLoading: userLoading } = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/user"],
    retry: false,
    enabled: isInitialized,
  });

  const signOut = useCallback(async () => {
    console.log('[SignOut] Starting sign out process...');
    
    // Clear query cache first
    queryClient.clear();
    
    // Sign out from Clerk
    try {
      await clerkSignOut();
      console.log('[SignOut] Clerk signout completed');
    } catch (e) {
      console.error('[SignOut] Clerk signout error:', e);
    }

    // Clear backend session
    try {
      await apiRequest("POST", "/api/auth/logout", {});
      console.log('[SignOut] Backend logout completed');
    } catch (e) {
      console.error('[SignOut] Backend logout error:', e);
    }

    // Clear all auth-related cookies manually
    const cookies = ['neon-session', 'connect.sid', '__session', '__client'];
    cookies.forEach(name => {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    });
    
    console.log('[SignOut] Redirecting to auth page...');
    window.location.href = '/auth';
  }, [clerkSignOut, queryClient]);

  return {
    user,
    isLoading: !isInitialized || userLoading,
    isAuthenticated: !!user,
    signOut,
  };
}

// Legacy export for backward compatibility - redirects to auth page and clears cookies
// Components should prefer using the signOut from useAuth() hook instead
export async function signOut() {
  console.log('[SignOut] Legacy signOut called - clearing cookies and redirecting...');
  
  // Clear all auth-related cookies manually
  const cookies = ['neon-session', 'connect.sid', '__session', '__client'];
  cookies.forEach(name => {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  });
  
  // Clear backend session
  try {
    await apiRequest("POST", "/api/auth/logout", {});
  } catch (e) {
    // Ignore
  }

  // Redirect - this will trigger Clerk's signOut on page reload since there's no session
  window.location.href = '/auth?signedOut=true';
}
