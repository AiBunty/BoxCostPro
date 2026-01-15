/**
 * AdminApp Component
 * Root component for the Admin Panel
 * 
 * Wrapped in:
 * - AdminErrorBoundary (catches all render errors)
 * - QueryClientProvider (data fetching)
 * 
 * This is the single entry point for admin panel
 */

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

export function AdminApp() {
  return (
    <AdminErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AdminRouter />
      </QueryClientProvider>
    </AdminErrorBoundary>
  );
}

export default AdminApp;
