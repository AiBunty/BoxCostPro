/**
 * AdminLayout Component
 * Main layout wrapper for admin panel
 * 
 * CRITICAL: This component NEVER returns null
 * ALWAYS renders TopBar + Sidebar + children
 * Even on error, shows visible UI
 */

import { ReactNode, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { TopBar } from '../components/TopBar';
import { Sidebar } from '../components/Sidebar';

interface AdminLayoutProps {
  children: ReactNode;
}

// Session-based admin authentication hook
function useAdminAuth() {
  return useQuery({
    queryKey: ['/api/admin/auth/profile'],
    queryFn: async () => {
      const response = await fetch('/api/admin/auth/profile', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Not authenticated');
      return response.json();
    },
    retry: false,
  });
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { data: admin, isLoading, error } = useAdminAuth();
  const [, setLocation] = useLocation();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && (error || !admin)) {
      setLocation('/admin/login');
    }
  }, [isLoading, error, admin, setLocation]);

  // Console warning if content area is empty (for debugging)
  useEffect(() => {
    const timer = setTimeout(() => {
      const content = document.getElementById('admin-content');
      if (content && content.children.length === 0) {
        console.warn('[AdminLayout] WARNING: Content area is empty!');
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [children]);

  // LOADING STATE - shows visible loading UI
  if (isLoading) {
    return (
      <div 
        className="min-h-screen bg-gray-50 flex items-center justify-center"
        data-testid="admin-loading"
      >
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading Admin Panel...</p>
        </div>
      </div>
    );
  }

  // NOT AUTHENTICATED - shows redirect message (will redirect via useEffect)
  if (error || !admin) {
    return (
      <div 
        className="min-h-screen bg-gray-50 flex items-center justify-center"
        data-testid="admin-auth-redirect"
      >
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  // MAIN LAYOUT - ALWAYS renders TopBar + Sidebar + Content
  return (
    <div className="min-h-screen bg-gray-50" data-testid="admin-layout">
      {/* Dev sentinel banner - proves new UI is active */}
      <div className="bg-green-500 text-white text-center py-1 text-xs font-medium">
        ✅ NEW ADMIN UI v2.0 — Clean Rebuild Active
      </div>

      {/* Top bar - ALWAYS visible */}
      <TopBar />

      {/* Main content area with sidebar */}
      <div className="flex h-[calc(100vh-64px-24px)]">
        {/* Sidebar - ALWAYS visible */}
        <Sidebar />

        {/* Content - ALWAYS visible */}
        <main 
          id="admin-content"
          className="flex-1 overflow-auto p-6"
          data-testid="admin-content"
        >
          {children}
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;
