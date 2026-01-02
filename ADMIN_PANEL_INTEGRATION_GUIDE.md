# Admin Panel Integration Guide

## Quick Start - Adding Admin Routes to App.tsx

### Step 1: Import Routes Configuration

```typescript
// client/src/App.tsx
import { adminRoutes } from "@/config/admin-routes";
import AdminDashboard from "@/pages/admin-dashboard";
import AdminStaffManagement from "@/pages/admin-staff";
import AdminTickets from "@/pages/admin-tickets";
import AdminCoupons from "@/pages/admin-coupons";
import AdminAnalytics from "@/pages/admin-analytics";
import AdminAuditLogs from "@/pages/admin-audit-logs";
import AdminBusinessProfile from "@/pages/admin-business-profile";
import AdminPayments from "@/pages/admin-payments";
import AdminInvoices from "@/pages/admin-invoices";
import AdminReports from "@/pages/admin-reports";
import AdminSettings from "@/pages/admin-settings";
```

### Step 2: Create Admin Route Wrapper

```typescript
// client/src/components/admin-route-wrapper.tsx
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { ReactNode } from "react";

interface AdminRouteProps {
  requiredRoles: string[];
  children: ReactNode;
}

export function AdminRoute({ requiredRoles, children }: AdminRouteProps) {
  const { isAdmin, role, isLoading } = useAdminAuth();

  if (isLoading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-gray-600 mt-2">
          You don't have permission to access this page
        </p>
      </div>
    );
  }

  if (!requiredRoles.includes(role || "")) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold">Insufficient Permissions</h1>
        <p className="text-gray-600 mt-2">
          Your role ({role}) doesn't have access to this page
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
```

### Step 3: Add Routes to App.tsx

```typescript
// client/src/App.tsx
import { Router, Route } from "wouter";
import { AdminRoute } from "@/components/admin-route-wrapper";

export default function App() {
  return (
    <Router>
      {/* Existing routes */}

      {/* Admin Routes */}
      <Route path="/admin">
        <AdminRoute requiredRoles={["SUPER_ADMIN", "SUPPORT_STAFF", "MARKETING_STAFF", "FINANCE_ADMIN"]}>
          <AdminDashboard />
        </AdminRoute>
      </Route>

      <Route path="/admin/staff">
        <AdminRoute requiredRoles={["SUPER_ADMIN"]}>
          <AdminStaffManagement />
        </AdminRoute>
      </Route>

      <Route path="/admin/tickets">
        <AdminRoute requiredRoles={["SUPER_ADMIN", "SUPPORT_STAFF"]}>
          <AdminTickets />
        </AdminRoute>
      </Route>

      <Route path="/admin/coupons">
        <AdminRoute requiredRoles={["SUPER_ADMIN", "MARKETING_STAFF"]}>
          <AdminCoupons />
        </AdminRoute>
      </Route>

      <Route path="/admin/analytics">
        <AdminRoute requiredRoles={["SUPER_ADMIN", "SUPPORT_STAFF", "MARKETING_STAFF", "FINANCE_ADMIN"]}>
          <AdminAnalytics />
        </AdminRoute>
      </Route>

      <Route path="/admin/audit-logs">
        <AdminRoute requiredRoles={["SUPER_ADMIN", "FINANCE_ADMIN"]}>
          <AdminAuditLogs />
        </AdminRoute>
      </Route>

      <Route path="/admin/business-profile">
        <AdminRoute requiredRoles={["SUPER_ADMIN", "SUPPORT_STAFF", "MARKETING_STAFF", "FINANCE_ADMIN"]}>
          <AdminBusinessProfile />
        </AdminRoute>
      </Route>

      <Route path="/admin/payments">
        <AdminRoute requiredRoles={["SUPER_ADMIN", "FINANCE_ADMIN"]}>
          <AdminPayments />
        </AdminRoute>
      </Route>

      <Route path="/admin/invoices">
        <AdminRoute requiredRoles={["SUPER_ADMIN", "FINANCE_ADMIN"]}>
          <AdminInvoices />
        </AdminRoute>
      </Route>

      <Route path="/admin/reports">
        <AdminRoute requiredRoles={["SUPER_ADMIN", "SUPPORT_STAFF", "MARKETING_STAFF", "FINANCE_ADMIN"]}>
          <AdminReports />
        </AdminRoute>
      </Route>

      <Route path="/admin/settings">
        <AdminRoute requiredRoles={["SUPER_ADMIN"]}>
          <AdminSettings />
        </AdminRoute>
      </Route>

      {/* Rest of your routes */}
    </Router>
  );
}
```

## Building an Admin Sidebar

### Example Sidebar Component

```typescript
// client/src/components/admin-sidebar.tsx
import { adminNavigation } from "@/config/admin-routes";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

export function AdminSidebar() {
  const { hasPermission } = useAdminAuth();
  const currentPath = window.location.pathname;

  return (
    <aside className="w-64 bg-gray-900 text-white min-h-screen p-4">
      <div className="mb-8">
        <h2 className="text-xl font-bold">Admin Panel</h2>
        <p className="text-gray-400 text-sm">BoxCostPro</p>
      </div>

      <nav className="space-y-8">
        {adminNavigation.map((section) => (
          <div key={section.label}>
            <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">
              {section.label}
            </h3>
            <div className="space-y-2">
              {section.items.map((item) => {
                // Check if user has permission
                if (item.requiredPermission && !hasPermission(item.requiredPermission)) {
                  return null;
                }

                const isActive = currentPath === item.href;

                return (
                  <Link key={item.href} href={item.href}>
                    <a
                      className={cn(
                        "block px-3 py-2 rounded-md text-sm transition-colors",
                        isActive
                          ? "bg-blue-600 text-white"
                          : "text-gray-300 hover:bg-gray-800"
                      )}
                    >
                      {item.label}
                    </a>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Logout button */}
      <div className="mt-8 pt-8 border-t border-gray-700">
        <button className="w-full px-3 py-2 text-sm text-left text-gray-300 hover:bg-gray-800 rounded-md transition-colors">
          Logout
        </button>
      </div>
    </aside>
  );
}
```

## Checking Permissions in Components

### Pattern 1: Guard Entire Component

```typescript
function MyComponent() {
  const { canManageCoupons, isLoading } = useAdminAuth();

  if (isLoading) return <LoadingSpinner />;
  if (!canManageCoupons()) {
    return <PermissionDenied action="manage coupons" />;
  }

  return <CouponManagement />;
}
```

### Pattern 2: Conditionally Render Elements

```typescript
function CouponList() {
  const { hasPermission } = useAdminAuth();

  return (
    <div>
      <PermissionGuard action="create_coupon">
        <CreateCouponButton />
      </PermissionGuard>

      <PermissionGuard action="list_coupons">
        <CouponTable />
      </PermissionGuard>
    </div>
  );
}
```

### Pattern 3: Disable Controls

```typescript
function CouponForm() {
  const { hasPermission } = useAdminAuth();

  return (
    <form>
      <input type="text" placeholder="Code" />
      <PermissionButton
        action="create_coupon"
        onClick={handleCreate}
        className="w-full"
      >
        Create Coupon
      </PermissionButton>
    </form>
  );
}
```

## Testing Admin Features

### Run Admin Tests

```bash
# Run all admin tests
npm test -- admin

# Run specific test file
npm test -- permissions.test.ts

# Watch mode
npm test -- admin --watch

# Coverage report
npm test -- admin --coverage
```

## Environment Setup

### Backend Requirements

1. **Database Migration**
   ```bash
   # Run migration to create admin tables
   npm run db:migrate
   ```

2. **Environment Variables**
   ```env
   DATABASE_URL=postgresql://...
   AUTH_PROVIDER=clerk|neon|supabase|session
   ```

3. **Create Admin Account**
   ```bash
   npm run create-admin -- \
     --email=admin@example.com \
     --role=SUPER_ADMIN
   ```

## Troubleshooting

### Issue: Admin pages not loading

**Check:**
1. Are admin routes registered in App.tsx?
2. Is the backend `/api/admin/me` endpoint working?
3. Check browser console for errors

### Issue: Permission denied on valid action

**Check:**
1. Verify user's role: `console.log(adminUser.role)`
2. Check permission matrix matches backend
3. Verify API returns correct role

### Issue: Audit logs not showing

**Check:**
1. Is `canViewAuditLogs()` true for your role?
2. Are there audit logs in the database?
3. Check network tab for API errors

## Performance Tips

1. **Lazy Load Pages**
   ```typescript
   const AdminDashboard = lazy(() => import("@/pages/admin-dashboard"));
   ```

2. **Memoize Permission Checks**
   ```typescript
   const canDelete = useMemo(
     () => hasPermission("disable_staff"),
     [hasPermission]
   );
   ```

3. **Cache Analytics Data**
   ```typescript
   useQuery({
     queryKey: ["/api/admin/analytics/dashboard"],
     staleTime: 5 * 60 * 1000, // 5 minutes
   });
   ```

## Security Checklist

- [ ] Admin routes require authentication
- [ ] Role validation happens server-side
- [ ] All API calls include permission checks
- [ ] Sensitive data not logged in browser console
- [ ] Session timeout configured
- [ ] HTTPS enforced in production
- [ ] Rate limiting enabled on admin endpoints
- [ ] Audit logs retained per policy

## Additional Resources

- [Architecture Overview](./ADMIN_PANEL_ARCHITECTURE.md)
- [API Documentation](./ADMIN_API_QUICK_START.md)
- [UI Implementation Guide](./ADMIN_UI_IMPLEMENTATION_GUIDE.md)
- [Implementation Status](./ADMIN_PANEL_IMPLEMENTATION_STATUS.md)

---

**Last Updated:** December 30, 2025
**Status:** Production Ready ✅
