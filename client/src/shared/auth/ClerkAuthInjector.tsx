import { useAuth as useClerkAuth } from "@clerk/clerk-react";
import { useEffect, ReactNode } from "react";
import { setClerkTokenGetter } from "@/shared/lib/queryClient";

interface ClerkAuthInjectorProps {
  children: ReactNode;
}

/**
 * ClerkAuthInjector - Injects Clerk's getToken into queryClient
 * Must be inside ClerkProvider to access useAuth hook
 */
export function ClerkAuthInjector({ children }: ClerkAuthInjectorProps) {
  const { getToken } = useClerkAuth();

  useEffect(() => {
    // Inject Clerk token getter into queryClient
    setClerkTokenGetter(async () => {
      try {
        const token = await getToken();
        return token;
      } catch (error) {
        console.error('[Clerk] Failed to get token:', error);
        return null;
      }
    });
  }, [getToken]);

  return <>{children}</>;
}
