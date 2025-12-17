import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase, onAuthStateChange } from "@/lib/supabase";

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

  useEffect(() => {
    const { data: { subscription } } = onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      } else if (event === 'SIGNED_OUT') {
        queryClient.setQueryData(["/api/auth/user"], null);
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      }
      setIsInitialized(true);
    });

    supabase.auth.getSession().then(() => {
      setIsInitialized(true);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [queryClient]);

  const { data: user, isLoading: userLoading } = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/user"],
    retry: false,
    enabled: isInitialized,
  });

  return {
    user,
    isLoading: !isInitialized || userLoading,
    isAuthenticated: !!user,
  };
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = '/';
}
