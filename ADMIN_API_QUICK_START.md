# Admin Panel Quick Start Guide

## What's Implemented

The enterprise admin panel backend is **fully implemented** with:

### ✅ Complete Backend Infrastructure
- **5 new database tables** with Drizzle ORM schema
- **Role-based access control (RBAC)** with 4-tier hierarchy
- **19 REST API endpoints** for admin operations
- **Immutable audit logging** for all admin actions
- **Support ticket workflow** with SLA tracking
- **Real-time analytics engine** with CSV export
- **Server-side permission enforcement** (zero client-side trust)

### 📊 Admin Features
1. **Staff Management**: Create/list/disable admin staff with role assignment
2. **Support Tickets**: Full lifecycle management with SLA tracking
3. **Coupon Management**: Create coupons with role-based usage limits
4. **Analytics Dashboard**: Real-time metrics for staff, tickets, coupons, revenue
5. **Audit Trail**: Complete activity log with before/after snapshots
6. **CSV Export**: Download any analytics data as CSV

## How to Use the Admin API

### Authentication
All endpoints require authentication via `combinedAuth` middleware. Include Bearer token in Authorization header:
```bash
Authorization: Bearer <clerk_or_neon_or_jwt_token>
```

### Staff Management

#### Create Staff Member (SUPER_ADMIN only)
```bash
POST /admin/staff
{
  "userId": "user-123",
  "role": "SUPPORT_STAFF" | "MARKETING_STAFF" | "FINANCE_ADMIN"
}
Response: { id, userId, role, status, joinedAt }
```

#### List All Staff
```bash
GET /admin/staff
Response: [{ id, userId, role, status, joinedAt, user: {...}, metrics: {...} }]
```

#### Disable Staff Member
```bash
PATCH /admin/staff/{id}/disable
Response: { id, status: "disabled", disabledAt, disabledBy }
```

### Support Tickets

#### Create Ticket
```bash
POST /admin/tickets
{
  "subject": "Login issue",
  "description": "User cannot login",
  "priority": "HIGH" | "MEDIUM" | "LOW"
}
Response: { id, ticketNo, userId, subject, priority, status: "OPEN" }
```

#### List Tickets
```bash
GET /admin/tickets
Response: [{ id, ticketNo, subject, priority, status, assignedTo, createdAt, slaStatus: {...} }]
```

#### Get Ticket Details
```bash
GET /admin/tickets/{id}
Response: { ...ticket, notes: [...], assignedStaff: {...}, slaStatus: {...} }
```

#### Assign Ticket to Staff
```bash
PATCH /admin/tickets/{id}/assign
{
  "staffId": "staff-456"
}
Response: { id, assignedTo, status: "IN_PROGRESS" }
```

#### Resolve Ticket
```bash
PATCH /admin/tickets/{id}/resolve
{
  "resolutionNote": "Fixed the issue"
}
Response: { id, status: "CLOSED", resolutionNote, closedAt }
```

#### Add Internal Note
```bash
POST /admin/tickets/{id}/notes
{
  "content": "Customer mentioned they updated their browser"
}
Response: { id, ticketId, staffId, content, createdAt }
```

### Coupons

#### Create Coupon (with role-based limits)
```bash
POST /admin/coupons
{
  "code": "SUMMER20",
  "discountPercent": 20,        // 1-30% for MARKETING_STAFF, 1-100% for SUPER_ADMIN
  "usageLimit": 100,             // Max 100 for MARKETING_STAFF
  "expiryDate": "2024-12-31"
}
Response: { id, code, discountValue, maxUses, validUntil, isActive }
```

#### List Coupons
```bash
GET /admin/coupons
Response: [{ id, code, discountValue, maxUses, usedCount, validUntil }]
```

#### Assign Coupon to User
```bash
POST /admin/coupons/{id}/assign
{
  "userId": "user-789"
}
Response: { success: true }
```

### Analytics

#### Dashboard Summary
```bash
GET /admin/analytics/dashboard
Response: {
  staff: { totalActiveStaff, avgTicketsResolved, avgResolutionTime },
  tickets: { open, resolved, sla_breaches, avg_resolution_time },
  coupons: { total, active, redemptions },
  revenue: { totalRevenue, activeSubscriptions, MRR }
}
```

#### Staff Analytics
```bash
GET /admin/analytics/staff
Response: [{
  staffId,
  ticketsAssigned,
  ticketsResolved,
  resolutionRate,
  avgResolutionTime,
  couponsCreated,
  couponRedemptionRate,
  lastUpdated
}]
```

#### Detailed Staff Analytics
```bash
GET /admin/analytics/staff/{id}
Response: {
  staffId,
  ticketsMetrics: { assigned, resolved, avgResolutionHours, resolutionRate },
  couponsMetrics: { created, redemptionRate },
  generalMetrics: { totalActions, lastUpdated },
  activityTimeline: [{ action, entityType, createdAt }, ...]
}
```

#### Ticket Analytics
```bash
GET /admin/analytics/tickets
Response: {
  totalTickets,
  openTickets,
  resolvedTickets,
  slaBreach,
  avgResolutionTime,
  priorityBreakdown: { URGENT, HIGH, MEDIUM, LOW }
}
```

#### Revenue Analytics
```bash
GET /admin/analytics/revenue
Response: {
  totalRevenue,
  activeSubscriptions,
  pendingPayments,
  mrr,
  mrg
}
```

### CSV Exports

#### Export Audit Logs
```bash
GET /admin/audit-logs/export?role=SUPER_ADMIN&startDate=2024-01-01
Response: CSV file with headers
actor_id,actor_role,action,entity_type,entity_id,status,timestamp
```

#### Export Staff Analytics
```bash
GET /admin/analytics/export/staff
Response: CSV file with all staff metrics
```

### Audit Logs

#### Query Audit Logs
```bash
GET /admin/audit-logs?staffId=s123&action=create_coupon&limit=50&offset=0
Response: [{
  id,
  actorStaffId,
  actorRole,
  action,
  entityType,
  entityId,
  beforeState,     // JSONB snapshot before change
  afterState,      // JSONB snapshot after change
  ipAddress,
  userAgent,
  status,          // "success" or "failed"
  failureReason,
  createdAt
}]
```

## Role-Based Permission Matrix

### SUPER_ADMIN
- Full system access
- Can manage staff (create, list, disable)
- Can create/edit/delete any coupon (no limits)
- Can view all analytics
- Can view audit logs
- Can configure gateways

### SUPPORT_STAFF
- Can create, assign, and resolve tickets
- Can add internal notes to tickets
- Can view own performance metrics
- **Cannot**: Create staff, manage coupons, view other staff data

### MARKETING_STAFF
- Can create coupons (max 30% discount, 100 uses, 90 days)
- Can assign coupons to users
- Can view own metrics and coupon redemptions
- **Cannot**: Create staff, manage tickets, manage payments

### FINANCE_ADMIN
- Can view revenue analytics
- Can manage payments and invoices
- Can view GST calculations
- Can view limited ticket data (for billing context)
- **Cannot**: Create staff, modify operations

## SLA Configuration

Ticket resolution targets:
- **URGENT**: 4 hours
- **HIGH**: 12 hours
- **MEDIUM**: 24 hours
- **LOW**: 48 hours

All tickets show remaining time and breach status in SLA field.

## Database Tables

### staff
Staff member accounts with roles and status
```sql
id (PK), userId (FK users), role, status, joinedAt, disabledAt, disabledBy
```

### ticket_notes
Internal notes staff add to tickets (not visible to users)
```sql
id (PK), ticketId (FK), staffId (FK), content, createdAt
```

### staff_metrics
Performance tracking for analytics
```sql
staffId (PK FK), ticketsAssigned, ticketsResolved, avgResolutionTime,
totalActionCount, couponsCreated, couponRedemptionRate, lastUpdated
```

### admin_audit_logs
Immutable audit trail of all admin actions
```sql
id (PK), actorStaffId (FK), actorRole, action, entityType, entityId,
beforeState (JSONB), afterState (JSONB), ipAddress, userAgent,
status, failureReason, createdAt
```

## Error Handling

All endpoints follow standard error response format:
```json
{
  "message": "Error description",
  "error": "Optional detailed error"
}
```

HTTP Status Codes:
- `201 Created`: Resource successfully created
- `400 Bad Request`: Invalid input or validation failed
- `401 Unauthorized`: Missing/invalid authentication
- `403 Forbidden`: Permission denied
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error (check logs)

Failed operations are logged to audit trail with failure reason.

## Performance Tips

1. **Use pagination**: Admin pages should paginate large result sets
2. **Cache metrics**: Dashboard calls getStaffAnalytics() which is fast
3. **Batch exports**: CSV export streams results (no memory overload)
4. **Audit logging**: Fire-and-forget async (doesn't block operations)

## Common Development Tasks

### Add New Permission
1. Edit `PERMISSION_MATRIX` in `/server/middleware/adminRbac.ts`
2. Add action string: `PERMISSION_MATRIX[role].add('new_action')`
3. Use in routes: `enforcePermission('new_action')`

### Add New Admin Action Type
1. Add to audit log template in `/server/services/adminAuditService.ts`
2. Call from your route handler: `await logMyActionCreated(...)`
3. Automatically captured: before/after snapshots, IP, user agent

### Add New Metric
1. Add field to `StaffMetrics` type in `schema.ts`
2. Update `createStaffMetrics()` and `updateStaffMetrics()` calls
3. Query in analytics: `getAllStaffMetrics()` returns your new field

## Debugging

### Check Audit Logs
```bash
# Get all actions by a staff member
GET /admin/audit-logs?staffId={staffId}

# Get all failed operations
GET /admin/audit-logs?status=failed

# Get specific action type
GET /admin/audit-logs?action=create_coupon
```

### View Staff Metrics
```bash
# Get detailed analytics for staff
GET /admin/analytics/staff/{staffId}
```

### Monitor SLA
```bash
# Get all tickets with SLA status
GET /admin/tickets
# Check slaStatus field for each ticket
```

## Production Checklist

- [ ] Run database migrations: `npm run db:migrate`
- [ ] Seed initial SUPER_ADMIN staff account
- [ ] Configure email notifications for ticket assignments
- [ ] Set up audit log archival/retention policy
- [ ] Configure Razorpay for payment operations
- [ ] Set CORS origin for admin panel frontend
- [ ] Enable HTTPS for all admin endpoints
- [ ] Configure rate limiting for audit log exports
- [ ] Set up monitoring for failed permission attempts
- [ ] Document team role assignments

## Support

For issues or questions:
1. Check `/server/routes/adminRoutes.ts` for endpoint definitions
2. Review `/server/middleware/adminRbac.ts` for permission logic
3. Check audit logs for what operations succeeded/failed
4. Look at error messages in API response (detailed info in logs)
