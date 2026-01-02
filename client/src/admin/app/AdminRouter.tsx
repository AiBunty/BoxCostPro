/**
 * AdminRouter Component - Enterprise Routing
 * Explicit routing for admin panel with all 9 pages
 * 
 * CRITICAL RULES:
 * - NO catch-all routes
 * - EVERY route renders a specific page
 * - Login route is separate (no layout)
 */

import { Switch, Route, Redirect } from 'wouter';
import { useAuth } from '@clerk/clerk-react';
import { AdminLayout } from './AdminLayout';

// Import all pages
import Login from '../pages/Login';
import Dashboard from '../pages/Dashboard';
import Approvals from '../pages/Approvals';
import Users from '../pages/Users';
import Billing from '../pages/Billing';
import Invoices from '../pages/Invoices';
import Coupons from '../pages/Coupons';
import Email from '../pages/Email';
import Support from '../pages/Support';
import AuditLogs from '../pages/AuditLogs';
import Settings from '../pages/Settings';

/**
 * Protected routes wrapper
 * Redirects to login if not authenticated
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }
  
  if (!isSignedIn) {
    return <Redirect to="/admin/login" />;
  }
  
  return <>{children}</>;
}

/**
 * 404 Not Found component
 */
function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-20" data-testid="not-found-page">
      <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
        <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2" data-testid="page-title">Page Not Found</h1>
      <p className="text-gray-600 mb-6">The admin page you're looking for doesn't exist.</p>
      <a 
        href="/admin" 
        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        Go to Dashboard
      </a>
    </div>
  );
}

export function AdminRouter() {
  return (
    <Switch>
      {/* LOGIN ROUTE - No layout wrapper */}
      <Route path="/admin/login">
        <Login />
      </Route>

      {/* PROTECTED ROUTES - With AdminLayout */}
      
      {/* Dashboard */}
      <Route path="/admin">
        <ProtectedRoute>
          <AdminLayout>
            <Dashboard />
          </AdminLayout>
        </ProtectedRoute>
      </Route>

      {/* Approvals - NEW USER APPROVAL WORKFLOW */}
      <Route path="/admin/approvals">
        <ProtectedRoute>
          <AdminLayout>
            <Approvals />
          </AdminLayout>
        </ProtectedRoute>
      </Route>

      {/* Users */}
      <Route path="/admin/users">
        <ProtectedRoute>
          <AdminLayout>
            <Users />
          </AdminLayout>
        </ProtectedRoute>
      </Route>

      {/* Billing */}
      <Route path="/admin/billing">
        <ProtectedRoute>
          <AdminLayout>
            <Billing />
          </AdminLayout>
        </ProtectedRoute>
      </Route>

      {/* Invoices */}
      <Route path="/admin/invoices">
        <ProtectedRoute>
          <AdminLayout>
            <Invoices />
          </AdminLayout>
        </ProtectedRoute>
      </Route>

      {/* Coupons */}
      <Route path="/admin/coupons">
        <ProtectedRoute>
          <AdminLayout>
            <Coupons />
          </AdminLayout>
        </ProtectedRoute>
      </Route>

      {/* Email */}
      <Route path="/admin/email">
        <ProtectedRoute>
          <AdminLayout>
            <Email />
          </AdminLayout>
        </ProtectedRoute>
      </Route>

      {/* Support */}
      <Route path="/admin/support">
        <ProtectedRoute>
          <AdminLayout>
            <Support />
          </AdminLayout>
        </ProtectedRoute>
      </Route>

      {/* Audit Logs */}
      <Route path="/admin/audit-logs">
        <ProtectedRoute>
          <AdminLayout>
            <AuditLogs />
          </AdminLayout>
        </ProtectedRoute>
      </Route>

      {/* Settings */}
      <Route path="/admin/settings">
        <ProtectedRoute>
          <AdminLayout>
            <Settings />
          </AdminLayout>
        </ProtectedRoute>
      </Route>

      {/* 404 */}
      <Route>
        <ProtectedRoute>
          <AdminLayout>
            <NotFound />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
    </Switch>
  );
}

export default AdminRouter;
