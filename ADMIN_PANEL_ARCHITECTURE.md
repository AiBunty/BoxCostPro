# Admin Panel Architecture Overview

## System Design

```
┌─────────────────────────────────────────────────────────────────┐
│                       React Admin Frontend                      │
│              (UI Pages, Forms, Charts, Reports)                │
└────────────────────────┬────────────────────────────────────────┘
                         │
                    HTTP + JSON
                         │
         ┌───────────────┼───────────────┐
         │               │               │
┌────────▼────────┐  ┌──▼────────┐ ┌───▼──────────┐
│  Authentication  │  │  Routes   │ │ Error Handler│
│   Middleware     │  │           │ │   Logging    │
└──────────────────┘  └──┬────────┘ └──────────────┘
                        │
         ┌──────────────┴──────────────┐
         │                             │
    ┌────▼────────┐          ┌────────▼──────┐
    │ RBAC Check  │          │  Zod Validate │
    │ Permission  │          │   Input Data  │
    │  Middleware │          └────────┬───────┘
    └────┬────────┘                   │
         │              ┌─────────────┘
         │              │
     ┌───▼──────────────▼────┐
     │   Business Logic      │
     │  (Services Layer)     │
     ├──────────────────────┤
     │ • ticketService      │
     │ • analyticsService   │
     │ • adminAuditService  │
     └───┬──────────────────┘
         │
    ┌────▼─────────────────┐
    │  Data Access Layer    │
    │  (Storage.ts)         │
    │  DatabaseStorage      │
    └────┬─────────────────┘
         │
    ┌────▼─────────────────┐
    │   Database Queries    │
    │   (Drizzle ORM)       │
    └────┬─────────────────┘
         │
    ┌────▼─────────────────┐
    │   PostgreSQL DB       │
    │   • staff             │
    │   • ticket_notes      │
    │   • staff_metrics     │
    │   • admin_audit_logs  │
    └──────────────────────┘
```

## Request Flow

1. **Client Request**
   - POST /admin/staff with { userId, role }
   - Headers: Authorization: Bearer <token>

2. **Authentication**
   - `combinedAuth` middleware validates token (Clerk, Neon, JWT, or Session)
   - Extracts userId and attaches to req

3. **Admin Verification**
   - `verifyAdminAuth` middleware checks if user is active staff member
   - Queries `staff` table for user's role and status
   - Attaches `req.staffId`, `req.staffRole`, `req.staff` to request

4. **Permission Check**
   - `enforcePermission('create_staff')` middleware checks permission matrix
   - Looks up role in `PERMISSION_MATRIX` object
   - If denied: logs to audit trail and returns 403 Forbidden

5. **Input Validation**
   - Zod schema validates request body structure and types
   - Returns 400 Bad Request if validation fails

6. **Business Logic**
   - Service layer (e.g., adminAuditService) executes operation
   - Handles calculations, state transitions, metric updates
   - Calls storage layer for database operations

7. **Data Access**
   - Storage class queries database via Drizzle ORM
   - Handles SQL generation, type safety, relationships

8. **Audit Logging**
   - Operation success/failure logged to `admin_audit_logs`
   - Captures: before-state, after-state, actor info, IP address
   - Fire-and-forget async (non-blocking)

9. **Response**
   - Return 201 Created with resource data
   - Client receives result and updates UI

## File Organization

```
server/
├── middleware/
│   └── adminRbac.ts              # Permission matrix and auth enforcement
├── services/
│   ├── adminAuditService.ts       # Audit logging
│   ├── ticketService.ts           # Ticket workflow + SLA
│   └── analyticsService.ts        # Metrics aggregation + CSV export
├── routes/
│   └── adminRoutes.ts             # 19 API endpoints
├── storage.ts                     # Data access abstraction
└── routes.ts                      # Main routes file

shared/
└── schema.ts                      # Drizzle ORM schema + Zod types
```

## Data Models

### Staff Table
```typescript
{
  id: string (PK, UUID)
  userId: string (FK to users)
  role: 'SUPER_ADMIN' | 'SUPPORT_STAFF' | 'MARKETING_STAFF' | 'FINANCE_ADMIN'
  status: 'active' | 'disabled'
  joinedAt: timestamp (auto)
  disabledAt: timestamp (nullable)
  disabledBy: string (FK to staff, nullable)
  createdAt: timestamp (auto)
  updatedAt: timestamp (auto)
}
```

### Staff Metrics Table
```typescript
{
  staffId: string (PK FK)
  ticketsAssigned: number (nullable)
  ticketsResolved: number (nullable)
  avgResolutionTime: number (nullable, hours)
  totalActionCount: number (nullable)
  couponsCreated: number (nullable)
  couponRedemptionRate: number (nullable, %)
  lastUpdated: timestamp (nullable)
  createdAt: timestamp (auto)
  updatedAt: timestamp (auto)
}
```

### Admin Audit Log Table
```typescript
{
  id: string (PK, UUID)
  actorStaffId: string (FK to staff, nullable)
  actorRole: 'SUPER_ADMIN' | ... (nullable)
  action: string (e.g., 'create_coupon', 'resolve_ticket')
  entityType: string (e.g., 'coupon', 'ticket', 'staff')
  entityId: string (nullable, the resource affected)
  beforeState: JSON (snapshot before change)
  afterState: JSON (snapshot after change)
  ipAddress: string (nullable)
  userAgent: string (nullable)
  status: 'success' | 'failed'
  failureReason: string (nullable)
  createdAt: timestamp (auto)
}
```

### Ticket Notes Table
```typescript
{
  id: string (PK, UUID)
  ticketId: string (FK to supportTickets)
  staffId: string (FK to staff)
  content: string
  createdAt: timestamp (auto)
}
```

## Permission Matrix Structure

```typescript
const PERMISSION_MATRIX: Record<AdminRole, Set<string>> = {
  SUPER_ADMIN: new Set([
    // Staff management
    'create_staff',
    'list_staff',
    'disable_staff',
    // Tickets
    'create_ticket',
    'list_tickets',
    'view_all_tickets',
    'assign_ticket',
    'resolve_ticket',
    'add_ticket_note',
    // Coupons (unlimited)
    'create_coupon',
    'list_coupons',
    'assign_coupon_to_user',
    // Analytics
    'view_staff_analytics',
    'view_ticket_analytics',
    'view_revenue_analytics',
    'view_audit_logs',
    'export_analytics',
    'export_audit_logs',
    // ... more actions
  ]),
  
  SUPPORT_STAFF: new Set([
    'create_ticket',
    'list_tickets',
    'view_all_tickets',
    'assign_ticket',
    'resolve_ticket',
    'add_ticket_note',
  ]),
  
  MARKETING_STAFF: new Set([
    'create_coupon',     // With limits: 30% max, 100 uses, 90 days
    'list_coupons',
    'assign_coupon_to_user',
    'view_staff_analytics', // Own metrics only
  ]),
  
  FINANCE_ADMIN: new Set([
    'view_staff_analytics',  // Limited access
    'view_revenue_analytics',
    'view_ticket_analytics',
    // ... payment/invoice operations
  ]),
}
```

## Audit Log Structure

Every admin action creates an immutable audit log entry:

```typescript
{
  // Who did it
  actorStaffId: 'staff-123',
  actorRole: 'SUPER_ADMIN',
  
  // What they did
  action: 'create_coupon',           // The operation type
  entityType: 'coupon',              // What was affected
  entityId: 'coupon-456',            // Which resource
  
  // Before and after snapshots
  beforeState: {                     // State before operation
    // original coupon data or null if creating
  },
  afterState: {                      // State after operation
    id: 'coupon-456',
    code: 'SUMMER20',
    discountValue: 20,
    maxUses: 100,
    validUntil: '2024-12-31',
    isActive: true,
    // ... all fields
  },
  
  // Forensics
  ipAddress: '192.168.1.1',
  userAgent: 'Mozilla/5.0...',
  
  // Outcome
  status: 'success',
  failureReason: null,
  createdAt: '2024-03-15T10:30:45Z',
}
```

## SLA Tracking

```typescript
interface SLAStatus {
  slaHours: number           // Target resolution time
  remainingHours: number     // Time left before breach
  isBreach: boolean          // True if deadline passed
  status: 'on_track' | 'at_risk' | 'breached'
}

// Priority → Target Hours
URGENT:  4 hours
HIGH:    12 hours
MEDIUM:  24 hours
LOW:     48 hours
```

## Analytics Aggregation

### Real-Time Calculations
- **Staff metrics**: Queries denormalized `staff_metrics` table
- **Ticket stats**: Aggregates from `support_tickets` table
- **Coupon stats**: Aggregates from `coupons` table
- **Revenue**: Aggregates from `subscriptions` and `invoices`

### Metric Updates
- `ticketsAssigned`: +1 when ticket assigned
- `ticketsResolved`: +1 when ticket resolved
- `avgResolutionTime`: Recalculated as rolling average on resolution
- `totalActionCount`: +1 for major actions
- `couponsCreated`: +1 when coupon created
- `couponRedemptionRate`: Percentage of created coupons that were used

## Error Handling Strategy

```typescript
// Operation fails
try {
  await operationThatMightFail();
} catch (error) {
  // 1. Log to audit trail with failure reason
  await logAuditError(staffId, role, action, entityType, entityId, error);
  
  // 2. Return structured error response
  res.status(500).json({
    message: "Operation failed",
    error: error.message
  });
  
  // 3. Never expose internal details to client
  // 4. Log full error to server logs for debugging
}
```

## Performance Optimization

### Indexes
```sql
-- staff table
CREATE INDEX idx_staff_user ON staff(user_id);
CREATE INDEX idx_staff_role ON staff(role);
CREATE INDEX idx_staff_status ON staff(status);

-- admin_audit_logs table
CREATE INDEX idx_audit_actor ON admin_audit_logs(actor_staff_id);
CREATE INDEX idx_audit_action ON admin_audit_logs(action);
CREATE INDEX idx_audit_entity ON admin_audit_logs(entity_type);
CREATE INDEX idx_audit_date ON admin_audit_logs(created_at);
CREATE INDEX idx_audit_role ON admin_audit_logs(actor_role);

-- ticket_notes table
CREATE INDEX idx_notes_ticket ON ticket_notes(ticket_id);
CREATE INDEX idx_notes_staff ON ticket_notes(staff_id);
```

### Caching Strategy
- **Staff roles**: Cache in request (verified once per request)
- **Metrics**: Denormalized in `staff_metrics` table (updated on action)
- **Analytics**: Aggregated on-demand from denormalized data
- **Audit logs**: Stream for export (no memory overhead)

## Testing Considerations

### Unit Tests
- Permission matrix validation
- SLA calculation edge cases
- Metric averaging calculations
- CSV formatting

### Integration Tests
- End-to-end permission enforcement
- Audit log creation and retrieval
- Ticket lifecycle transitions
- Analytics aggregation accuracy

### Security Tests
- Unauthorized access attempts
- Permission bypass attempts
- Audit log integrity
- SQL injection attempts (Drizzle handles this)

## Future Enhancements

1. **Real-time notifications** for ticket assignments
2. **Batch operations** for bulk staff/coupon management
3. **Advanced search** with full-text search on audit logs
4. **Webhooks** for external integrations
5. **API key authentication** for third-party tools
6. **Role templates** for quick staff onboarding
7. **Permission delegation** (admins delegating to sub-admins)
8. **Activity feed** showing recent admin actions in dashboard
9. **Custom SLA rules** per business type
10. **Automated ticket routing** based on priority/category

## Deployment Notes

1. **Database migrations** must run before deployment
2. **Environment variables** needed:
   - Database connection string
   - Auth provider keys (Clerk, Neon, etc.)
   - Payment gateway keys (for revenue calculations)

3. **Startup checklist**:
   - Verify database tables exist (run migrations)
   - Create initial SUPER_ADMIN staff account
   - Test permission enforcement with sample requests
   - Monitor audit logs for any unexpected denials

4. **Monitoring**:
   - Alert on failed permission attempts (possible attacks)
   - Track average SLA breach rate
   - Monitor query performance on audit log exports
   - Track staff metrics update frequency

## Related Documentation

- `ADMIN_PANEL_IMPLEMENTATION_STATUS.md` - Detailed implementation checklist
- `ADMIN_API_QUICK_START.md` - API endpoint reference
- `ENTERPRISE_AUTH_PLAN.md` - Auth architecture overview
