import { storage } from "../storage";

/**
 * Admin Analytics Service
 * 
 * Calculates staff performance metrics, ticket analytics, coupon performance,
 * and revenue metrics for the admin dashboard and reports.
 */

export async function getStaffAnalytics(filters?: {
  startDate?: Date;
  endDate?: Date;
  staffId?: string;
}): Promise<any[]> {
  try {
    const metrics = await storage.getAllStaffMetrics();
    
    if (!metrics || metrics.length === 0) {
      return [];
    }

    return metrics.map(metric => ({
      staffId: metric.staffId,
      ticketsAssigned: metric.ticketsAssigned || 0,
      ticketsResolved: metric.ticketsResolved || 0,
      resolutionRate: (metric.ticketsAssigned || 0) > 0 
        ? (((metric.ticketsResolved || 0) / (metric.ticketsAssigned || 0)) * 100).toFixed(2) 
        : '0.00',
      avgResolutionTime: (metric.avgResolutionTime || 0).toFixed(2),
      totalActions: metric.totalActionCount || 0,
      couponsCreated: metric.couponsCreated || 0,
      couponRedemptionRate: (metric.couponRedemptionRate || 0).toFixed(2),
      lastUpdated: metric.lastUpdated,
    }));
  } catch (error) {
    console.error('[analyticsService] Failed to get staff analytics:', error);
    return [];
  }
}

/**
 * Get detailed analytics for a single staff member
 */
export async function getStaffDetailedAnalytics(staffId: string): Promise<{
  staffId: string;
  ticketsMetrics: any;
  couponsMetrics: any;
  generalMetrics: any;
  activityTimeline: any[];
}> {
  try {
    const metrics = await storage.getStaffMetrics(staffId);
    if (!metrics) {
      throw new Error('Staff not found');
    }

    // Get recent audit logs for this staff
    const auditLogs = await storage.getAdminAuditLogs({
      staffId,
      limit: 50,
    });

    // Group by action type
    const ticketActions = auditLogs.logs.filter(log => log.entityType === 'ticket');
    const couponActions = auditLogs.logs.filter(log => log.entityType === 'coupon');

    return {
      staffId,
      ticketsMetrics: {
        assigned: metrics.ticketsAssigned || 0,
        resolved: metrics.ticketsResolved || 0,
        avgResolutionHours: (metrics.avgResolutionTime || 0).toFixed(2),
        resolutionRate: (metrics.ticketsAssigned || 0) > 0
          ? (((metrics.ticketsResolved || 0) / (metrics.ticketsAssigned || 0)) * 100).toFixed(2)
          : '0.00',
      },
      couponsMetrics: {
        created: metrics.couponsCreated || 0,
        redemptionRate: (metrics.couponRedemptionRate || 0).toFixed(2),
      },
      generalMetrics: {
        totalActions: metrics.totalActionCount || 0,
        lastUpdated: metrics.lastUpdated,
      },
      activityTimeline: auditLogs.logs.slice(0, 20).map(log => ({
        action: log.action,
        entity: log.entityType,
        timestamp: log.createdAt,
        status: log.status,
      })),
    };
  } catch (error) {
    console.error('[analyticsService] Failed to get detailed analytics:', error);
    throw error;
  }
}

/**
 * Get ticket analytics dashboard data
 */
export async function getTicketDashboardAnalytics(): Promise<{
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  slaBreach: number;
  avgResolutionTime: number;
  priorityBreakdown: Record<string, number>;
}> {
  try {
    const analytics = await storage.getTicketAnalytics();
    return {
      totalTickets: analytics.totalTickets,
      openTickets: analytics.openTickets,
      resolvedTickets: analytics.resolvedTickets,
      slaBreach: analytics.slaBreaches,
      avgResolutionTime: parseFloat(analytics.avgResolutionTime.toFixed(2)),
      priorityBreakdown: analytics.byPriority,
    };
  } catch (error) {
    console.error('[analyticsService] Failed to get ticket analytics:', error);
    return {
      totalTickets: 0,
      openTickets: 0,
      resolvedTickets: 0,
      slaBreach: 0,
      avgResolutionTime: 0,
      priorityBreakdown: {},
    };
  }
}

/**
 * Get coupon analytics
 */
export async function getCouponDashboardAnalytics(): Promise<{
  totalCoupons: number;
  activeCoupons: number;
  expiredCoupons: number;
  totalRedemptions: number;
  redemptionRate: number;
  topCoupons: any[];
}> {
  try {
    const analytics = await storage.getCouponAnalytics();
    return analytics;
  } catch (error) {
    console.error('[analyticsService] Failed to get coupon analytics:', error);
    return {
      totalCoupons: 0,
      activeCoupons: 0,
      expiredCoupons: 0,
      totalRedemptions: 0,
      redemptionRate: 0,
      topCoupons: [],
    };
  }
}

/**
 * Get revenue summary analytics
 */
export async function getRevenueAnalytics(filters?: {
  startDate?: Date;
  endDate?: Date;
}): Promise<{
  totalRevenue: number;
  activeSubscriptions: number;
  pendingPayments: number;
  mrr: number; // Monthly Recurring Revenue
  mrg: number; // Monthly Recurring GST
}> {
  try {
    const analytics = await storage.getRevenueAnalytics(filters);
    return analytics;
  } catch (error) {
    console.error('[analyticsService] Failed to get revenue analytics:', error);
    return {
      totalRevenue: 0,
      activeSubscriptions: 0,
      pendingPayments: 0,
      mrr: 0,
      mrg: 0,
    };
  }
}

/**
 * Export staff analytics as CSV
 */
export function exportStaffAnalyticsAsCSV(data: any[]): string {
  const headers = [
    'Staff ID',
    'Tickets Assigned',
    'Tickets Resolved',
    'Resolution Rate (%)',
    'Avg Resolution Time (hrs)',
    'Total Actions',
    'Coupons Created',
    'Coupon Redemption Rate (%)',
    'Last Updated',
  ];

  const rows = data.map(staff => [
    staff.staffId,
    staff.ticketsAssigned,
    staff.ticketsResolved,
    staff.resolutionRate,
    staff.avgResolutionTime,
    staff.totalActions,
    staff.couponsCreated,
    staff.couponRedemptionRate,
    new Date(staff.lastUpdated).toISOString(),
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');

  return csvContent;
}

/**
 * Export ticket analytics as CSV
 */
export function exportTicketAnalyticsAsCSV(data: any): string {
  const headers = [
    'Metric',
    'Value',
  ];

  const rows = [
    ['Total Tickets', data.totalTickets],
    ['Open Tickets', data.openTickets],
    ['Resolved Tickets', data.resolvedTickets],
    ['SLA Breaches', data.slaBreach],
    ['Avg Resolution Time (hrs)', data.avgResolutionTime],
  ];

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');

  return csvContent;
}

/**
 * Export coupon analytics as CSV
 */
export function exportCouponAnalyticsAsCSV(data: any): string {
  const headers = [
    'Metric',
    'Value',
  ];

  const rows = [
    ['Total Coupons', data.totalCoupons],
    ['Active Coupons', data.activeCoupons],
    ['Expired Coupons', data.expiredCoupons],
    ['Total Redemptions', data.totalRedemptions],
    ['Redemption Rate (%)', data.redemptionRate],
  ];

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');

  return csvContent;
}

/**
 * Get dashboard summary (all metrics at a glance)
 */
export async function getDashboardSummary(): Promise<{
  staff: {
    totalActiveStaff: number;
    avgTicketsResolved: number;
    avgResolutionTime: number;
  };
  tickets: {
    open: number;
    resolved: number;
    slaBreaches: number;
  };
  coupons: {
    active: number;
    totalRedemptions: number;
  };
  revenue: {
    thisMonth: number;
    activeSubscriptions: number;
    pendingPayments: number;
  };
}> {
  try {
    const [
      staffMetrics,
      ticketAnalytics,
      couponAnalytics,
      revenueAnalytics,
    ] = await Promise.all([
      storage.getAllStaffMetrics(),
      storage.getTicketAnalytics(),
      storage.getCouponAnalytics(),
      storage.getRevenueAnalytics(),
    ]);

    const avgTicketsResolved = staffMetrics.length > 0
      ? staffMetrics.reduce((sum, m) => sum + (m.ticketsResolved || 0), 0) / staffMetrics.length
      : 0;

    const avgResolutionTime = staffMetrics.length > 0
      ? staffMetrics.reduce((sum, m) => sum + (m.avgResolutionTime || 0), 0) / staffMetrics.length
      : 0;

    return {
      staff: {
        totalActiveStaff: staffMetrics.length,
        avgTicketsResolved: parseFloat(avgTicketsResolved.toFixed(2)),
        avgResolutionTime: parseFloat(avgResolutionTime.toFixed(2)),
      },
      tickets: {
        open: ticketAnalytics.openTickets,
        resolved: ticketAnalytics.resolvedTickets,
        slaBreaches: ticketAnalytics.slaBreaches,
      },
      coupons: {
        active: couponAnalytics.activeCoupons,
        totalRedemptions: couponAnalytics.totalRedemptions,
      },
      revenue: {
        thisMonth: revenueAnalytics.mrr,
        activeSubscriptions: revenueAnalytics.activeSubscriptions,
        pendingPayments: revenueAnalytics.pendingPayments,
      },
    };
  } catch (error) {
    console.error('[analyticsService] Failed to get dashboard summary:', error);
    return {
      staff: {
        totalActiveStaff: 0,
        avgTicketsResolved: 0,
        avgResolutionTime: 0,
      },
      tickets: {
        open: 0,
        resolved: 0,
        slaBreaches: 0,
      },
      coupons: {
        active: 0,
        totalRedemptions: 0,
      },
      revenue: {
        thisMonth: 0,
        activeSubscriptions: 0,
        pendingPayments: 0,
      },
    };
  }
}
