/**
 * AdminApp Component
 * Root component for the Admin Panel
 * 
 * Wrapped in:
 * - AdminErrorBoundary (catches all render errors)
 * - ClerkProvider (authentication)
 * - QueryClientProvider (data fetching)
 * 
 * This is the single entry point for admin panel
 */

import { ClerkProvider } from '@clerk/clerk-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminErrorBoundary } from './AdminErrorBoundary';
import { AdminRouter } from './AdminRouter';

// React Query client - no caching for admin security
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: 0,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

// Get Clerk publishable key
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export function AdminApp() {
  // Missing Clerk key - show visible error
  if (!clerkPubKey) {
    return (
      <div className="min-h-screen bg-yellow-50 flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-yellow-900 mb-2">Configuration Error</h1>
          <p className="text-yellow-700">Missing VITE_CLERK_PUBLISHABLE_KEY environment variable.</p>
          <p className="text-yellow-600 text-sm mt-4">Please add this to your .env file.</p>
        </div>
      </div>
    );
  }

  return (
    <AdminErrorBoundary>
      <ClerkProvider publishableKey={clerkPubKey}>
        <QueryClientProvider client={queryClient}>
          <AdminRouter />
        </QueryClientProvider>
      </ClerkProvider>
    </AdminErrorBoundary>
  );
}

export default AdminApp;
