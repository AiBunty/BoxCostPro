import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Global token getter - will be set by App.tsx using Clerk's useAuth hook
let getClerkToken: (() => Promise<string | null>) | null = null;

/**
 * Set the Clerk token getter function
 * Called from App.tsx after ClerkProvider initializes
 */
export function setClerkTokenGetter(getter: () => Promise<string | null>) {
  getClerkToken = getter;
}

/**
 * Get authentication token for API requests
 * Uses Clerk authentication only
 */
async function getAuthToken(): Promise<string | null> {
  // Use Clerk for authentication
  if (getClerkToken) {
    try {
      const token = await getClerkToken();
      if (token) return token;
    } catch (error) {
      console.warn('[Auth] Clerk token retrieval failed:', error);
    }
  }

  return null;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    // Special handling for onboarding guard 403 responses
    if (res.status === 403) {
      try {
        const json = await res.json();
        if (json.code && ['ONBOARDING_INCOMPLETE', 'VERIFICATION_PENDING', 'VERIFICATION_REJECTED'].includes(json.code)) {
          const isRejected = json.code === 'VERIFICATION_REJECTED';
          const target = isRejected ? '/onboarding/rejected' : (json.redirect || '/onboarding');
          console.log('[Auth] Onboarding/verification required, redirecting to:', target);
          window.location.href = target;
          // Throw to prevent further processing
          throw new Error(`Onboarding required: ${json.message}`);
        }
        // If it's a 403 but not from onboarding guard, throw with the JSON message
        throw new Error(`403: ${json.message || JSON.stringify(json)}`);
      } catch (parseError) {
        // If JSON parsing fails, fall through to generic error
        if (parseError instanceof Error && parseError.message.startsWith('Onboarding required')) {
          throw parseError; // Re-throw onboarding errors
        }
        throw new Error(`403: ${res.statusText}`);
      }
    }
    
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {};
  
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const token = await getAuthToken();
    const headers: Record<string, string> = {};
    
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    
    const res = await fetch(queryKey.join("/") as string, {
      headers,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
