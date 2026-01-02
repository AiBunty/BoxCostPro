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
  // Use Clerk auth system
  if (getClerkToken) {
    try {
      const token = await getClerkToken();
      return token;
    } catch (error) {
      console.warn('[Auth] Clerk token retrieval failed:', error);
      return null;
    }
  }

  // No token available
  return null;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
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
